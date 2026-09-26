using LegalService.API.DTOs.Requests;
using LegalService.API.DTOs.Responses;
namespace LegalService.API.Services.Lawyers;
public interface ILawyerService
{
    Task<PageResponse<LawyerSummaryResponse>> SearchAsync(LawyerSearchRequest request, bool admin, CancellationToken ct);
    Task<LawyerResponse> GetAsync(Guid id, bool admin, CancellationToken ct);
    Task<LawyerResponse> CreateAsync(CreateManagedLawyerRequest request, CancellationToken ct);
    Task<LawyerResponse> UpdateAsync(Guid id, UpdateLawyerRequest request, CancellationToken ct);
    Task DeactivateAsync(Guid id, CancellationToken ct);
    Task<List<AvailabilityResponse>> AvailabilityAsync(Guid id, bool admin, CancellationToken ct);
    Task<AvailabilityResponse> SaveAvailabilityAsync(Guid id, Guid? availabilityId, AvailabilityRequest request, CancellationToken ct);
    Task DeleteAvailabilityAsync(Guid id, Guid availabilityId, CancellationToken ct);
}
