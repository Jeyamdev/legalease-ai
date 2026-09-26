using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using LegalService.API.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace LegalService.API.Tests;

public sealed class AuthenticationTests
{
    [Fact]
    public async Task CustomerRegistrationLoginAndDuplicateContract()
    {
        using var app = new ApiFactory();
        app.Initialize();
        using var client = app.CreateClient();
        var request = new { fullName = "Customer Test", email = "customer@example.com", password = "test-password-only", role = "Customer" };
        var registration = await client.PostAsJsonAsync("/api/member1/auth/register", request);
        Assert.Equal(HttpStatusCode.OK, registration.StatusCode);
        var registered = await registration.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Customer", registered.GetProperty("role").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/member1/auth/register", request)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/member1/auth/login", new { request.email, password = "incorrect" })).StatusCode);
        var login = await client.PostAsJsonAsync("/api/member1/auth/login", new { request.email, request.password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var body = await login.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(request.email, body.GetProperty("email").GetString());
        Assert.Equal("Customer", Assert.Single(body.GetProperty("roles").EnumerateArray()).GetString());
        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("token").GetString()));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.GetProperty("token").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/specializations", new { name = "Tax" })).StatusCode);
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.SingleAsync(u => u.Email == request.email);
        Assert.NotEqual(request.password, user.PasswordHash);
        Assert.True(BCrypt.Net.BCrypt.Verify(request.password, user.PasswordHash));
    }

    [Theory]
    [InlineData("", "valid@example.com", "long-enough-password")]
    [InlineData("Name", "invalid-email", "long-enough-password")]
    [InlineData("Name", "valid@example.com", "short")]
    public async Task InvalidRegistrationReturnsFieldValidation(string fullName, string email, string password)
    {
        using var app = new ApiFactory();
        app.Initialize();
        using var client = app.CreateClient();
        var response = await client.PostAsJsonAsync("/api/member1/auth/register", new { fullName, email, password });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("errors", out _));
    }
}
