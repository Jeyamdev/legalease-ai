using LegalService.API.Data;
using LegalService.API.DTOs.Requests;
using LegalService.API.DTOs.Responses;
using LegalService.API.Infrastructure;
using LegalService.API.Models.Entities;
using Microsoft.EntityFrameworkCore;
namespace LegalService.API.Services.Lawyers;
public sealed class CatalogService(ApplicationDbContext db)
{
    public async Task<List<CatalogResponse>> ListAsync(bool services, CancellationToken ct) => services
        ? await db.LegalServices.AsNoTracking().OrderBy(s => s.ServiceName).Select(s => new CatalogResponse(s.LegalServiceId, s.ServiceName, s.Description, s.Category)).ToListAsync(ct)
        : await db.Specializations.AsNoTracking().OrderBy(s => s.Name).Select(s => new CatalogResponse(s.SpecializationId, s.Name, s.Description, null)).ToListAsync(ct);
    public async Task<CatalogResponse> GetAsync(bool services, int id, CancellationToken ct) => services
        ? await db.LegalServices.AsNoTracking().Where(s => s.LegalServiceId == id).Select(s => new CatalogResponse(s.LegalServiceId, s.ServiceName, s.Description, s.Category)).SingleOrDefaultAsync(ct) ?? throw new ApiException(404, "Legal service not found.")
        : await db.Specializations.AsNoTracking().Where(s => s.SpecializationId == id).Select(s => new CatalogResponse(s.SpecializationId, s.Name, s.Description, null)).SingleOrDefaultAsync(ct) ?? throw new ApiException(404, "Specialization not found.");
    public async Task<CatalogResponse> SaveAsync(bool services, int? id, CatalogRequest r, CancellationToken ct)
    {
        LawyerService.Validate(r);
        var name = r.Name.Trim();
        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
        if (services)
        {
            var s = id.HasValue ? await db.LegalServices.FindAsync([id.Value], ct) ?? throw new ApiException(404, "Legal service not found.") : new Models.Entities.LegalService();
            if (await db.LegalServices.AnyAsync(x => x.LegalServiceId != (id ?? 0) && x.ServiceName.ToLower() == name.ToLower(), ct)) throw new ApiException(409, "Name already exists.");
            s.ServiceName = name; s.Description = r.Description.Trim(); s.Category = r.Category.Trim(); s.UpdatedAt = DateTime.UtcNow;
            if (!id.HasValue) db.LegalServices.Add(s);
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return new(s.LegalServiceId, s.ServiceName, s.Description, s.Category);
        }
        else
        {
            var s = id.HasValue ? await db.Specializations.FindAsync([id.Value], ct) ?? throw new ApiException(404, "Specialization not found.") : new Specialization();
            if (await db.Specializations.AnyAsync(x => x.SpecializationId != (id ?? 0) && x.Name.ToLower() == name.ToLower(), ct)) throw new ApiException(409, "Name already exists.");
            s.Name = name; s.Description = r.Description.Trim();
            if (!id.HasValue) db.Specializations.Add(s);
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return new(s.SpecializationId, s.Name, s.Description);
        }
    }
    public async Task DeleteAsync(bool services, int id, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
        if (services)
        {
            var s = await db.LegalServices.FindAsync([id], ct) ?? throw new ApiException(404, "Legal service not found.");
            if (await db.LawyerLegalServices.AnyAsync(x => x.LegalServiceId == id, ct)) throw new ApiException(409, "Service is assigned to lawyers. Remove associations first.");
            db.LegalServices.Remove(s);
        }
        else
        {
            var s = await db.Specializations.FindAsync([id], ct) ?? throw new ApiException(404, "Specialization not found.");
            if (await db.LawyerSpecializations.AnyAsync(x => x.SpecializationId == id, ct)) throw new ApiException(409, "Specialization is assigned to lawyers. Remove associations first.");
            db.Specializations.Remove(s);
        }
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
}
