using System.ComponentModel.DataAnnotations;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using LegalService.API.Data;
using LegalService.API.DTOs.Appointments;
using LegalService.API.Infrastructure;
using LegalService.API.Interfaces;
using LegalService.API.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace LegalService.API.Services.Lawyers;

public class RecommendationRequest
{
    [Required, StringLength(4000, MinimumLength = 3)] public string Requirement { get; set; } = "";
    public DateOnly? Date { get; set; }
    [Range(1, 20)] public int Limit { get; set; } = 5;
}

public class ApproveRecommendationRequest
{
    [Required] public Guid LawyerId { get; set; }
    [Required] public Guid CustomerId { get; set; }
    [Required] public Guid SlotId { get; set; }
}

public record Recommendation(Guid LawyerId, int Score, string Reason)
{
    public string? FullName { get; init; }
    public string? Qualification { get; init; }
    public int? YearsExperience { get; init; }
    public string? PracticeArea { get; init; }
}
public record ParsedLegalRequirement(string Requirement, int? CategoryId, string? CategoryName,
    string? Location, string? PreferredDate, List<string> Keywords);
public record WorkflowEvent(DateTime Timestamp, string Step, string Status, string Summary,
    string? InputSummary = null, string? OutputSummary = null, string? Error = null);
public record RecommendationResponse(List<Recommendation> Recommendations, List<string> Warnings,
    List<JsonElement> Trace, ParsedLegalRequirement? ParsedRequirement = null, DateOnly? Date = null,
    Guid? WorkflowId = null, string? Status = null, Guid? AppointmentId = null, Guid? ApprovedLawyerId = null,
    string? UserRequirement = null);

public interface ILawyerRecommendationService
{
    Task<RecommendationResponse> RecommendAsync(RecommendationRequest request, int userId, CancellationToken ct);
    Task<RecommendationResponse> GetAsync(Guid workflowId, int userId, CancellationToken ct);
    Task<RecommendationResponse> ApproveAsync(Guid workflowId, ApproveRecommendationRequest request, int userId, CancellationToken ct);
}

public sealed class RecommendationService(HttpClient client, IConfiguration config, ApplicationDbContext db,
    IAppointmentService appointments) : ILawyerRecommendationService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<RecommendationResponse> RecommendAsync(RecommendationRequest request, int userId, CancellationToken ct)
    {
        var errors = new List<System.ComponentModel.DataAnnotations.ValidationResult>();
        if (!Validator.TryValidateObject(request, new ValidationContext(request), errors, true) || request.Requirement.Trim().Length < 3)
            throw new ApiException(400, "Describe your legal requirement using at least three characters.");
        if (!Uri.TryCreate(config["Ai:BaseUrl"], UriKind.Absolute, out var url) || string.IsNullOrWhiteSpace(config["Ai:InternalKey"]))
            throw new ApiException(503, "Lawyer recommendations are not configured.");

        var workflow = new LawyerRecommendationWorkflow
        {
            WorkflowId = Guid.NewGuid(), OwnerUserId = userId,
            UserRequirement = request.Requirement.Trim(), RequestedDate = request.Date
        };
        AddEvent(workflow, "received", "completed", "Recommendation requested by authenticated admin",
            input: $"Requirement length {workflow.UserRequirement.Length}; requested date {request.Date?.ToString() ?? "none"}",
            output: $"Workflow {workflow.WorkflowId} created");
        db.LawyerRecommendationWorkflows.Add(workflow);
        await db.SaveChangesAsync(ct);

        try
        {
            var specializations = await db.Specializations.AsNoTracking()
                .Select(s => new { id = s.SpecializationId, name = s.Name, description = s.Description }).ToListAsync(ct);
            var services = await db.LegalServices.AsNoTracking()
                .Select(s => new { id = s.LegalServiceId, name = s.ServiceName, description = s.Description, category = s.Category }).ToListAsync(ct);
            var candidates = await db.Lawyers.AsNoTracking().AsSplitQuery()
                .Where(l => l.Status == "Active")
                .Select(l => new
                {
                    lawyerId = l.LawyerId, status = l.Status, experience = l.Experience,
                    specializations = l.LawyerSpecializations.Select(s => new { id = s.SpecializationId, name = s.Specialization.Name }).ToList(),
                    availableDates = l.LawyerAvailabilities.Where(a => a.AvailabilitySlots.Any(slot => !slot.IsBooked))
                        .Select(a => a.Date).ToList()
                }).ToListAsync(ct);
            AddEvent(workflow, "search_lawyers", "completed", "Controlled database snapshot supplied to matcher",
                input: $"{specializations.Count} categories; {services.Count} services",
                output: JsonSerializer.Serialize(new { candidateCount = candidates.Count,
                    candidateIds = candidates.Select(c => c.lawyerId).ToArray() }, JsonOptions));

            using var message = new HttpRequestMessage(HttpMethod.Post, new Uri(url, "lawyer-recommendations"))
            {
                Content = JsonContent.Create(new { request.Requirement, request.Date, request.Limit, specializations, services, candidates })
            };
            message.Headers.Add("X-Internal-Key", config["Ai:InternalKey"]);
            using var response = await client.SendAsync(message, ct);
            if ((int)response.StatusCode == 422) throw new ApiException(422, "The legal category was invalid. Refine the requirement.");
            if (!response.IsSuccessStatusCode) throw new ApiException(503, "Requirement understanding is temporarily unavailable.");
            var result = await response.Content.ReadFromJsonAsync<RecommendationResponse>(JsonOptions, ct)
                ?? throw new ApiException(502, "Invalid recommendation response.");
            if (result.ParsedRequirement is null || result.Recommendations is null || result.Warnings is null || result.Trace is null ||
                result.Recommendations.Count > request.Limit || result.Recommendations.Any(r => r.LawyerId == Guid.Empty || r.Score is < 0 or > 100 || string.IsNullOrWhiteSpace(r.Reason)))
                throw new ApiException(502, "Invalid recommendation response.");

            var parsed = result.ParsedRequirement;
            if (parsed.CategoryId is int categoryId)
            {
                if (!await db.Specializations.AsNoTracking().AnyAsync(s => s.SpecializationId == categoryId && s.Name == parsed.CategoryName, ct))
                    throw new ApiException(422, "The selected legal category no longer exists.");
            }
            else if (parsed.CategoryName is not null)
                throw new ApiException(422, "The legal category was invalid.");

            var effectiveDate = request.Date ?? result.Date;
            if (request.Date is not null && result.Date != request.Date)
                throw new ApiException(502, "Recommendation date did not match the requested date.");
            var ids = result.Recommendations.Select(r => r.LawyerId).ToArray();
            if (ids.Distinct().Count() != ids.Length || (ids.Length > 0 && parsed.CategoryId is null))
                throw new ApiException(502, "Recommendation identities are invalid.");
            var valid = await db.Lawyers.AsNoTracking()
                .Where(l => ids.Contains(l.LawyerId) && l.Status == "Active" &&
                    l.LawyerSpecializations.Any(s => s.SpecializationId == parsed.CategoryId))
                .Where(l => effectiveDate == null || l.LawyerAvailabilities.Any(a => a.Date == effectiveDate && a.AvailabilitySlots.Any(slot => !slot.IsBooked)))
                .Select(l => l.LawyerId).ToListAsync(ct);
            if (ids.Any(id => !valid.Contains(id)))
                throw new ApiException(409, "Lawyer data changed. Request fresh recommendations.");

            var profiles = await db.Lawyers.AsNoTracking().Where(l => ids.Contains(l.LawyerId))
                .Select(l => new { l.LawyerId, l.Name, l.Qualification, l.Experience })
                .ToDictionaryAsync(l => l.LawyerId, ct);
            var verifiedRecommendations = result.Recommendations.Select(r => r with
            {
                FullName = profiles[r.LawyerId].Name,
                Qualification = profiles[r.LawyerId].Qualification,
                YearsExperience = profiles[r.LawyerId].Experience,
                PracticeArea = parsed.CategoryName
            }).ToList();
            workflow.Status = parsed.CategoryId is null ? "UNSUPPORTED" : ids.Length == 0 ? "NO_MATCH" : "AWAITING_APPROVAL";
            workflow.CategoryId = parsed.CategoryId;
            workflow.RequestedDate = effectiveDate;
            workflow.ParsedRequirementJson = JsonSerializer.Serialize(parsed, JsonOptions);
            workflow.RecommendationsJson = JsonSerializer.Serialize(verifiedRecommendations, JsonOptions);
            workflow.WarningsJson = JsonSerializer.Serialize(result.Warnings, JsonOptions);
            foreach (var step in result.Trace)
            {
                var name = step.TryGetProperty("step", out var property) ? property.GetString() ?? "agent" : "agent";
                var stepStatus = step.TryGetProperty("status", out var statusProperty) ? statusProperty.GetString() : null;
                AddEvent(workflow, name, stepStatus == "unsupported" ? "UNSUPPORTED" : "COMPLETED", "Recommendation stage recorded",
                    output: step.ToString().Length > 400 ? step.ToString()[..400] : step.ToString());
            }
            if (parsed.CategoryId is not null)
                AddEvent(workflow, "backend_validation", "COMPLETED", $"{ids.Length} recommendation(s) revalidated against current database data");
            if (workflow.Status == "AWAITING_APPROVAL") AddEvent(workflow, "await_human_approval", workflow.Status, $"{ids.Length} validated recommendation(s); no booking made",
                input: $"Category {parsed.CategoryId?.ToString() ?? "unknown"}; date {effectiveDate?.ToString() ?? "none"}",
                output: $"Saved recommendation IDs: {string.Join(",", ids)}");
            await db.SaveChangesAsync(ct);
            return ToResponse(workflow);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            workflow.Status = "FAILED";
            AddEvent(workflow, "failed", "FAILED", "Recommendation processing failed",
                error: ex is ApiException api ? api.Message : "Internal recommendation error");
            await db.SaveChangesAsync(ct);
            if (ex is ApiException) throw;
            if (ex is HttpRequestException or TaskCanceledException) throw new ApiException(503, "Recommendation service is unavailable.");
            if (ex is JsonException) throw new ApiException(502, "Invalid recommendation response.");
            throw;
        }
    }

    public async Task<RecommendationResponse> GetAsync(Guid workflowId, int userId, CancellationToken ct)
    {
        var workflow = await db.LawyerRecommendationWorkflows.AsNoTracking()
            .SingleOrDefaultAsync(w => w.WorkflowId == workflowId && w.OwnerUserId == userId, ct)
            ?? throw new ApiException(404, "Recommendation workflow not found.");
        return ToResponse(workflow);
    }

    public async Task<RecommendationResponse> ApproveAsync(Guid workflowId, ApproveRecommendationRequest request, int userId, CancellationToken ct)
    {
        if (request.LawyerId == Guid.Empty || request.CustomerId == Guid.Empty || request.SlotId == Guid.Empty)
            throw new ApiException(400, "Lawyer, customer, and appointment slot IDs are required.");
        var initial = await db.LawyerRecommendationWorkflows.AsNoTracking()
            .SingleOrDefaultAsync(w => w.WorkflowId == workflowId && w.OwnerUserId == userId, ct)
            ?? throw new ApiException(404, "Recommendation workflow not found.");
        if (initial.Status != "AWAITING_APPROVAL")
            throw new ApiException(409, "This workflow is not awaiting approval.");
        if (!(JsonSerializer.Deserialize<List<Recommendation>>(initial.RecommendationsJson, JsonOptions) ?? [])
            .Any(r => r.LawyerId == request.LawyerId))
            throw new ApiException(400, "The selected lawyer was not recommended by this workflow.");
        await using var transaction = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct)
            : null;
        var workflow = await db.LawyerRecommendationWorkflows
            .SingleOrDefaultAsync(w => w.WorkflowId == workflowId && w.OwnerUserId == userId, ct)
            ?? throw new ApiException(404, "Recommendation workflow not found.");
        if (workflow.Status != "AWAITING_APPROVAL")
            throw new ApiException(409, "This workflow is not awaiting approval.");
        var recommendations = JsonSerializer.Deserialize<List<Recommendation>>(workflow.RecommendationsJson, JsonOptions) ?? [];
        if (!recommendations.Any(r => r.LawyerId == request.LawyerId))
            throw new ApiException(400, "The selected lawyer was not recommended by this workflow.");
        var lawyerIsEligible = await db.Lawyers.AsNoTracking().AnyAsync(l => l.LawyerId == request.LawyerId && l.Status == "Active" &&
            l.LawyerSpecializations.Any(s => s.SpecializationId == workflow.CategoryId), ct);
        if (!lawyerIsEligible)
            throw new ApiException(409, "The selected lawyer is no longer eligible.");
        const string customerPrefix = "00000000-0000-0000-0000-";
        var customerText = request.CustomerId.ToString();
        if (!customerText.StartsWith(customerPrefix, StringComparison.Ordinal) ||
            !long.TryParse(customerText[customerPrefix.Length..], System.Globalization.NumberStyles.HexNumber,
                System.Globalization.CultureInfo.InvariantCulture, out var customerNumber) ||
            customerNumber is <= 0 or > int.MaxValue ||
            !await db.Users.AsNoTracking().AnyAsync(u => u.UserId == (int)customerNumber && u.Role == "Customer", ct))
            throw new ApiException(400, "Select an existing customer account.");
        var slotIsEligible = await db.AvailabilitySlots.AsNoTracking().AnyAsync(s => s.SlotId == request.SlotId && !s.IsBooked &&
            s.LawyerAvailability.LawyerId == request.LawyerId &&
            s.LawyerAvailability.Date >= DateOnly.FromDateTime(DateTime.UtcNow) &&
            (workflow.RequestedDate == null || s.LawyerAvailability.Date == workflow.RequestedDate), ct);
        if (!slotIsEligible)
            throw new ApiException(409, "The selected appointment slot is unavailable or does not match the requested date.");

        // Human selection is explicit. The existing appointment service owns conflict checks and booking.
        AppointmentDetailsResponse booking;
        try
        {
            booking = await appointments.BookAppointmentAsync(new BookAppointmentRequest
            {
                LawyerId = request.LawyerId, CustomerId = request.CustomerId, SlotId = request.SlotId,
                Description = workflow.UserRequirement,
                LegalServiceCategory = JsonSerializer.Deserialize<ParsedLegalRequirement>(workflow.ParsedRequirementJson, JsonOptions)?.CategoryName
            });
        }
        catch (KeyNotFoundException) { throw new ApiException(409, "The appointment slot no longer exists."); }
        catch (InvalidOperationException) { throw new ApiException(409, "The appointment slot is no longer available."); }
        workflow.ApprovedLawyerId = request.LawyerId;
        workflow.AppointmentId = booking.AppointmentId;
        workflow.Status = "ACTION_COMPLETED";
        AddEvent(workflow, "human_approval", "APPROVED", "Admin approved a recommended lawyer",
            input: $"Admin {userId}; lawyer {request.LawyerId}; slot {request.SlotId}", output: "Saved selection validated");
        AddEvent(workflow, "create_booking", "ACTION_COMPLETED", "Existing appointment service created booking",
            input: $"Lawyer {request.LawyerId}; slot {request.SlotId}", output: $"Appointment {booking.AppointmentId}");
        await db.SaveChangesAsync(ct);
        if (transaction is not null) await transaction.CommitAsync(ct);
        return ToResponse(workflow);
    }

    private static RecommendationResponse ToResponse(LawyerRecommendationWorkflow w) => new(
        JsonSerializer.Deserialize<List<Recommendation>>(w.RecommendationsJson, JsonOptions) ?? [],
        JsonSerializer.Deserialize<List<string>>(w.WarningsJson, JsonOptions) ?? [],
        (JsonSerializer.Deserialize<List<WorkflowEvent>>(w.AuditJson, JsonOptions) ?? [])
            .Select(e => JsonSerializer.SerializeToElement(e, JsonOptions)).ToList(),
        JsonSerializer.Deserialize<ParsedLegalRequirement>(w.ParsedRequirementJson, JsonOptions),
        w.RequestedDate, w.WorkflowId, w.Status, w.AppointmentId, w.ApprovedLawyerId, w.UserRequirement);

    private static void AddEvent(LawyerRecommendationWorkflow workflow, string step, string status, string summary,
        string? input = null, string? output = null, string? error = null)
    {
        var events = JsonSerializer.Deserialize<List<WorkflowEvent>>(workflow.AuditJson, JsonOptions) ?? [];
        events.Add(new WorkflowEvent(DateTime.UtcNow, step, status, summary, input, output, error));
        workflow.AuditJson = JsonSerializer.Serialize(events, JsonOptions);
        workflow.UpdatedAt = DateTime.UtcNow;
    }
}
