using LegalService.API.Authentication.Services;
using LegalService.API.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace LegalService.API.Data;

/// <summary>Explicit, Development-only demonstration data. Never called during normal startup.</summary>
public static class DemoLawyerSeeder
{
    public const string DemoPassword = "DemoLawyer123!";
    public const string CustomerEmail = "demo.customer@example.test";

    private static readonly string[] Names =
    [
        "Nimal Perera", "Anjali Fernando", "Kavindu Silva", "Shalini Perera", "Tharshan Raj",
        "Dinuka Jayasinghe", "Ayesha Rahman", "Sivani Kumar", "Malith Gunawardena", "Nirosha Wijesinghe",
        "Arun Selvaratnam", "Hiruni de Silva", "Ruwan Jayawardene", "Meera Sivalingam", "Pasindu Ranasinghe",
        "Thilini Karunaratne", "Keshan Fernando", "Fathima Ismail", "Naveen Rajendran", "Chamara Dissanayake",
        "Dilani Wickramasinghe", "Suren Fernando", "Amaya Peiris", "Ishara Mendis", "Ramesh Thiruchelvam",
        "Sanduni Ekanayake", "Farhan Ahamed", "Kavitha Nadarajah", "Dulaj Rathnayake", "Menaka Rajan"
    ];

    private static readonly int[] Experience =
    [3, 10, 15, 7, 12, 2, 6, 11, 18, 5, 4, 9, 14, 7, 20, 2, 8, 13, 16, 5, 3, 7, 12, 17, 9, 4, 6, 11, 15, 19];

    private static readonly (string Name, string Profile)[] Categories =
    [
        ("Corporate & Commercial Law", "Company agreements, shareholder matters, contract review, and commercial disputes."),
        ("Real Estate & Property Law", "Land ownership disputes, title review, conveyancing, leases, and boundary matters."),
        ("Labour & Employment Law", "Termination disputes, workplace agreements, disciplinary matters, and labour issues."),
        ("Criminal Law", "Criminal procedure, bail applications, case preparation, and representation."),
        ("Family Law", "Divorce, maintenance, custody, and related family proceedings."),
        ("Tax Law", "Tax compliance, assessments, revenue appeals, and business tax matters.")
    ];

    public static async Task<DemoSeedResult> SeedAsync(ApplicationDbContext db, IPasswordService passwords,
        DateOnly today, CancellationToken ct = default)
    {
        var categories = await db.Specializations.AsNoTracking().ToDictionaryAsync(s => s.Name, ct);
        var missing = Categories.Where(c => !categories.ContainsKey(c.Name)).Select(c => c.Name).ToArray();
        if (missing.Length != 0)
            throw new InvalidOperationException($"Existing categories required for demo seeding are missing: {string.Join(", ", missing)}");

        await using var transaction = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(ct) : null;
        var existing = await db.Lawyers
            .Where(l => l.Email != null && l.Email.EndsWith("@example.test") || l.LicenseNumber.StartsWith("DEMO/LAW/"))
            .ToListAsync(ct);
        var users = await db.Users.Where(u => u.Email.EndsWith("@example.test")).ToListAsync(ct);
        var created = 0;
        var lawyerIds = new List<Guid>();

        for (var i = 0; i < Names.Length; i++)
        {
            var number = i + 1;
            var email = $"lawyer{number:00}@example.test";
            var license = $"DEMO/LAW/{number:0000}";
            var category = Categories[i / 5];
            var matches = existing.Where(l => string.Equals(l.Email, email, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(l.LicenseNumber, license, StringComparison.OrdinalIgnoreCase)).ToList();
            if (matches.Count > 1 || (matches.Count == 1 &&
                (!string.Equals(matches[0].Email, email, StringComparison.OrdinalIgnoreCase) ||
                 !string.Equals(matches[0].LicenseNumber, license, StringComparison.OrdinalIgnoreCase))))
                throw new InvalidOperationException($"Demo identity {number} conflicts with an existing lawyer; no records were changed.");

            var lawyer = matches.SingleOrDefault();
            if (lawyer is null)
            {
                lawyer = new Lawyer
                {
                    LawyerId = Guid.NewGuid(), Name = $"Demo Attorney {Names[i]}", Email = email,
                    PhoneNumber = $"000-000-{number:0000}", Qualification = "Attorney-at-Law (synthetic demo)",
                    Experience = Experience[i], LicenseNumber = license,
                    ProfileDescription = $"Synthetic demo profile. Practice focus: {category.Profile}",
                    Status = number == 30 ? "Inactive" : "Active",
                    CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
                };
                db.Lawyers.Add(lawyer);
                db.LawyerSpecializations.Add(new LawyerSpecialization
                {
                    LawyerId = lawyer.LawyerId,
                    SpecializationId = categories[category.Name].SpecializationId
                });
                existing.Add(lawyer);
                created++;
            }
            lawyerIds.Add(lawyer.LawyerId);

            var matchingUsers = users.Where(u => string.Equals(u.Email, email, StringComparison.OrdinalIgnoreCase)).ToList();
            if (matchingUsers.Count > 1 || matchingUsers.Any(u => u.Role != "Lawyer" || u.Name != lawyer.Name))
                throw new InvalidOperationException($"Demo account {number} conflicts with an existing user; no records were changed.");
            if (matchingUsers.Count == 0)
            {
                var account = new User
                {
                    Name = lawyer.Name, Email = email, Role = "Lawyer",
                    PasswordHash = passwords.HashPassword(DemoPassword),
                    CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
                };
                db.Users.Add(account);
                users.Add(account);
            }
        }

        var customer = users.SingleOrDefault(u => string.Equals(u.Email, CustomerEmail, StringComparison.OrdinalIgnoreCase));
        if (customer is not null && (customer.Role != "Customer" || customer.Name != "Demo Customer"))
            throw new InvalidOperationException("The demo customer email belongs to another account; no records were changed.");
        if (customer is null)
        {
            customer = new User
            {
                Name = "Demo Customer", Email = CustomerEmail, Role = "Customer",
                PasswordHash = passwords.HashPassword(DemoPassword),
                CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
            };
            db.Users.Add(customer);
        }
        await db.SaveChangesAsync(ct);

        var dates = new[] { today.AddDays(2), today.AddDays(4), today.AddDays(7) };
        var availabilities = await db.LawyerAvailabilities
            .Include(a => a.AvailabilitySlots)
            .Where(a => lawyerIds.Contains(a.LawyerId) && dates.Contains(a.Date))
            .ToListAsync(ct);
        var addedAvailabilities = 0;
        var addedSlots = 0;
        for (var i = 0; i < lawyerIds.Count - 1; i++) // The inactive lawyer has no bookable slots.
        {
            foreach (var date in dates)
            {
                if (i == 5 && date == dates[0]) continue; // One property lawyer is unavailable on the first demo date.
                var availability = availabilities.FirstOrDefault(a => a.LawyerId == lawyerIds[i] && a.Date == date &&
                    a.StartTime == new TimeOnly(9, 0) && a.EndTime == new TimeOnly(10, 0));
                if (availability is null)
                {
                    availability = new LawyerAvailability
                    {
                        AvailabilityId = Guid.NewGuid(), LawyerId = lawyerIds[i], Date = date,
                        StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(10, 0)
                    };
                    db.LawyerAvailabilities.Add(availability);
                    availabilities.Add(availability);
                    addedAvailabilities++;
                }
                foreach (var start in new[] { new TimeOnly(9, 0), new TimeOnly(9, 30) })
                {
                    if (availability.AvailabilitySlots.Any(s => s.StartTime == start)) continue;
                    availability.AvailabilitySlots.Add(new AvailabilitySlot
                    {
                        SlotId = Guid.NewGuid(), AvailabilityId = availability.AvailabilityId,
                        StartTime = start, EndTime = start.AddMinutes(30), IsBooked = false
                    });
                    addedSlots++;
                }
            }
        }
        await db.SaveChangesAsync(ct);
        if (transaction is not null) await transaction.CommitAsync(ct);

        // Appointment.CustomerId is a UUID even though User.UserId is an int. The existing
        // appointment service resolves a zero-prefixed UUID's final hexadecimal digits to UserId.
        var customerId = Guid.Parse($"00000000-0000-0000-0000-{customer.UserId:x12}");
        return new DemoSeedResult(created, addedAvailabilities, addedSlots, customerId);
    }
}

public record DemoSeedResult(int LawyersCreated, int AvailabilitiesCreated, int SlotsCreated, Guid CustomerId);
