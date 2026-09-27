using LegalService.API.DTOs.Requests;
using LegalService.API.Data;
using LegalService.API.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LegalService.API.Controllers;

[ApiController]
public sealed class LegalCatalogController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet("api/legal-services")]
    public async Task<IActionResult> GetLegalServices() => Ok(await db.LegalServices.AsNoTracking()
        .OrderBy(s => s.ServiceName).Select(s => new
        {
            s.LegalServiceId, s.ServiceName, s.Description, s.Category
        }).ToListAsync());

    [Authorize(Roles = "Admin"), HttpPost("api/specializations")]
    public async Task<IActionResult> CreateSpecialization(SpecializationRequest request)
    {
        var name = request.Name.Trim();
        if (await db.Specializations.AnyAsync(s => s.Name.ToLower() == name.ToLower()))
            return Conflict(new { message = "A specialization with this name already exists." });
        var item = new Specialization { Name = name, Description = request.Description?.Trim() ?? "" };
        db.Specializations.Add(item);
        await db.SaveChangesAsync();
        return Created("/api/specializations", new { item.SpecializationId, item.Name, item.Description });
    }

    [Authorize(Roles = "Admin"), HttpPut("api/specializations/{id:int}")]
    public async Task<IActionResult> UpdateSpecialization(int id, SpecializationRequest request)
    {
        var item = await db.Specializations.FindAsync(id);
        if (item == null) return NotFound();
        var name = request.Name.Trim();
        if (await db.Specializations.AnyAsync(s => s.SpecializationId != id && s.Name.ToLower() == name.ToLower()))
            return Conflict(new { message = "A specialization with this name already exists." });
        // The existing service catalog relates categories by name. Keep that link intact on rename.
        var services = await db.LegalServices.Where(s => s.Category == item.Name).ToListAsync();
        foreach (var service in services) service.Category = name;
        item.Name = name;
        item.Description = request.Description?.Trim() ?? "";
        await db.SaveChangesAsync();
        return Ok(new { item.SpecializationId, item.Name, item.Description });
    }

    [Authorize(Roles = "Admin"), HttpDelete("api/specializations/{id:int}")]
    public async Task<IActionResult> DeleteSpecialization(int id)
    {
        var item = await db.Specializations.FindAsync(id);
        if (item == null) return NotFound();
        if (await db.LawyerSpecializations.AnyAsync(s => s.SpecializationId == id) ||
            await db.LegalServices.AnyAsync(s => s.Category == item.Name) ||
            await db.LawyerRecommendationWorkflows.AnyAsync(w => w.CategoryId == id))
            return Conflict(new { message = "This specialization is used by lawyers, services, or recommendation history and cannot be deleted." });
        db.Specializations.Remove(item);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
