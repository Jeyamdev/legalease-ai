using System.ComponentModel.DataAnnotations;
namespace LegalService.API.DTOs.Requests;

public class UpdateLawyerRequest
{
    [Required, StringLength(200)] public string Name { get; set; } = "";
    [Required, EmailAddress, StringLength(254)] public string Email { get; set; } = "";
    [Required, Phone, StringLength(30)] public string PhoneNumber { get; set; } = "";
    [Required, StringLength(500)] public string Qualification { get; set; } = "";
    [Range(0, 100)] public int Experience { get; set; }
    [Required, StringLength(100)] public string LicenseNumber { get; set; } = "";
    [StringLength(5000)] public string ProfileDescription { get; set; } = "";
    [Required, RegularExpression("^(Active|Inactive|Suspended)$")] public string Status { get; set; } = "Active";
    [Required, MaxLength(100)] public int[] SpecializationIds { get; set; } = [];
    [Required, MaxLength(100)] public int[] LegalServiceIds { get; set; } = [];
}
public class CreateManagedLawyerRequest : UpdateLawyerRequest
{
    // Optional existing integer account ID for email verification; no credentials are changed.
    public int? UserId { get; set; }
}
public class LawyerSearchRequest
{
    [StringLength(200)] public string? Search { get; set; }
    [Range(1, int.MaxValue)] public int? SpecializationId { get; set; }
    [Range(1, int.MaxValue)] public int? LegalServiceId { get; set; }
    [Range(0, 100)] public int? MinExperience { get; set; }
    [RegularExpression("^(Active|Inactive|Suspended)$")] public string? Status { get; set; }
    public DateOnly? Date { get; set; }
    [Range(1, 100000)] public int Page { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 20;
    [RegularExpression("^(name|experience|experience_desc)$")] public string Sort { get; set; } = "name";
}
public class AvailabilityRequest : IValidatableObject
{
    public DateOnly Date { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (Date == default) yield return new("A valid date is required.", [nameof(Date)]);
        if (StartTime >= EndTime) yield return new("Start time must be before end time.", [nameof(EndTime)]);
    }
}
public class CatalogRequest
{
    [Required, StringLength(200)] public string Name { get; set; } = "";
    [StringLength(2000)] public string Description { get; set; } = "";
    [StringLength(200)] public string Category { get; set; } = "";
}
