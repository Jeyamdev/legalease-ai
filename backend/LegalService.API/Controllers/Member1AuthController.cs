using System.ComponentModel.DataAnnotations;
using LegalService.API.Authentication.Services;
using LegalService.API.Data;
using LegalService.API.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LegalService.API.Controllers;

// Dedicated contract for the management UI; the team's /api/auth routes remain unchanged.
[ApiController, Route("api/member1/auth")]
public sealed class Member1AuthController(ApplicationDbContext db, IPasswordService passwords, TokenService tokens) : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register(Member1RegisterRequest request, CancellationToken ct)
    {
        if (request.Role != "Customer") return BadRequest("Public registration only supports Customer accounts.");
        var email = request.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email.ToLower() == email, ct)) return BadRequest("Email already exists");
        var user = new User { Name = request.FullName.Trim(), Email = email, Role = "Customer", PasswordHash = passwords.HashPassword(request.Password) };
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return Ok(new { userId = user.UserId, name = user.Name, email = user.Email, role = user.Role });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(Member1LoginRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(u => u.Email.ToLower() == email, ct);
        if (user is null || string.IsNullOrEmpty(user.PasswordHash) || !passwords.VerifyPassword(request.Password, user.PasswordHash)) return Unauthorized();
        return Ok(new { token = tokens.Create(user), userId = user.UserId, name = user.Name, email = user.Email, role = user.Role, roles = new[] { user.Role } });
    }
}
public class Member1LoginRequest
{
    [Required, EmailAddress, StringLength(254)] public string Email { get; set; } = "";
    [Required, StringLength(72)] public string Password { get; set; } = "";
}
public sealed class Member1RegisterRequest : Member1LoginRequest
{
    [Required, StringLength(200)] public string FullName { get; set; } = "";
    [Required, StringLength(72, MinimumLength = 12)] public new string Password { get; set; } = "";
    public string Role { get; set; } = "Customer";
}
