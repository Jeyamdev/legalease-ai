namespace LegalService.API.DTOs.Responses;
public record CatalogResponse(int Id, string Name, string Description, string? Category = null);
public record LawyerSummaryResponse(Guid LawyerId, string Name, int Experience, string Status,
    List<CatalogResponse> Specializations, List<CatalogResponse> LegalServices);
public record LawyerResponse(Guid LawyerId, string Name, string Email, string PhoneNumber,
    string Qualification, int Experience, string LicenseNumber, string ProfileDescription,
    string Status, List<CatalogResponse> Specializations, List<CatalogResponse> LegalServices);
public record PageResponse<T>(List<T> Items, int TotalCount, int Page, int PageSize);
public record AvailabilityResponse(Guid AvailabilityId, DateOnly Date, TimeOnly StartTime, TimeOnly EndTime, bool HasSlots);
