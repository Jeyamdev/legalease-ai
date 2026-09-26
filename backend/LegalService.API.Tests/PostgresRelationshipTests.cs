using LegalService.API.Data;
using LegalService.API.Models.Entities;
using LegalService.API.Services.Lawyers;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace LegalService.API.Tests;

public sealed class PostgresFactAttribute : FactAttribute
{
    public PostgresFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MEMBER1_TEST_POSTGRES")))
            Skip = "Opt-in: configure MEMBER1_TEST_POSTGRES for the approved migrated development database.";
    }
}

public sealed class PostgresRelationshipTests
{
    [PostgresFact]
    public async Task DeactivationPreservesAppointmentAndSlotReferences()
    {
        await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(Environment.GetEnvironmentVariable("MEMBER1_TEST_POSTGRES")).Options);
        // Only isolated test records are inserted, and none are committed.
        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            var user = new User { FullName = "Transaction-only integration fixture", Email = $"{Guid.NewGuid()}@local.example" };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            var lawyer = new Lawyer { LawyerId = Guid.NewGuid(), Name = user.Name, Email = user.Email, Status = "Active", LicenseNumber = $"TEST-{Guid.NewGuid()}" };
            var availability = new LawyerAvailability { AvailabilityId = Guid.NewGuid(), Lawyer = lawyer, Date = new(2030, 1, 1), StartTime = new(9, 0), EndTime = new(10, 0) };
            var slot = new AvailabilitySlot { SlotId = Guid.NewGuid(), LawyerAvailability = availability, StartTime = new(9, 0), EndTime = new(9, 30), IsBooked = true };
            var appointment = new Appointment { AppointmentId = Guid.NewGuid(), CustomerId = Guid.NewGuid(), Lawyer = lawyer, AvailabilitySlot = slot, Status = "IntegrationFixture" };
            db.Appointments.Add(appointment);
            await db.SaveChangesAsync();
            await new LawyerService(db).DeactivateAsync(lawyer.LawyerId, default);
            db.ChangeTracker.Clear();
            Assert.Equal("Inactive", (await db.Lawyers.SingleAsync(l => l.LawyerId == lawyer.LawyerId)).Status);
            Assert.Equal(lawyer.LawyerId, (await db.Appointments.SingleAsync(a => a.AppointmentId == appointment.AppointmentId)).LawyerId);
            Assert.True(await db.AvailabilitySlots.AnyAsync(s => s.SlotId == slot.SlotId && s.IsBooked));
            Assert.True(await db.Users.AnyAsync(u => u.UserId == user.UserId));
        }
        finally
        {
            await transaction.RollbackAsync();
        }
    }
}
