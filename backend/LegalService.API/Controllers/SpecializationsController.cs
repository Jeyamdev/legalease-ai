using LegalService.API.DTOs.Requests;
using LegalService.API.Services.Lawyers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace LegalService.API.Controllers;
[ApiController, Route("api/specializations")]
public sealed class SpecializationsController(CatalogService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List(CancellationToken ct) => Ok(await service.ListAsync(false, ct));
    [HttpGet("{id:int}")] public async Task<IActionResult> Get(int id, CancellationToken ct) => Ok(await service.GetAsync(false, id, ct));
    [HttpPost, Authorize(AuthenticationSchemes = "Member1", Roles = "Admin")]
    public async Task<IActionResult> Create(CatalogRequest r, CancellationToken ct)
    { var result = await service.SaveAsync(false, null, r, ct); return CreatedAtAction(nameof(Get), new { id = result.Id }, result); }
    [HttpPut("{id:int}"), Authorize(AuthenticationSchemes = "Member1", Roles = "Admin")]
    public async Task<IActionResult> Update(int id, CatalogRequest r, CancellationToken ct) => Ok(await service.SaveAsync(false, id, r, ct));
    [HttpDelete("{id:int}"), Authorize(AuthenticationSchemes = "Member1", Roles = "Admin")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct) { await service.DeleteAsync(false, id, ct); return NoContent(); }
}
