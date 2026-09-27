using LegalService.API.Authentication.Services;
using LegalService.API.Data;
using LegalService.API.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace LegalService.Tests;

public class DemoLawyerSeederTests
{
    private static readonly string[] CategoryNames =
    [
        "Corporate & Commercial Law", "Real Estate & Property Law", "Labour & Employment Law",
        "Criminal Law", "Family Law", "Tax Law"
    ];

    [Fact]
    public async Task SeedsThirtyLawyersAndFutureSlotsWithoutDuplicates()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using var db = new ApplicationDbContext(options);
        db.Specializations.AddRange(CategoryNames.Select((name, index) => new Specialization
        {
            SpecializationId = index + 1, Name = name
        }));
        db.Lawyers.Add(new Lawyer { LawyerId = Guid.NewGuid(), Name = "Existing Lawyer",
            Email = "existing@example.org", LicenseNumber = "EXISTING", Status = "Active" });
        await db.SaveChangesAsync();
        var today = new DateOnly(2030, 5, 1);
        var passwords = new TestPasswords();

        var first = await DemoLawyerSeeder.SeedAsync(db, passwords, today);
        var second = await DemoLawyerSeeder.SeedAsync(db, passwords, today);
        var demo = await db.Lawyers.Where(l => l.LicenseNumber.StartsWith("DEMO/LAW/"))
            .Include(l => l.LawyerSpecializations).ToListAsync();

        Assert.Equal(30, first.LawyersCreated);
        Assert.Equal(86, first.AvailabilitiesCreated);
        Assert.Equal(172, first.SlotsCreated);
        Assert.Equal(0, second.LawyersCreated);
        Assert.Equal(0, second.AvailabilitiesCreated);
        Assert.Equal(0, second.SlotsCreated);
        Assert.Equal(30, demo.Count);
        Assert.Equal(31, await db.Lawyers.CountAsync());
        Assert.Equal(30, demo.Select(l => l.Email).Distinct().Count());
        Assert.Equal(30, demo.Select(l => l.LicenseNumber).Distinct().Count());
        Assert.All(demo, l => Assert.Single(l.LawyerSpecializations));
        Assert.All(demo.SelectMany(l => l.LawyerSpecializations), link =>
            Assert.Contains(link.SpecializationId, db.Specializations.Select(s => s.SpecializationId)));
        var categoryIds = db.Specializations.ToDictionary(s => s.Name, s => s.SpecializationId);
        Assert.All(CategoryNames, name => Assert.Equal(5, demo.Count(l =>
            l.LawyerSpecializations.Single().SpecializationId == categoryIds[name])));
        Assert.Equal(29, demo.Count(l => l.Status == "Active"));
        Assert.Equal(5, demo.Count(l => l.Status == "Active" && l.LawyerSpecializations.Single().SpecializationId == 1));
        Assert.Equal(4, demo.Count(l => l.Status == "Active" && l.LawyerSpecializations.Single().SpecializationId == 6));
        Assert.Equal(86, await db.LawyerAvailabilities.CountAsync());
        Assert.Equal(172, await db.AvailabilitySlots.CountAsync());
        Assert.All(db.LawyerAvailabilities, a => Assert.Contains(a.LawyerId, demo.Select(l => l.LawyerId)));
        Assert.All(db.AvailabilitySlots, s => Assert.Contains(s.AvailabilityId,
            db.LawyerAvailabilities.Select(a => a.AvailabilityId)));
        Assert.Equal(4, db.LawyerAvailabilities.ToList().Count(a => a.Date == today.AddDays(2) &&
            demo.Where(l => l.LawyerSpecializations.Single().SpecializationId == 2).Select(l => l.LawyerId).Contains(a.LawyerId)));
        Assert.Equal(first.CustomerId, second.CustomerId);
        Assert.Equal("demo.customer@example.test", db.Users.Single(u => u.Role == "Customer").Email);
        Assert.All(db.Users, u => Assert.StartsWith("hashed:", u.PasswordHash));
    }

    [Fact]
    public async Task RefusesToCreateCategoriesOrLawyersWhenCatalogIsIncomplete()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using var db = new ApplicationDbContext(options);
        db.Specializations.Add(new Specialization { SpecializationId = 1, Name = "Criminal Law" });
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            DemoLawyerSeeder.SeedAsync(db, new TestPasswords(), new DateOnly(2030, 5, 1)));
        Assert.Empty(db.Lawyers);
        Assert.Single(db.Specializations);
    }

    private sealed class TestPasswords : IPasswordService
    {
        public string HashPassword(string password) => "hashed:" + password;
        public bool VerifyPassword(string password, string passwordHash) => passwordHash == HashPassword(password);
    }
}
