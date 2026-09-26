using System.ComponentModel.DataAnnotations;
using System.Net.Http.Json;
using System.Text.Json;
using LegalService.API.Data;
using LegalService.API.Infrastructure;
using Microsoft.EntityFrameworkCore;
namespace LegalService.API.Services.Lawyers;
public class RecommendationRequest
{
    [Required, StringLength(4000, MinimumLength = 3)] public string Requirement { get; set; } = "";
    public DateOnly? Date { get; set; }
    [Range(1, 20)] public int Limit { get; set; } = 5;
}
public record Recommendation(Guid LawyerId, int Score, string Reason);
public record RecommendationResponse(List<Recommendation> Recommendations, List<string> Warnings, List<JsonElement> Trace);
public interface ILawyerRecommendationService
{
    Task<RecommendationResponse> RecommendAsync(RecommendationRequest request, CancellationToken ct);
}
public sealed class RecommendationService(HttpClient client, IConfiguration config, ApplicationDbContext db) : ILawyerRecommendationService
{
    public async Task<RecommendationResponse> RecommendAsync(RecommendationRequest request, CancellationToken ct)
    {
        LawyerService.Validate(request);
        if (!Uri.TryCreate(config["Ai:BaseUrl"], UriKind.Absolute, out var url) || string.IsNullOrWhiteSpace(config["Ai:InternalKey"]))
            throw new ApiException(503, "Lawyer recommendations are not configured.");
        using var message = new HttpRequestMessage(HttpMethod.Post, new Uri(url, "lawyer-recommendations")) { Content = JsonContent.Create(request) };
        message.Headers.Add("X-Internal-Key", config["Ai:InternalKey"]);
        try
        {
            using var response = await client.SendAsync(message, ct);
            if ((int)response.StatusCode == 422) throw new ApiException(400, "Please refine the legal requirement.");
            if (!response.IsSuccessStatusCode) throw new ApiException(503, "Recommendation service is temporarily unavailable.");
            var result = await response.Content.ReadFromJsonAsync<RecommendationResponse>(ct) ?? throw new ApiException(502, "Invalid recommendation response.");
            if (result.Recommendations is null || result.Warnings is null || result.Trace is null || result.Recommendations.Count > request.Limit ||
                result.Recommendations.Any(r => r is null || r.LawyerId == Guid.Empty || r.Score < 0 || string.IsNullOrWhiteSpace(r.Reason)))
                throw new ApiException(502, "Invalid recommendation response.");
            var ids = result.Recommendations.Select(r => r.LawyerId).ToArray();
            var valid = await db.Lawyers.AsNoTracking().Where(l => ids.Contains(l.LawyerId) && l.Status == "Active")
                .Where(l => request.Date == null || l.LawyerAvailabilities.Any(a => a.Date == request.Date))
                .Select(l => l.LawyerId).ToListAsync(ct);
            if (ids.Distinct().Count() != ids.Length || ids.Any(id => !valid.Contains(id)))
                throw new ApiException(409, "Lawyer data changed. Request fresh recommendations.");
            return result;
        }
        catch (HttpRequestException) { throw new ApiException(503, "Recommendation service is unavailable."); }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested) { throw new ApiException(503, "Recommendation service timed out."); }
        catch (JsonException) { throw new ApiException(502, "Invalid recommendation response."); }
    }
}
