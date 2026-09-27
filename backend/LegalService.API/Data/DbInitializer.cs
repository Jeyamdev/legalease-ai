using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LegalService.API.Models.Entities;

namespace LegalService.API.Data;

public static class DbInitializer
{
    public static readonly string[] AllowedCategories = new[]
    {
        "Corporate & Commercial Law",
        "Criminal Law",
        "Real Estate & Property Law",
        "Labour & Employment Law",
        "Tax Law"
    };

    public static async Task SeedCategoriesAsync(ApplicationDbContext context)
    {
        var targetCategories = new Dictionary<string, string>
        {
            { "Corporate & Commercial Law", "Business registration, corporate governance, commercial contracts, and compliance." },
            { "Criminal Law", "Defense and prosecutorial assistance in criminal litigation." },
            { "Real Estate & Property Law", "Land registry, real estate transactions, leases, partition actions, and title disputes." },
            { "Labour & Employment Law", "Employment contracts, workplace disputes, labour tribunal advocacy, and severance." },
            { "Tax Law", "Direct and indirect taxation, corporate tax planning, revenue appeals, and audits." }
        };

        // If "Corporate Law" exists, rename to "Corporate & Commercial Law"
        var corp = await context.Specializations.FirstOrDefaultAsync(s => s.Name == "Corporate Law");
        if (corp != null)
        {
            corp.Name = "Corporate & Commercial Law";
            corp.Description = targetCategories["Corporate & Commercial Law"];
        }

        // If "Property Law" exists, rename to "Real Estate & Property Law"
        var prop = await context.Specializations.FirstOrDefaultAsync(s => s.Name == "Property Law");
        if (prop != null)
        {
            prop.Name = "Real Estate & Property Law";
            prop.Description = targetCategories["Real Estate & Property Law"];
        }

        await context.SaveChangesAsync();

        // Insert missing categories
        foreach (var kvp in targetCategories)
        {
            var exists = await context.Specializations.AnyAsync(s => s.Name == kvp.Key);
            if (!exists)
            {
                context.Specializations.Add(new Specialization
                {
                    Name = kvp.Key,
                    Description = kvp.Value
                });
            }
        }

        await context.SaveChangesAsync();

        // Ensure lawyers without a specialization are mapped to a valid category
        var unassignedLawyers = await context.Lawyers
            .Include(l => l.LawyerSpecializations)
            .Where(l => !l.LawyerSpecializations.Any())
            .ToListAsync();

        if (unassignedLawyers.Any())
        {
            var defaultSpec = await context.Specializations.FirstOrDefaultAsync(s => s.Name == "Corporate & Commercial Law")
                           ?? await context.Specializations.FirstAsync();

            foreach (var l in unassignedLawyers)
            {
                context.LawyerSpecializations.Add(new LawyerSpecialization
                {
                    LawyerId = l.LawyerId,
                    SpecializationId = defaultSpec.SpecializationId
                });
            }
        }
    }

    public static async Task SeedDocumentationServicesAsync(ApplicationDbContext context)
    {
        var services = new List<(string Name, string Description, string RequiredDocs)>
        {
            (
                "Property Transfer",
                "Land registry deed conveyance, title verification, and official ownership transfer.",
                "[\"NIC Copy\",\"Prior Title Deed Copy\",\"Survey Plan\",\"Sale Agreement Draft\"]"
            ),
            (
                "Rental & Lease Agreement",
                "Residential and commercial tenancy agreements, covenant clauses, and stamp duty calculation.",
                "[\"NIC Copy\",\"Title Deed / Ownership Proof\",\"Tenancy Agreement Draft\"]"
            ),
            (
                "Business & Corporate Registration",
                "Company incorporation (Pvt Ltd), sole proprietorship, and partnership registration with ROC.",
                "[\"NIC Copy\",\"Form 1 / Form 18\",\"Articles of Association\",\"Address Proof\"]"
            ),
            (
                "Power of Attorney",
                "General and Special Power of Attorney drafting, principal authorization, and notarial execution.",
                "[\"NIC of Grantor\",\"NIC of Grantee\",\"Scope of Authority Document\",\"Deed / Asset Proof\"]"
            ),
            (
                "Last Will and Testament",
                "Estate planning, testamentary dispositions, executor appointment, and notarial attestation.",
                "[\"NIC of Testator\",\"Schedule of Assets & Deeds\",\"Draft Will Agreement\",\"Beneficiary Details\"]"
            ),
            (
                "Bail Application & Criminal Representation",
                "Magistrate & High Court bail filings, police B-report review, and surety documentation.",
                "[\"NIC of Accused\",\"Police B Report\",\"Affidavit of Sureties\",\"Surety Asset Proof\"]"
            ),
            (
                "Title Search & Pedigree Due Diligence",
                "Comprehensive 40-year land registry search, encumbrance verification, and title report issuance.",
                "[\"Prior Title Deed Copy\",\"Survey Plan\",\"Land Registry Extract Request\",\"NIC Copy\"]"
            ),
            (
                "Contract Vetting & Corporate NDA Drafting",
                "Commercial contracts, confidentiality agreements, dispute indemnity, and termination clauses.",
                "[\"Commercial Agreement Draft\",\"Business Registration\",\"NIC Copy\"]"
            ),
            (
                "Testamentary & Probate Court Application",
                "Probate petitioning, letters of administration, estate accounting, and court representation.",
                "[\"Death Certificate\",\"Original Last Will\",\"Estate Asset Inventory\",\"NIC of Applicant\"]"
            ),
            (
                "Mutual Divorce & Custody Settlement",
                "Divorce by mutual consent, maintenance agreements, custody orders, and asset dissolution.",
                "[\"Marriage Certificate\",\"Custody & Settlement Agreement\",\"NIC of Parties\",\"Child Birth Certificates\"]"
            ),
            (
                "Commercial Lease Agreement",
                "Office and industrial property leases, rent review mechanisms, and fit-out covenants.",
                "[\"Title Deed Copy\",\"Local Council Assessment Receipt\",\"Draft Commercial Lease\",\"NIC Copy\"]"
            ),
            (
                "Affidavit & Notary Services",
                "Sworn affidavits of fact, missing documents declarations, and attestation before a JP or Notary.",
                "[\"NIC of Deponent\",\"Completed Affidavit Draft\",\"Supporting Fact Documents\"]"
            )
        };

        foreach (var svc in services)
        {
            var existing = await context.DocumentationServices.FirstOrDefaultAsync(s => s.Name == svc.Name);
            if (existing == null)
            {
                context.DocumentationServices.Add(new DocumentationService
                {
                    Name = svc.Name,
                    Description = svc.Description,
                    IsActive = true,
                    RequiredDocuments = svc.RequiredDocs,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await context.SaveChangesAsync();
    }
}
