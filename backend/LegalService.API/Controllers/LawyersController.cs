using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using LegalService.API.Authentication.Services;
using LegalService.API.Data;
using LegalService.API.DTOs.Requests;
using LegalService.API.Interfaces;
using LegalService.API.Models.Entities;

namespace LegalService.API.Controllers;

[ApiController]
[Route("api/lawyers")]
public class LawyersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAppointmentService _appointmentService;
    private readonly IPasswordService _passwordService;

    public LawyersController(
        ApplicationDbContext context,
        IAppointmentService appointmentService,
        IPasswordService passwordService)
    {
        _context = context;
        _appointmentService = appointmentService;
        _passwordService = passwordService;
    }

    /// <summary>
    /// Get all lawyers, optionally filtered by specialization name, ID, or text search.
    /// </summary>
    [HttpGet]
    [HttpGet("search")]
    public async Task<IActionResult> GetLawyers(
        [FromQuery] string? specialization,
        [FromQuery] string? search,
        [FromQuery] DateOnly? date = null,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        var paged = page.HasValue || pageSize.HasValue;
        var currentPage = page ?? 1;
        var size = pageSize ?? 10;
        if (paged && (currentPage < 1 || size < 1 || size > 100 || currentPage > int.MaxValue / size))
            return BadRequest(new { message = "Page must be positive and pageSize must be between 1 and 100." });

        var query = _context.Lawyers
            .Include(l => l.LawyerSpecializations)
                .ThenInclude(ls => ls.Specialization)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(specialization) && specialization != "All")
        {
            var filter = specialization.Trim().ToLowerInvariant();
            if (int.TryParse(filter, out int specId))
            {
                query = query.Where(l => l.LawyerSpecializations.Any(ls => ls.SpecializationId == specId));
            }
            else
            {
                query = query.Where(l => l.LawyerSpecializations.Any(ls => 
                    ls.Specialization.Name.ToLower() == filter || 
                    ls.Specialization.Name.ToLower().Contains(filter)));
            }
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLowerInvariant();
            query = query.Where(l =>
                l.Name.ToLower().Contains(s) ||
                (l.Email != null && l.Email.ToLower().Contains(s)) ||
                l.Qualification.ToLower().Contains(s) ||
                l.ProfileDescription.ToLower().Contains(s) ||
                l.LicenseNumber.ToLower().Contains(s) ||
                l.LawyerSpecializations.Any(ls => ls.Specialization.Name.ToLower().Contains(s)));
        }

        if (date.HasValue)
            query = query.Where(l => l.Status == "Active" && l.LawyerAvailabilities.Any(a =>
                a.Date == date.Value && a.AvailabilitySlots.Any(slot => !slot.IsBooked)));

        var totalItems = paged ? await query.CountAsync() : 0;
        var totalLawyers = paged ? await _context.Lawyers.CountAsync() : 0;
        IQueryable<Lawyer> ordered = query.OrderBy(l => l.Name).ThenBy(l => l.LawyerId);
        if (paged)
            ordered = ordered.Skip((currentPage - 1) * size).Take(size);

        var lawyers = await ordered
            .Select(l => new
            {
                lawyerId = l.LawyerId,
                name = string.IsNullOrWhiteSpace(l.Name) ? l.Qualification : l.Name,
                email = l.Email,
                phoneNumber = l.PhoneNumber,
                qualification = l.Qualification,
                experience = l.Experience,
                licenseNumber = l.LicenseNumber,
                profileDescription = l.ProfileDescription,
                status = l.Status,
                specializations = l.LawyerSpecializations.Select(ls => new
                {
                    specializationId = ls.SpecializationId,
                    name = ls.Specialization.Name,
                    description = ls.Specialization.Description
                }).ToList()
            })
            .ToListAsync();

        if (!paged) return Ok(lawyers);

        return Ok(new
        {
            items = lawyers,
            page = currentPage,
            pageSize = size,
            totalItems,
            totalPages = totalItems / size + (totalItems % size == 0 ? 0 : 1),
            totalLawyers
        });
    }

    /// <summary>
    /// Get lawyer by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetLawyerById(Guid id)
    {
        var lawyer = await _context.Lawyers
            .Include(l => l.LawyerSpecializations)
                .ThenInclude(ls => ls.Specialization)
            .AsNoTracking()
            .Include(l => l.LawyerLegalServices).ThenInclude(ls => ls.LegalService)
            .FirstOrDefaultAsync(l => l.LawyerId == id);

        if (lawyer == null)
            return NotFound(new { message = $"Lawyer with ID '{id}' not found." });

        return Ok(new
        {
            lawyerId = lawyer.LawyerId,
            name = string.IsNullOrWhiteSpace(lawyer.Name) ? lawyer.Qualification : lawyer.Name,
            email = lawyer.Email,
            phoneNumber = lawyer.PhoneNumber,
            qualification = lawyer.Qualification,
            experience = lawyer.Experience,
            licenseNumber = lawyer.LicenseNumber,
            profileDescription = lawyer.ProfileDescription,
            status = lawyer.Status,
            legalServices = lawyer.LawyerLegalServices.Select(ls => new
            {
                legalServiceId = ls.LegalServiceId, serviceName = ls.LegalService.ServiceName,
                description = ls.LegalService.Description, category = ls.LegalService.Category
            }).ToList(),
            specializations = lawyer.LawyerSpecializations.Select(ls => new
            {
                specializationId = ls.SpecializationId,
                name = ls.Specialization.Name,
                description = ls.Specialization.Description
            }).ToList()
        });
    }

    /// <summary>
    /// Get lawyer by email.
    /// </summary>
    [HttpGet("by-email/{email}")]
    public async Task<IActionResult> GetLawyerByEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return BadRequest(new { message = "Email is required." });

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var lawyer = await _context.Lawyers
            .Include(l => l.LawyerSpecializations)
                .ThenInclude(ls => ls.Specialization)
            .AsNoTracking()
            .FirstOrDefaultAsync(l => l.Email != null && l.Email.ToLower() == normalizedEmail);

        if (lawyer == null)
            return NotFound(new { message = $"No lawyer registered with email '{email}'." });

        return Ok(new
        {
            lawyerId = lawyer.LawyerId,
            name = string.IsNullOrWhiteSpace(lawyer.Name) ? lawyer.Qualification : lawyer.Name,
            email = lawyer.Email,
            phoneNumber = lawyer.PhoneNumber,
            qualification = lawyer.Qualification,
            experience = lawyer.Experience,
            licenseNumber = lawyer.LicenseNumber,
            profileDescription = lawyer.ProfileDescription,
            status = lawyer.Status,
            specializations = lawyer.LawyerSpecializations.Select(ls => new
            {
                specializationId = ls.SpecializationId,
                name = ls.Specialization.Name,
                description = ls.Specialization.Description
            }).ToList()
        });
    }

    /// <summary>
    /// Add a new lawyer with one designated specialization category and create their login account.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateLawyer([FromBody] CreateLawyerRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var normalizedLicense = request.LicenseNumber.Trim().ToUpperInvariant();

        // 1. Verify email uniqueness
        if (await _context.Lawyers.AnyAsync(l => l.Email != null && l.Email.ToLower() == normalizedEmail))
        {
            return Conflict(new { message = $"A lawyer with email '{request.Email}' already exists in the system." });
        }

        // 2. Verify license number uniqueness
        if (await _context.Lawyers.AnyAsync(l => l.LicenseNumber.ToUpper() == normalizedLicense))
        {
            return Conflict(new { message = $"A lawyer with Bar/License number '{request.LicenseNumber}' already exists." });
        }

        if (await _context.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail) ||
            await _context.Clerks.AnyAsync(c => c.Email != null && c.Email.ToLower() == normalizedEmail))
            return Conflict(new { message = "This email already belongs to an account." });

        var specialization = await ResolveSpecialization(request);
        if (specialization == null)
            return BadRequest(new { message = "Select an existing specialization." });

        // 4. Create Lawyer record
        var lawyer = new Lawyer
        {
            LawyerId = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Email = normalizedEmail,
            PhoneNumber = request.PhoneNumber?.Trim() ?? string.Empty,
            Qualification = string.IsNullOrWhiteSpace(request.Qualification) ? "LL.B Attorney-at-Law" : request.Qualification.Trim(),
            Experience = request.Experience,
            LicenseNumber = request.LicenseNumber.Trim(),
            ProfileDescription = request.ProfileDescription?.Trim() ?? string.Empty,
            Status = "Active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Lawyers.Add(lawyer);

        // 5. Associate the single category (Many-to-Many bridge with 1 record)
        _context.LawyerSpecializations.Add(new LawyerSpecialization
        {
            LawyerId = lawyer.LawyerId,
            SpecializationId = specialization.SpecializationId
        });

        // 6. Create a new Lawyer account; never repurpose an existing identity.
        var initialPassword = !string.IsNullOrWhiteSpace(request.Password) ? request.Password : "LawyerPassword123!";
        var passwordHash = _passwordService.HashPassword(initialPassword);

        _context.Users.Add(new User
        {
            Name = lawyer.Name, Email = normalizedEmail, Role = "Lawyer",
            PasswordHash = passwordHash, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        var responseDto = new
        {
            lawyerId = lawyer.LawyerId,
            name = lawyer.Name,
            email = lawyer.Email,
            phoneNumber = lawyer.PhoneNumber,
            qualification = lawyer.Qualification,
            experience = lawyer.Experience,
            licenseNumber = lawyer.LicenseNumber,
            profileDescription = lawyer.ProfileDescription,
            status = lawyer.Status,
            specializations = new[]
            {
                new
                {
                    specializationId = specialization.SpecializationId,
                    name = specialization.Name,
                    description = specialization.Description
                }
            }
        };

        return CreatedAtAction(nameof(GetLawyerById), new { id = lawyer.LawyerId }, responseDto);
    }

    /// <summary>
    /// Delete a lawyer and their associated schedules and records.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteLawyer(Guid id)
    {
        var lawyer = await _context.Lawyers
            .Include(l => l.LawyerSpecializations)
            .Include(l => l.AvailabilitySlots)
            .Include(l => l.LawyerAvailabilities)
            .FirstOrDefaultAsync(l => l.LawyerId == id);

        if (lawyer == null)
            return NotFound(new { message = $"Lawyer with ID '{id}' not found." });

        // Preserve all appointment history and the booking module's restrictive foreign keys.
        var hasAppointments = await _context.Appointments
            .AnyAsync(a => a.LawyerId == id);

        if (hasAppointments)
        {
            return Conflict(new { message = "Cannot delete a lawyer with appointment history." });
        }

        // Remove slots & availabilities
        if (lawyer.AvailabilitySlots.Any())
            _context.AvailabilitySlots.RemoveRange(lawyer.AvailabilitySlots);

        if (lawyer.LawyerAvailabilities.Any())
            _context.LawyerAvailabilities.RemoveRange(lawyer.LawyerAvailabilities);

        if (lawyer.LawyerSpecializations.Any())
            _context.LawyerSpecializations.RemoveRange(lawyer.LawyerSpecializations);

        _context.Lawyers.Remove(lawyer);
        await _context.SaveChangesAsync();

        return Ok(new { message = $"Lawyer '{lawyer.Name}' removed successfully." });
    }

    /// <summary>
    /// Get all law specializations with lawyer counts.
    /// </summary>
    [HttpGet("specializations")]
    [HttpGet("/api/specializations")]
    public async Task<IActionResult> GetSpecializations()
    {
        var specializations = await _context.Specializations
            .Include(s => s.LawyerSpecializations)
            .AsNoTracking()
            .OrderBy(s => s.SpecializationId)
            .Select(s => new
            {
                specializationId = s.SpecializationId,
                name = s.Name,
                description = s.Description,
                lawyerCount = s.LawyerSpecializations.Count,
                legalServiceCount = _context.LegalServices.Count(service => service.Category.ToLower() == s.Name.ToLower())
            })
            .ToListAsync();

        return Ok(specializations);
    }

    /// <summary>
    /// Get available appointment slots for a lawyer on a given date.
    /// </summary>
    [HttpGet("{id:guid}/slots")]
    public async Task<IActionResult> GetLawyerSlots(Guid id, [FromQuery] string? date)
    {
        DateOnly queryDate;
        if (!string.IsNullOrWhiteSpace(date) && DateOnly.TryParse(date, out var parsedDate))
        {
            queryDate = parsedDate;
        }
        else
        {
            queryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));
        }

        var slots = await _appointmentService.GetAvailableSlotsAsync(id, queryDate);
        return Ok(slots);
    }
    private Task<Specialization?> ResolveSpecialization(UpdateLawyerRequest request)
    {
        if (request.SpecializationId.HasValue)
            return _context.Specializations.SingleOrDefaultAsync(s => s.SpecializationId == request.SpecializationId);
        var name = (request.Category ?? "").Trim().ToLowerInvariant();
        return _context.Specializations.SingleOrDefaultAsync(s => s.Name.ToLower() == name);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateLawyer(Guid id, UpdateLawyerRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var lawyer = await _context.Lawyers.Include(l => l.LawyerSpecializations)
            .SingleOrDefaultAsync(l => l.LawyerId == id);
        if (lawyer == null) return NotFound(new { message = "Lawyer not found." });
        var specialization = await ResolveSpecialization(request);
        if (specialization == null) return BadRequest(new { message = "Select an existing specialization." });
        var email = request.Email.Trim().ToLowerInvariant();
        var license = request.LicenseNumber.Trim().ToUpperInvariant();
        var previousEmail = lawyer.Email?.ToLowerInvariant();
        var account = await _context.Users.SingleOrDefaultAsync(u => u.Email.ToLower() == previousEmail);
        if (account != null && account.Role != "Lawyer")
            return Conflict(new { message = "The linked account is not a Lawyer account. Resolve the account association first." });
        var linkedAccountId = account?.UserId ?? -1;
        if (await _context.Lawyers.AnyAsync(l => l.LawyerId != id && l.Email != null && l.Email.ToLower() == email) ||
            await _context.Users.AnyAsync(u => u.Email.ToLower() == email && u.UserId != linkedAccountId) ||
            await _context.Clerks.AnyAsync(c => c.Email != null && c.Email.ToLower() == email))
            return Conflict(new { message = "This email already belongs to another account." });
        if (await _context.Lawyers.AnyAsync(l => l.LawyerId != id && l.LicenseNumber.ToUpper() == license))
            return Conflict(new { message = "This license number already belongs to another lawyer." });

        lawyer.Name = request.Name.Trim();
        lawyer.Email = email;
        lawyer.PhoneNumber = request.PhoneNumber?.Trim() ?? "";
        lawyer.Qualification = request.Qualification?.Trim() ?? "";
        lawyer.Experience = request.Experience;
        lawyer.LicenseNumber = request.LicenseNumber.Trim();
        lawyer.ProfileDescription = request.ProfileDescription?.Trim() ?? "";
        lawyer.UpdatedAt = DateTime.UtcNow;
        _context.LawyerSpecializations.RemoveRange(lawyer.LawyerSpecializations.Where(s => s.SpecializationId != specialization.SpecializationId));
        if (!lawyer.LawyerSpecializations.Any(s => s.SpecializationId == specialization.SpecializationId))
            _context.LawyerSpecializations.Add(new LawyerSpecialization { LawyerId = id, SpecializationId = specialization.SpecializationId });
        if (account != null)
        {
            account.Name = lawyer.Name;
            account.Email = email;
            account.UpdatedAt = DateTime.UtcNow;
        }
        await _context.SaveChangesAsync();
        // Reload after relationship changes so the response reflects only current assignments.
        _context.ChangeTracker.Clear();
        return await GetLawyerById(id);
    }

    [HttpGet("{id:guid}/availability")]
    public async Task<IActionResult> GetAvailability(Guid id, [FromQuery] DateOnly? date = null)
    {
        var lawyer = await _context.Lawyers.AsNoTracking().SingleOrDefaultAsync(l => l.LawyerId == id);
        if (lawyer == null) return NotFound(new { message = "Lawyer not found." });
        var query = _context.AvailabilitySlots.AsNoTracking().Where(s =>
            s.LawyerAvailability.LawyerId == id && !s.IsBooked && lawyer.Status == "Active");
        if (date.HasValue) query = query.Where(s => s.LawyerAvailability.Date == date.Value);
        else
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            query = query.Where(s => s.LawyerAvailability.Date >= today);
        }
        return Ok(await query.OrderBy(s => s.LawyerAvailability.Date).ThenBy(s => s.StartTime)
            .Select(s => new LegalService.API.DTOs.Appointments.AvailabilitySlotResponse
            {
                SlotId = s.SlotId, AvailabilityId = s.AvailabilityId, Date = s.LawyerAvailability.Date,
                StartTime = s.StartTime, EndTime = s.EndTime, IsBooked = s.IsBooked
            }).ToListAsync());
    }

}
