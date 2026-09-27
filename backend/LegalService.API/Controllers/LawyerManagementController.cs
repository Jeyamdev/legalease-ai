using LegalService.API.DTOs.Requests;
using LegalService.API.Services.Lawyers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace LegalService.API.Controllers;
[ApiController, Route("api/lawyer-management")]
public sealed class LawyerManagementController(ILawyerService service) : ControllerBase
{
    [HttpGet, HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] LawyerSearchRequest r, CancellationToken ct) => Ok(await service.SearchAsync(r, User.IsInRole("Admin"), ct));
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) => Ok(await service.GetAsync(id, User.IsInRole("Admin"), ct));
    [HttpPost, Authorize(AuthenticationSchemes = "Member1", Roles = "Admin")]
    public async Task<IActionResult> Create(CreateManagedLawyerRequest r, CancellationToken ct)
    { var result = await service.CreateAsync(r, ct); return CreatedAtAction(nameof(Get), new { id = result.LawyerId }, result); }
    [HttpPut("{id:guid}"), Authorize(AuthenticationSchemes = "Member1", Roles = "Admin")]
    public async Task<IActionResult> Update(Guid id, UpdateLawyerRequest r, CancellationToken ct) => Ok(await service.UpdateAsync(id, r, ct));
    [HttpDelete("{id:guid}"), Authorize(AuthenticationSchemes = "Member1", Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { await service.DeactivateAsync(id, ct); return NoContent(); }
    [HttpGet("{id:guid}/availability")]
    public async Task<IActionResult> Availability(Guid id, CancellationToken ct) => Ok(await service.AvailabilityAsync(id, User.IsInRole("Admin"), ct));
    [HttpPost("{id:guid}/availability"), Authorize(AuthenticationSchemes = "Member1", Roles = "Admin")]
    public async Task<IActionResult> AddAvailability(Guid id, AvailabilityRequest r, CancellationToken ct)
    { var result = await service.SaveAvailabilityAsync(id, null, r, ct); return CreatedAtAction(nameof(Availability), new { id }, result); }
    [HttpPut("{id:guid}/availability/{availabilityId:guid}"), Authorize(AuthenticationSchemes = "Member1", Roles = "Admin")]
    public async Task<IActionResult> UpdateAvailability(Guid id, Guid availabilityId, AvailabilityRequest r, CancellationToken ct) => Ok(await service.SaveAvailabilityAsync(id, availabilityId, r, ct));
    [HttpDelete("{id:guid}/availability/{availabilityId:guid}"), Authorize(AuthenticationSchemes = "Member1", Roles = "Admin")]
    public async Task<IActionResult> DeleteAvailability(Guid id, Guid availabilityId, CancellationToken ct)
    { await service.DeleteAvailabilityAsync(id, availabilityId, ct); return NoContent(); }
}
