using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using LegalService.API.Authentication.Services;
using LegalService.API.Data;
using LegalService.API.DTOs.Requests;
using LegalService.API.DTOs.Responses;
using LegalService.API.Infrastructure;
using LegalService.API.Models.Entities;
using LegalService.API.Services.Lawyers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace LegalService.API.Tests;
public sealed class LawyerTests : IDisposable
{
    private readonly SqliteConnection connection = new("Data Source=:memory:");
    private readonly ApplicationDbContext db;
    private readonly LawyerService service;
    public LawyerTests()
    {
        connection.Open();
        db = new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options);
        db.Database.EnsureCreated(); service = new(db);
    }
    private static CreateManagedLawyerRequest Request(string name = "Test Lawyer", int experience = 7) => new()
    { Name = name, Email = $"{Guid.NewGuid()}@example.com", PhoneNumber = "+94771234567", Qualification = "LLB",
      LicenseNumber = Guid.NewGuid().ToString(), Experience = experience, SpecializationIds = [2], LegalServiceIds = [2] };
    [Fact] public async Task CreateRetrieveUpdateAndDeactivatePreservesIdentity()
    {
        var request = Request(); var created = await service.CreateAsync(request, default);
        Assert.Equal(request.Email, (await db.Lawyers.SingleAsync(l => l.LawyerId == created.LawyerId)).Email);
        Assert.Single(created.Specializations); Assert.Single(created.LegalServices);
        request.Name = "Updated Lawyer"; request.SpecializationIds = [1, 2];
        Assert.Equal("Updated Lawyer", (await service.UpdateAsync(created.LawyerId, request, default)).Name);
        await service.DeactivateAsync(created.LawyerId, default);
        Assert.Equal("Inactive", (await service.GetAsync(created.LawyerId, true, default)).Status);
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => service.GetAsync(created.LawyerId, false, default))).Status);
        Assert.True(await db.Lawyers.AnyAsync(l => l.LawyerId == created.LawyerId));
    }
    [Theory] [InlineData(-1)] [InlineData(101)] public async Task RejectInvalidExperience(int experience)
    { Assert.Equal(400, (await Assert.ThrowsAsync<ApiException>(() => service.CreateAsync(Request(experience: experience), default))).Status); }
    [Fact] public async Task RejectInvalidNameEmailAndLicense()
    {
        foreach (var field in new[] { "name", "email", "license" })
        {
            var r = Request(); if (field == "name") r.Name = " "; if (field == "email") r.Email = "invalid"; if (field == "license") r.LicenseNumber = "";
            Assert.Equal(400, (await Assert.ThrowsAsync<ApiException>(() => service.CreateAsync(r, default))).Status);
        }
    }
    [Fact] public async Task RejectUnknownAndDuplicateRelationships()
    {
        foreach (var ids in new[] { new[] { 999 }, new[] { 2, 2 } })
        { var r = Request(); r.SpecializationIds = ids; Assert.Equal(400, (await Assert.ThrowsAsync<ApiException>(() => service.CreateAsync(r, default))).Status); }
        var bad = Request(); bad.LegalServiceIds = [999];
        Assert.Equal(400, (await Assert.ThrowsAsync<ApiException>(() => service.CreateAsync(bad, default))).Status);
    }
    [Fact] public async Task UniqueLicenseAndEmail()
    {
        var r = Request(); await service.CreateAsync(r, default);
        var duplicate = Request(); duplicate.LicenseNumber = r.LicenseNumber;
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => service.CreateAsync(duplicate, default))).Status);
        duplicate.LicenseNumber = "another"; duplicate.Email = r.Email;
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => service.CreateAsync(duplicate, default))).Status);
    }
    [Fact] public async Task MissingLawyerReturns404()
    {
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => service.GetAsync(Guid.NewGuid(), true, default))).Status);
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => service.UpdateAsync(Guid.NewGuid(), Request(), default))).Status);
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => service.DeactivateAsync(Guid.NewGuid(), default))).Status);
    }
    [Fact] public async Task SearchCombinesFiltersPaginatesAndHandlesEmptyResults()
    {
        await service.CreateAsync(Request("Alice", 8), default);
        var bob = Request("Bob", 2); bob.SpecializationIds = [1]; await service.CreateAsync(bob, default);
        var result = await service.SearchAsync(new() { SpecializationId = 2, MinExperience = 5, LegalServiceId = 2, Search = "ALI", PageSize = 1 }, false, default);
        Assert.Equal("Alice", Assert.Single(result.Items).Name); Assert.Equal(1, result.TotalCount);
        Assert.Empty((await service.SearchAsync(new() { Search = "nobody" }, false, default)).Items);
        Assert.Empty((await service.SearchAsync(new() { SpecializationId = 1, MinExperience = 5 }, false, default)).Items);
        Assert.Single((await service.SearchAsync(new() { Page = 2, PageSize = 1 }, false, default)).Items);
    }
    [Fact] public async Task AvailabilityValidatesOverlapAndAllowsAdjacentPeriods()
    {
        var l = await service.CreateAsync(Request(), default);
        var r = new AvailabilityRequest { Date = new(2030, 1, 1), StartTime = new(9, 0), EndTime = new(10, 0) };
        var first = await service.SaveAvailabilityAsync(l.LawyerId, null, r, default);
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => service.SaveAvailabilityAsync(l.LawyerId, null, r, default))).Status);
        r.StartTime = new(9, 30); r.EndTime = new(11, 0);
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => service.SaveAvailabilityAsync(l.LawyerId, null, r, default))).Status);
        r.StartTime = new(10, 0); await service.SaveAvailabilityAsync(l.LawyerId, null, r, default);
        r.EndTime = new(9, 0);
        Assert.Equal(400, (await Assert.ThrowsAsync<ApiException>(() => service.SaveAvailabilityAsync(l.LawyerId, null, r, default))).Status);
        await service.DeleteAvailabilityAsync(l.LawyerId, first.AvailabilityId, default);
        Assert.Single(await service.AvailabilityAsync(l.LawyerId, false, default));
    }
    [Fact] public async Task AvailabilityWithMember2SlotsCannotBeChanged()
    {
        var l = await service.CreateAsync(Request(), default); var r = new AvailabilityRequest { Date = new(2030, 1, 1), StartTime = new(9, 0), EndTime = new(10, 0) };
        var a = await service.SaveAvailabilityAsync(l.LawyerId, null, r, default);
        db.AvailabilitySlots.Add(new() { SlotId = Guid.NewGuid(), AvailabilityId = a.AvailabilityId, StartTime = r.StartTime, EndTime = r.EndTime }); await db.SaveChangesAsync();
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => service.DeleteAvailabilityAsync(l.LawyerId, a.AvailabilityId, default))).Status);
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => service.SaveAvailabilityAsync(l.LawyerId, a.AvailabilityId, r, default))).Status);
    }
    [Fact] public async Task CatalogCrudAndAssignedDeleteProtection()
    {
        var catalog = new CatalogService(db); Assert.Equal(4, (await catalog.ListAsync(false, default)).Count);
        var s = await catalog.SaveAsync(false, null, new() { Name = "Tax Law" }, default);
        Assert.Equal("Tax Law", (await catalog.GetAsync(false, s.Id, default)).Name);
        await catalog.SaveAsync(false, s.Id, new() { Name = "Taxation" }, default);
        await catalog.DeleteAsync(false, s.Id, default);
        await service.CreateAsync(Request(), default);
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => catalog.DeleteAsync(false, 2, default))).Status);
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => catalog.DeleteAsync(true, 2, default))).Status);
    }
    [Fact] public async Task ExistingAccountAndRelationshipReplacementPreserveSharedData()
    {
        var user = new User { FullName = "Existing", Email = "existing@example.com", PasswordHash = "unchanged" };
        db.Users.Add(user); await db.SaveChangesAsync();
        var r = Request(); r.UserId = user.UserId; r.Email = user.Email;
        var l = await service.CreateAsync(r, default);
        Assert.Equal(user.Email, l.Email); Assert.Equal("unchanged", user.PasswordHash);
        r.SpecializationIds = [1]; r.LegalServiceIds = [];
        await service.UpdateAsync(l.LawyerId, r, default);
        await service.UpdateAsync(l.LawyerId, r, default);
        Assert.Single(await db.LawyerSpecializations.Where(s => s.LawyerId == l.LawyerId).ToListAsync());
        Assert.Empty(await db.LawyerLegalServices.Where(s => s.LawyerId == l.LawyerId).ToListAsync());
    }
    [Fact] public async Task DateFilteringAndAvailabilityUpdateRespectLawyerScope()
    {
        var l = await service.CreateAsync(Request(), default);
        var r = new AvailabilityRequest { Date = new(2030, 2, 1), StartTime = new(9, 0), EndTime = new(10, 0) };
        var a = await service.SaveAvailabilityAsync(l.LawyerId, null, r, default);
        r.EndTime = new(11, 0); await service.SaveAvailabilityAsync(l.LawyerId, a.AvailabilityId, r, default);
        Assert.Single((await service.SearchAsync(new() { Date = r.Date }, false, default)).Items);
        Assert.Empty((await service.SearchAsync(new() { Date = r.Date.AddDays(1) }, false, default)).Items);
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => service.DeleteAvailabilityAsync(Guid.NewGuid(), a.AvailabilityId, default))).Status);
    }
    public void Dispose() { db.Dispose(); connection.Dispose(); }
}

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection connection = new("Data Source=:memory:");
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        connection.Open();
        builder.UseEnvironment("Development");
        builder.UseSetting("Jwt:Key", "test-only-signing-key-at-least-32-bytes-long");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:Key"] = "test-only-signing-key-at-least-32-bytes-long" }));
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<ApplicationDbContext>(); services.RemoveAll<DbContextOptions<ApplicationDbContext>>();
            services.AddDbContext<ApplicationDbContext>(o => o.UseSqlite(connection));
        });
    }
    public void Initialize()
    {
        using var scope = Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(); db.Database.EnsureCreated();

        var user = new User { Role = "Admin", Email = "admin@example.com", FullName = "Test Admin", PasswordHash = BCrypt.Net.BCrypt.HashPassword("test-password-only") };
        db.Users.Add(user); db.SaveChanges();
    }
    protected override void Dispose(bool disposing) { base.Dispose(disposing); if (disposing) connection.Dispose(); }
}
public sealed class ApiTests
{
    [Fact]
    public async Task TeamLawyerAndLoginContractsRemainAvailable()
    {
        using var app = new ApiFactory(); app.Initialize(); using var client = app.CreateClient();
        var legacyLawyers = await client.GetAsync("/api/lawyers");
        legacyLawyers.EnsureSuccessStatusCode();
        var list = await legacyLawyers.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(System.Text.Json.JsonValueKind.Array, list.ValueKind);
        var managed = await client.GetAsync("/api/lawyer-management/search");
        managed.EnsureSuccessStatusCode();
        var page = await managed.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.True(page.TryGetProperty("items", out _));
        Assert.True(page.TryGetProperty("totalCount", out _));
        var legacyLogin = await client.PostAsJsonAsync("/api/auth/login", new { email = "admin@example.com", password = "test-password-only" });
        legacyLogin.EnsureSuccessStatusCode();
        var login = await legacyLogin.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal("Admin", login.GetProperty("role").GetString());
        Assert.True(login.GetProperty("userId").GetInt32() > 0);
        Assert.True(login.TryGetProperty("name", out _));
        Assert.True(login.TryGetProperty("token", out _));
    }

    [Fact] public async Task PublicReadAdminMutationValidationAndPrivilegeEscalation()
    {
        using var app = new ApiFactory(); app.Initialize(); using var client = app.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/specializations")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/lawyer-management", new {})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/member1/auth/register", new { fullName = "Attacker", email = "a@example.com", password = "long-password-test", role = "Admin" })).StatusCode);
        var login = await client.PostAsJsonAsync("/api/member1/auth/login", new { email = "admin@example.com", password = "test-password-only" }); login.EnsureSuccessStatusCode();
        var body = await login.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>(); client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.GetProperty("token").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/lawyer-management", new {})).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/lawyer-management/{Guid.NewGuid()}")).StatusCode);
        var create = await client.PostAsJsonAsync("/api/lawyer-management", new CreateManagedLawyerRequest { Name = "API Lawyer", Email = "lawyer@example.com", PhoneNumber = "+94771234567", Qualification = "LLB", LicenseNumber = "TEST-1" });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode); Assert.NotNull(create.Headers.Location);
        var lawyer = await create.Content.ReadFromJsonAsync<LawyerResponse>();
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/lawyer-management/{lawyer!.LawyerId}")).StatusCode);
        using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(); (await db.Users.SingleAsync(u => u.Email == "admin@example.com")).Role = "Customer"; await db.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/specializations", new { name = "Tax" })).StatusCode);
    }
}
