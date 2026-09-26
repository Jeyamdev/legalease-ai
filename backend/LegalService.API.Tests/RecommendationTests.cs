using System.Net;
using System.Text;
using LegalService.API.Data;
using LegalService.API.Infrastructure;
using LegalService.API.Services.Lawyers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace LegalService.API.Tests;

public sealed class RecommendationTests : IDisposable
{
    private readonly SqliteConnection connection = new("Data Source=:memory:");
    private readonly ApplicationDbContext db;
    public RecommendationTests()
    {
        connection.Open();
        db = new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options);
        db.Database.EnsureCreated();
    }

    private RecommendationService Service(string json, HttpStatusCode status = HttpStatusCode.OK)
    {
        var client = new HttpClient(new ResponseHandler(json, status));
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        { ["Ai:BaseUrl"] = "https://internal.example/", ["Ai:InternalKey"] = "test-internal-key" }).Build();
        return new(client, config, db);
    }

    [Theory]
    [InlineData("{\"recommendations\":[null],\"warnings\":[],\"trace\":[]}")]
    [InlineData("{\"recommendations\":[{}],\"warnings\":[],\"trace\":[]}")]
    [InlineData("{\"recommendations\":null,\"warnings\":[],\"trace\":[]}")]
    [InlineData("not json")]
    public async Task MalformedUpstreamResponseIs502InsteadOfUnhandled500(string json)
    {
        var error = await Assert.ThrowsAsync<ApiException>(() => Service(json).RecommendAsync(new() { Requirement = "divorce" }, default));
        Assert.Equal(502, error.Status);
    }

    [Fact]
    public async Task NonexistentLawyerIsRejected()
    {
        var json = $$"""{"recommendations":[{"lawyerId":"{{Guid.NewGuid()}}","score":50,"reason":"Family Law"}],"warnings":[],"trace":[]} """;
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => Service(json).RecommendAsync(new() { Requirement = "divorce" }, default))).Status);
    }

    [Fact]
    public async Task ValidStoredLawyerAcceptedButDeactivatedLawyerRejected()
    {
        var lawyers = new LawyerService(db);
        var lawyer = await lawyers.CreateAsync(new() { Name = "Test Lawyer", Email = "test@example.com", PhoneNumber = "+94771234567", Qualification = "LLB", LicenseNumber = "TEST-RECOMMENDATION", SpecializationIds = [2] }, default);
        var json = $$"""{"recommendations":[{"lawyerId":"{{lawyer.LawyerId}}","score":50,"reason":"Family Law"}],"warnings":[],"trace":[]} """;
        Assert.Equal(lawyer.LawyerId, Assert.Single((await Service(json).RecommendAsync(new() { Requirement = "divorce" }, default)).Recommendations).LawyerId);
        await lawyers.DeactivateAsync(lawyer.LawyerId, default);
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => Service(json).RecommendAsync(new() { Requirement = "divorce" }, default))).Status);
    }

    [Fact]
    public async Task UpstreamFailureIs503()
    {
        Assert.Equal(503, (await Assert.ThrowsAsync<ApiException>(() => Service("{}", HttpStatusCode.InternalServerError).RecommendAsync(new() { Requirement = "divorce" }, default))).Status);
    }

    public void Dispose() { db.Dispose(); connection.Dispose(); }
    private sealed class ResponseHandler(string json, HttpStatusCode status) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Assert.True(request.Headers.Contains("X-Internal-Key"));
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") });
        }
    }
}
