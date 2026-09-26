using System.ComponentModel.DataAnnotations;
using System.Data;
using LegalService.API.Data;
using LegalService.API.DTOs.Requests;
using LegalService.API.DTOs.Responses;
using LegalService.API.Infrastructure;
using LegalService.API.Models.Entities;
using Microsoft.EntityFrameworkCore;
namespace LegalService.API.Services.Lawyers;

public sealed class LawyerService(ApplicationDbContext db) : ILawyerService
{
    internal static void Validate(object request)
    {
        var errors = new List<System.ComponentModel.DataAnnotations.ValidationResult>();
        if (!Validator.TryValidateObject(request, new ValidationContext(request), errors, true))
            throw new ApiException(400, string.Join(" ", errors.Select(e => e.ErrorMessage)));
    }
    private IQueryable<Lawyer> Visible(bool admin) => db.Lawyers.AsNoTracking().AsSplitQuery()
        .Where(l => admin || l.Status == "Active");
    public async Task<PageResponse<LawyerSummaryResponse>> SearchAsync(LawyerSearchRequest r, bool admin, CancellationToken ct)
    {
        Validate(r);
        var q = Visible(admin);
        if (!string.IsNullOrWhiteSpace(r.Search)) { var term = r.Search.Trim().ToLower(); q = q.Where(l => l.Name.ToLower().Contains(term)); }
        if (r.SpecializationId is {} spec) q = q.Where(l => l.LawyerSpecializations.Any(s => s.SpecializationId == spec));
        if (r.LegalServiceId is {} service) q = q.Where(l => l.LawyerLegalServices.Any(s => s.LegalServiceId == service));
        if (r.MinExperience is {} exp) q = q.Where(l => l.Experience >= exp);
        if (r.Status is {} status) q = q.Where(l => l.Status == status);
        if (r.Date is {} date) q = q.Where(l => l.LawyerAvailabilities.Any(a => a.Date == date));
        var count = await q.CountAsync(ct);
        q = r.Sort switch { "experience" => q.OrderBy(l => l.Experience).ThenBy(l => l.LawyerId),
            "experience_desc" => q.OrderByDescending(l => l.Experience).ThenBy(l => l.LawyerId),
            _ => q.OrderBy(l => l.Name).ThenBy(l => l.LawyerId) };
        var items = await q.Skip((r.Page - 1) * r.PageSize).Take(r.PageSize)
            .Select(l => new LawyerSummaryResponse(l.LawyerId, l.Name, l.Experience, l.Status,
                l.LawyerSpecializations.Select(s => new CatalogResponse(s.SpecializationId, s.Specialization.Name, s.Specialization.Description, null)).ToList(),
                l.LawyerLegalServices.Select(s => new CatalogResponse(s.LegalServiceId, s.LegalService.ServiceName, s.LegalService.Description, s.LegalService.Category)).ToList())).ToListAsync(ct);
        return new(items, count, r.Page, r.PageSize);
    }
    public async Task<LawyerResponse> GetAsync(Guid id, bool admin, CancellationToken ct) =>
        await Visible(admin).Where(l => l.LawyerId == id).Select(l => new LawyerResponse(l.LawyerId,
            l.Name, l.Email ?? "", l.PhoneNumber, l.Qualification, l.Experience, l.LicenseNumber,
            l.ProfileDescription, l.Status,
            l.LawyerSpecializations.Select(s => new CatalogResponse(s.SpecializationId, s.Specialization.Name, s.Specialization.Description, null)).ToList(),
            l.LawyerLegalServices.Select(s => new CatalogResponse(s.LegalServiceId, s.LegalService.ServiceName, s.LegalService.Description, s.LegalService.Category)).ToList()))
            .SingleOrDefaultAsync(ct) ?? throw new ApiException(404, "Lawyer not found.");

    private async Task ValidateRelationships(UpdateLawyerRequest r, Guid id, CancellationToken ct)
    {
        Validate(r);
        if (r.SpecializationIds.Distinct().Count() != r.SpecializationIds.Length || r.LegalServiceIds.Distinct().Count() != r.LegalServiceIds.Length)
            throw new ApiException(400, "Relationship IDs must be unique.");
        if (await db.Specializations.CountAsync(s => r.SpecializationIds.Contains(s.SpecializationId), ct) != r.SpecializationIds.Length ||
            await db.LegalServices.CountAsync(s => r.LegalServiceIds.Contains(s.LegalServiceId), ct) != r.LegalServiceIds.Length)
            throw new ApiException(400, "Unknown specialization or legal service ID.");
        var email = r.Email.Trim().ToLowerInvariant(); var license = r.LicenseNumber.Trim().ToUpperInvariant();
        if (await db.Lawyers.AnyAsync(l => l.LawyerId != id && l.Email != null && l.Email.ToLower() == email, ct)) throw new ApiException(409, "Email already exists.");
        if (await db.Lawyers.AnyAsync(l => l.LawyerId != id && l.LicenseNumber.ToUpper() == license, ct)) throw new ApiException(409, "License number already exists.");
    }
    private static void Apply(Lawyer l, UpdateLawyerRequest r)
    {
        l.Name = r.Name.Trim(); l.Email = r.Email.Trim().ToLowerInvariant();
        l.PhoneNumber = r.PhoneNumber.Trim(); l.Qualification = r.Qualification.Trim(); l.Experience = r.Experience;
        l.LicenseNumber = r.LicenseNumber.Trim().ToUpperInvariant(); l.ProfileDescription = r.ProfileDescription.Trim(); l.Status = r.Status;
        l.UpdatedAt = DateTime.UtcNow;
        foreach (var old in l.LawyerSpecializations.Where(s => !r.SpecializationIds.Contains(s.SpecializationId)).ToList()) l.LawyerSpecializations.Remove(old);
        foreach (var id in r.SpecializationIds.Where(id => !l.LawyerSpecializations.Any(s => s.SpecializationId == id))) l.LawyerSpecializations.Add(new() { SpecializationId = id });
        foreach (var old in l.LawyerLegalServices.Where(s => !r.LegalServiceIds.Contains(s.LegalServiceId)).ToList()) l.LawyerLegalServices.Remove(old);
        foreach (var id in r.LegalServiceIds.Where(id => !l.LawyerLegalServices.Any(s => s.LegalServiceId == id))) l.LawyerLegalServices.Add(new() { LegalServiceId = id });
    }
    public async Task<LawyerResponse> CreateAsync(CreateManagedLawyerRequest r, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var id = Guid.NewGuid();
        await ValidateRelationships(r, id, ct);
        if (r.UserId is {} userId)
        {
            var user = await db.Users.FindAsync([userId], ct) ?? throw new ApiException(404, "User not found.");
            if (!string.Equals(user.Email, r.Email.Trim(), StringComparison.OrdinalIgnoreCase))
                throw new ApiException(400, "The profile email must match the selected account.");
        }
        // Current develop stores lawyer identity directly. Do not manufacture login credentials
        // or restore the old Guid user foreign key; booking still references LawyerId.
        var lawyer = new Lawyer { LawyerId = id }; Apply(lawyer, r); db.Lawyers.Add(lawyer);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return await GetAsync(id, true, ct);
    }
    public async Task<LawyerResponse> UpdateAsync(Guid id, UpdateLawyerRequest r, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var l = await db.Lawyers.AsSplitQuery().Include(l => l.LawyerSpecializations).Include(l => l.LawyerLegalServices)
            .SingleOrDefaultAsync(l => l.LawyerId == id, ct) ?? throw new ApiException(404, "Lawyer not found.");
        await ValidateRelationships(r, id, ct); Apply(l, r); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return await GetAsync(id, true, ct);
    }
    public async Task DeactivateAsync(Guid id, CancellationToken ct)
    {
        var l = await db.Lawyers.FindAsync([id], ct) ?? throw new ApiException(404, "Lawyer not found.");
        l.Status = "Inactive"; l.UpdatedAt = DateTime.UtcNow; await db.SaveChangesAsync(ct);
    }
    public async Task<List<AvailabilityResponse>> AvailabilityAsync(Guid id, bool admin, CancellationToken ct)
    {
        if (!await Visible(admin).AnyAsync(l => l.LawyerId == id, ct)) throw new ApiException(404, "Lawyer not found.");
        return await db.LawyerAvailabilities.AsNoTracking().Where(a => a.LawyerId == id).OrderBy(a => a.Date).ThenBy(a => a.StartTime)
            .Select(a => new AvailabilityResponse(a.AvailabilityId, a.Date, a.StartTime, a.EndTime, a.AvailabilitySlots.Any())).ToListAsync(ct);
    }
    public async Task<AvailabilityResponse> SaveAvailabilityAsync(Guid id, Guid? availabilityId, AvailabilityRequest r, CancellationToken ct)
    {
        Validate(r);
        // Serializable transaction prevents concurrent overlapping inserts without changing the shared schema.
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        if (!await db.Lawyers.AnyAsync(l => l.LawyerId == id, ct)) throw new ApiException(404, "Lawyer not found.");
        var a = availabilityId.HasValue ? await db.LawyerAvailabilities.SingleOrDefaultAsync(a => a.LawyerId == id && a.AvailabilityId == availabilityId, ct)
            ?? throw new ApiException(404, "Availability not found.") : new LawyerAvailability { AvailabilityId = Guid.NewGuid(), LawyerId = id };
        if (availabilityId.HasValue && await db.AvailabilitySlots.AnyAsync(s => s.AvailabilityId == a.AvailabilityId, ct)) throw new ApiException(409, "Availability has booking slots; coordinate changes with appointment management.");
        if (await db.LawyerAvailabilities.AnyAsync(x => x.LawyerId == id && x.AvailabilityId != a.AvailabilityId && x.Date == r.Date && x.StartTime < r.EndTime && x.EndTime > r.StartTime, ct))
            throw new ApiException(409, "Availability overlaps an existing period.");
        a.Date = r.Date; a.StartTime = r.StartTime; a.EndTime = r.EndTime;
        if (!availabilityId.HasValue) db.LawyerAvailabilities.Add(a);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new(a.AvailabilityId, a.Date, a.StartTime, a.EndTime, false);
    }
    public async Task DeleteAvailabilityAsync(Guid id, Guid availabilityId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var a = await db.LawyerAvailabilities.SingleOrDefaultAsync(a => a.LawyerId == id && a.AvailabilityId == availabilityId, ct)
            ?? throw new ApiException(404, "Availability not found.");
        if (await db.AvailabilitySlots.AnyAsync(s => s.AvailabilityId == availabilityId, ct)) throw new ApiException(409, "Availability has booking slots and cannot be deleted.");
        db.LawyerAvailabilities.Remove(a); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
}
