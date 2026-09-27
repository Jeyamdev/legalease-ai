using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using LegalService.API.Authentication.Services;
using LegalService.API.Controllers;
using LegalService.API.Data;
using LegalService.API.DTOs.Requests;
using LegalService.API.Interfaces;
using LegalService.API.Models.Entities;
using LegalService.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace LegalService.Tests;

// Real HTTP routing, JWT authentication, authorization and MVC validation with an isolated DB.
// This host never invokes production startup, database seeding or Gemini.
public sealed class LawyerManagementHttpTests : IAsyncLifetime
{
    private WebApplication _app = null!;
    private HttpClient _client = null!;
    private const string Key = "member1-test-signing-key-only-12345678901234567890";
    private readonly Guid _lawyerId = Guid.NewGuid();
    private readonly DateOnly _date = new(2030, 1, 5);
    private int _specId;
    private int _otherSpecId;
    private int _userId;

    public async Task InitializeAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Logging.ClearProviders();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = Key, ["Jwt:Issuer"] = "member1-tests", ["Jwt:Audience"] = "member1-tests", ["Jwt:ExpiryMinutes"] = "10"
        });
        builder.Services.AddControllers().AddApplicationPart(typeof(LawyersController).Assembly);
        var databaseName = Guid.NewGuid().ToString();
        builder.Services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(databaseName));
        builder.Services.AddScoped<IAppointmentService, AppointmentService>();
        builder.Services.AddScoped<IPasswordService, PasswordService>();
        builder.Services.AddScoped<JwtService>();
        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
            o.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true, ValidIssuer = "member1-tests", ValidateAudience = true, ValidAudience = "member1-tests",
                ValidateLifetime = true, ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Key))
            });
        builder.Services.AddAuthorization();
        _app = builder.Build();
        _app.UseAuthentication();
        _app.UseAuthorization();
        _app.MapControllers();
        await _app.StartAsync();
        var address = _app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
        _client = new HttpClient { BaseAddress = new Uri(address) };
        using var scope = _app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var spec = new Specialization { Name = "Property", Description = "Recorded property description" };
        var other = new Specialization { Name = "Employment" };
        db.Specializations.AddRange(spec, other);
        var user = new User { Name = "Original", Email = "original@example.test", Role = "Lawyer", PasswordHash = "preserve-me" };
        db.Users.Add(user);
        db.Lawyers.Add(new Lawyer
        {
            LawyerId = _lawyerId, Name = "Original", Email = user.Email, LicenseNumber = "BAR-1", Status = "Active",
            LawyerSpecializations = [new LawyerSpecialization { Specialization = spec }]
        });
        db.LegalServices.Add(new() { ServiceName = "Property consultation", Category = "Property", Description = "Recorded service description" });
        db.LawyerAvailabilities.Add(new LawyerAvailability
        {
            AvailabilityId = Guid.NewGuid(), LawyerId = _lawyerId, Date = _date, StartTime = new(9, 0), EndTime = new(10, 0),
            AvailabilitySlots = [new AvailabilitySlot { SlotId = Guid.NewGuid(), StartTime = new(9, 0), EndTime = new(9, 30) },
                new AvailabilitySlot { SlotId = Guid.NewGuid(), StartTime = new(9, 30), EndTime = new(10, 0), IsBooked = true }]
        });
        await db.SaveChangesAsync();
        _specId = spec.SpecializationId; _otherSpecId = other.SpecializationId; _userId = user.UserId;
    }

    private void SignIn(string? role)
    {
        _client.DefaultRequestHeaders.Authorization = null;
        if (role == null) return;
        using var scope = _app.Services.CreateScope();
        var jwt = scope.ServiceProvider.GetRequiredService<JwtService>().GenerateToken(99, "tester@example.test", role);
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
    }
    private CreateLawyerRequest Payload() => new()
    {
        Name = "Updated lawyer", Email = "updated@example.test", LicenseNumber = "BAR-2", Experience = 12,
        SpecializationId = _otherSpecId, Qualification = "LLB", ProfileDescription = "Profile", PhoneNumber = "123"
    };

    [Theory]
    [InlineData(null, 401)]
    [InlineData("Customer", 403)]
    [InlineData("Lawyer", 403)]
    [InlineData("Clerk", 403)]
    public async Task NonAdminsCannotManageLawyersOrSpecializations(string? role, int status)
    {
        SignIn(role);
        Assert.Equal(status, (int)(await _client.PostAsJsonAsync("/api/lawyers", Payload())).StatusCode);
        Assert.Equal(status, (int)(await _client.PutAsJsonAsync($"/api/lawyers/{_lawyerId}", Payload())).StatusCode);
        Assert.Equal(status, (int)(await _client.DeleteAsync($"/api/lawyers/{_lawyerId}")).StatusCode);
        Assert.Equal(status, (int)(await _client.PostAsJsonAsync("/api/specializations", new { name = "New" })).StatusCode);
        Assert.Equal(status, (int)(await _client.PutAsJsonAsync($"/api/specializations/{_specId}", new { name = "New" })).StatusCode);
        Assert.Equal(status, (int)(await _client.DeleteAsync($"/api/specializations/{_specId}")).StatusCode);
    }

    [Fact]
    public async Task AdminCanCreateLawyerAndLawyerAccount()
    {
        SignIn("Admin");
        var response = await _client.PostAsJsonAsync("/api/lawyers", Payload());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Updated lawyer", json.GetProperty("name").GetString());
        using var scope = _app.Services.CreateScope();
        var user = await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Users.SingleAsync(u => u.Email == "updated@example.test");
        Assert.Equal("Lawyer", user.Role);
        Assert.NotEmpty(user.PasswordHash!);
    }

    [Fact]
    public async Task AdminCanUpdateAndPreserveAccountSecurity()
    {
        SignIn("Admin");
        var payload = JsonSerializer.SerializeToNode(Payload())!;
        payload["Password"] = "must-not-change"; payload["Role"] = "Admin"; payload["UserId"] = 500;
        var response = await _client.PutAsJsonAsync($"/api/lawyers/{_lawyerId}", payload);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(_lawyerId, json.GetProperty("lawyerId").GetGuid());
        Assert.Equal(_otherSpecId, json.GetProperty("specializations")[0].GetProperty("specializationId").GetInt32());
        using var scope = _app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var account = await db.Users.FindAsync(_userId);
        Assert.Equal("updated@example.test", account!.Email);
        Assert.Equal("Updated lawyer", account.Name);
        Assert.Equal("Lawyer", account.Role);
        Assert.Equal("preserve-me", account.PasswordHash);
        Assert.Single(await db.LawyerSpecializations.Where(s => s.LawyerId == _lawyerId).ToListAsync());
    }

    [Fact]
    public async Task InvalidSpecializationAndMissingLawyerAreRejected()
    {
        SignIn("Admin"); var payload = Payload(); payload.SpecializationId = 99999;
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PutAsJsonAsync($"/api/lawyers/{_lawyerId}", payload)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.PutAsJsonAsync($"/api/lawyers/{Guid.NewGuid()}", Payload())).StatusCode);
    }

    [Theory]
    [InlineData(-1, "Name", "BAR")]
    [InlineData(71, "Name", "BAR")]
    [InlineData(2, " ", "BAR")]
    [InlineData(2, "Name", " ")]
    public async Task InvalidFieldsReturn400(int experience, string name, string license)
    {
        SignIn("Admin"); var payload = Payload(); payload.Experience = experience; payload.Name = name; payload.LicenseNumber = license;
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PutAsJsonAsync($"/api/lawyers/{_lawyerId}", payload)).StatusCode);
    }

    [Fact]
    public async Task CannotCreateOverExistingAccountOrUseDuplicateEmailOrLicense()
    {
        SignIn("Admin");
        using var scope = _app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Users.Add(new User { Name = "Customer", Email = "customer@example.test", Role = "Customer" });
        db.Lawyers.Add(new Lawyer { LawyerId = Guid.NewGuid(), Name = "Other", Email = "other@example.test", LicenseNumber = "OTHER" });
        await db.SaveChangesAsync();
        var payload = Payload(); payload.Email = "customer@example.test";
        Assert.Equal(HttpStatusCode.Conflict, (await _client.PostAsJsonAsync("/api/lawyers", payload)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await _client.PutAsJsonAsync($"/api/lawyers/{_lawyerId}", payload)).StatusCode);
        payload.Email = "other@example.test";
        Assert.Equal(HttpStatusCode.Conflict, (await _client.PutAsJsonAsync($"/api/lawyers/{_lawyerId}", payload)).StatusCode);
        payload.Email = "unique@example.test"; payload.LicenseNumber = "other";
        Assert.Equal(HttpStatusCode.Conflict, (await _client.PutAsJsonAsync($"/api/lawyers/{_lawyerId}", payload)).StatusCode);
        Assert.Equal("Customer", (await db.Users.SingleAsync(u => u.Email == "customer@example.test")).Role);
    }

    [Fact]
    public async Task AdminCanDeleteLawyer()
    {
        SignIn("Admin");
        Assert.Equal(HttpStatusCode.OK, (await _client.DeleteAsync($"/api/lawyers/{_lawyerId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/lawyers/{_lawyerId}")).StatusCode);
    }

    [Fact]
    public async Task PublicRoutesSearchAndAliasesReturnRecordedData()
    {
        var oldSpecs = await _client.GetFromJsonAsync<JsonElement>("/api/lawyers/specializations");
        var newSpecs = await _client.GetFromJsonAsync<JsonElement>("/api/specializations");
        Assert.Equal(oldSpecs.GetRawText(), newSpecs.GetRawText());
        var services = await _client.GetFromJsonAsync<JsonElement>("/api/legal-services");
        Assert.Equal("Property consultation", services[0].GetProperty("serviceName").GetString());
        var oldSearch = await _client.GetFromJsonAsync<JsonElement>($"/api/lawyers?specialization={_specId}&search=original&date=2030-01-05");
        var search = await _client.GetFromJsonAsync<JsonElement>($"/api/lawyers/search?specialization={_specId}&search=original&date=2030-01-05");
        Assert.Equal(oldSearch.GetRawText(), search.GetRawText());
        Assert.Equal(_lawyerId, search[0].GetProperty("lawyerId").GetGuid());
        var empty = await _client.GetFromJsonAsync<JsonElement>($"/api/lawyers/search?specialization={_otherSpecId}");
        Assert.Equal(0, empty.GetArrayLength());
        empty = await _client.GetFromJsonAsync<JsonElement>("/api/lawyers/search?date=2030-01-06");
        Assert.Equal(0, empty.GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.GetAsync("/api/lawyers/search?date=invalid")).StatusCode);
    }

    [Fact]
    public async Task AvailabilityReturnsOnlyRecordedUnbookedSlotsWithoutCreatingDefaults()
    {
        var slots = await _client.GetFromJsonAsync<JsonElement>($"/api/lawyers/{_lawyerId}/availability?date=2030-01-05");
        Assert.Equal(1, slots.GetArrayLength());
        Assert.False(slots[0].GetProperty("isBooked").GetBoolean());
        var empty = await _client.GetFromJsonAsync<JsonElement>($"/api/lawyers/{_lawyerId}/availability?date=2030-01-06");
        Assert.Equal(0, empty.GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/lawyers/{Guid.NewGuid()}/availability")).StatusCode);
        using var scope = _app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(1, await db.LawyerAvailabilities.CountAsync());
        var lawyer = await db.Lawyers.FindAsync(_lawyerId); lawyer!.Status = "Inactive"; await db.SaveChangesAsync();
        empty = await _client.GetFromJsonAsync<JsonElement>($"/api/lawyers/{_lawyerId}/availability?date=2030-01-05");
        Assert.Equal(0, empty.GetArrayLength());
        empty = await _client.GetFromJsonAsync<JsonElement>("/api/lawyers/search?date=2030-01-05");
        Assert.Equal(0, empty.GetArrayLength());
    }

    [Fact]
    public async Task AdminManagesSpecializationsButCannotDeleteReferencedRecords()
    {
        SignIn("Admin");
        var create = await _client.PostAsJsonAsync("/api/specializations", new { name = "New field", description = "Actual description" });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var id = (await create.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("specializationId").GetInt32();
        Assert.Equal(HttpStatusCode.OK, (await _client.PutAsJsonAsync($"/api/specializations/{id}", new { name = "Renamed", description = "Updated" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await _client.DeleteAsync($"/api/specializations/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await _client.DeleteAsync($"/api/specializations/{_specId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await _client.PostAsJsonAsync("/api/specializations", new { name = "PROPERTY" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync("/api/specializations", new { name = " " })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.PutAsJsonAsync($"/api/specializations/{_specId}", new { name = "Property renamed" })).StatusCode);
        var services = await _client.GetFromJsonAsync<JsonElement>("/api/legal-services");
        Assert.Equal("Property renamed", services[0].GetProperty("category").GetString());
        using var scope = _app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await DbInitializer.SeedCategoriesAsync(db);
        Assert.Equal(2, await db.Specializations.CountAsync());
    }

    [Fact]
    public async Task LegacyCategoryPayloadAndSlotsRouteRemainCompatible()
    {
        SignIn("Admin");
        var payload = Payload(); payload.SpecializationId = null; payload.Category = "Property";
        Assert.Equal(HttpStatusCode.OK, (await _client.PutAsJsonAsync($"/api/lawyers/{_lawyerId}", payload)).StatusCode);
        var profile = await _client.GetFromJsonAsync<JsonElement>($"/api/lawyers/{_lawyerId}");
        Assert.Equal(_specId, profile.GetProperty("specializations")[0].GetProperty("specializationId").GetInt32());
        var slots = await _client.GetFromJsonAsync<JsonElement>($"/api/lawyers/{_lawyerId}/slots?date=2030-01-05");
        Assert.Equal(1, slots.GetArrayLength());
        payload.Category = "";
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PutAsJsonAsync($"/api/lawyers/{_lawyerId}", payload)).StatusCode);
    }

    [Fact]
    public async Task UpdatingDirectoryOnlyLawyerDoesNotCreateAnAccount()
    {
        SignIn("Admin");
        using var scope = _app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Users.Remove((await db.Users.FindAsync(_userId))!); await db.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.OK, (await _client.PutAsJsonAsync($"/api/lawyers/{_lawyerId}", Payload())).StatusCode);
        Assert.Equal(0, await db.Users.CountAsync());
    }

    [Fact]
    public async Task LawyerWithAppointmentHistoryCannotBeDeleted()
    {
        SignIn("Admin");
        using var scope = _app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var slot = await db.AvailabilitySlots.FirstAsync();
        db.Appointments.Add(new Appointment { AppointmentId = Guid.NewGuid(), LawyerId = _lawyerId,
            SlotId = slot.SlotId, CustomerId = Guid.NewGuid(), Status = "Completed" });
        await db.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.Conflict, (await _client.DeleteAsync($"/api/lawyers/{_lawyerId}")).StatusCode);
        Assert.Equal(1, await db.Appointments.CountAsync());
    }

    [Fact]
    public async Task ProfileIncludesOnlyRecordedLegalServices()
    {
        using var scope = _app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var service = await db.LegalServices.SingleAsync();
        db.LawyerLegalServices.Add(new LawyerLegalService { LawyerId = _lawyerId, LegalServiceId = service.LegalServiceId });
        await db.SaveChangesAsync();
        var profile = await _client.GetFromJsonAsync<JsonElement>($"/api/lawyers/{_lawyerId}");
        Assert.Equal(service.ServiceName, profile.GetProperty("legalServices")[0].GetProperty("serviceName").GetString());
        Assert.False(profile.TryGetProperty("passwordHash", out _));
    }

    [Theory]
    [InlineData(null, 401)]
    [InlineData("Customer", 403)]
    public async Task DedicatedRecommendationsRemainAdminAssisted(string? role, int status)
    {
        SignIn(role);
        Assert.Equal(status, (int)(await _client.PostAsJsonAsync("/api/lawyer-recommendations", new { requirement = "Property dispute" })).StatusCode);
        Assert.Equal(status, (int)(await _client.GetAsync($"/api/lawyer-recommendations/{Guid.NewGuid()}")).StatusCode);
        Assert.Equal(status, (int)(await _client.PostAsJsonAsync($"/api/lawyer-recommendations/{Guid.NewGuid()}/approve", new { })).StatusCode);
    }

    [Fact]
    public async Task FreshEfCatalogBootstrapPreservesDemoCategoriesAndLaterAdminChanges()
    {
        await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        await db.Database.EnsureCreatedAsync();
        await DbInitializer.SeedCategoriesAsync(db);
        Assert.Equal(6, await db.Specializations.CountAsync());
        Assert.True(await db.Specializations.AnyAsync(s => s.Name == "Corporate & Commercial Law"));
        Assert.True(await db.Specializations.AnyAsync(s => s.Name == "Family Law"));
        Assert.Equal("Corporate & Commercial Law", (await db.LegalServices.FindAsync(3))!.Category);
        var tax = await db.Specializations.SingleAsync(s => s.Name == "Tax Law");
        db.Specializations.Remove(tax);
        var property = await db.Specializations.SingleAsync(s => s.Name == "Real Estate & Property Law");
        property.Description = "Admin-authored description";
        await db.SaveChangesAsync();
        await DbInitializer.SeedCategoriesAsync(db);
        Assert.False(await db.Specializations.AnyAsync(s => s.Name == "Tax Law"));
        Assert.Equal("Admin-authored description", property.Description);
    }

    public async Task DisposeAsync()
    {
        _client?.Dispose();
        if (_app != null) await _app.DisposeAsync();
    }
}
