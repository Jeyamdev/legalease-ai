using LegalService.API.Infrastructure;
using LegalService.API.Services.Lawyers;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using LegalService.API.Data;
using LegalService.API.Authentication.Services;
using LegalService.API.Interfaces;
using LegalService.API.Services;
using LegalService.API.AgentIntegration;
using LegalService.API.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ================================================================
// Database Connection (Neon PostgreSQL)
// ================================================================
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection")
    );
});

// ================================================================
// Authentication Services
// ================================================================
builder.Services.AddScoped<IPasswordService, PasswordService>();
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<ILawyerService, LawyerService>();
builder.Services.AddScoped<CatalogService>();
builder.Services.AddHttpClient<ILawyerRecommendationService, RecommendationService>(c => c.Timeout = TimeSpan.FromSeconds(45));
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddProblemDetails();
// The member1 scheme reloads the current database role without changing the team's JWT scheme.
builder.Services.AddAuthentication().AddJwtBearer("Member1", options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true, ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"], ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
        ClockSkew = TimeSpan.FromSeconds(30)
    };
    options.Events = new JwtBearerEvents { OnTokenValidated = async context =>
    {
        var db = context.HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();
        if (!int.TryParse(context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
        { context.Fail("Account unavailable."); return; }
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.UserId == id, context.HttpContext.RequestAborted);
        if (user is null) { context.Fail("Account unavailable."); return; }
        var identity = (ClaimsIdentity)context.Principal!.Identity!;
        foreach (var claim in identity.FindAll(ClaimTypes.Role).ToArray()) identity.RemoveClaim(claim);
        identity.AddClaim(new Claim(ClaimTypes.Role, user.Role));
    }};
});
builder.Services.AddAuthorization();

// ================================================================
// Documentation & Clerk Management Services
// ================================================================
builder.Services.AddScoped<IClerkService, ClerkService>();
builder.Services.AddScoped<IDocumentationServiceService, DocumentationServiceService>();
builder.Services.AddScoped<IDocumentationRequestService, DocumentationRequestService>();
builder.Services.AddScoped<IDocumentFileService, DocumentFileService>();
builder.Services.AddScoped<ICareerService, CareerService>();
builder.Services.AddScoped<IEmailNotificationService, EmailNotificationService>();

// ================================================================
// Customer Service Request Management
// ================================================================
builder.Services.AddScoped<IServiceRequestService, ServiceRequestService>();

// ================================================================
// Appointment & Booking Management
// ================================================================
builder.Services.AddScoped<IAppointmentService, AppointmentService>();

// Agentic AI Integration
builder.Services.AddHttpClient<IAgentIntegrationService, AgentIntegrationService>();

// ================================================================
// CORS Configuration
// ================================================================
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// ================================================================
// Controllers & JSON Serialization
// ================================================================
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });

// ================================================================
// Swagger / OpenAPI
// ================================================================
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Enter: Bearer {your JWT token}"
    });

    options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// ================================================================
// JWT Authentication
// ================================================================
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,

        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],

        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(
                builder.Configuration["Jwt:Key"]!
            ))
    };
});

var app = builder.Build();

// ================================================================
// HTTP Pipeline Configuration
// ================================================================
app.UseMiddleware<ExceptionMiddleware>();
app.UseWhen(context => context.Request.Path.StartsWithSegments("/api/lawyer-management") ||
    context.Request.Path.StartsWithSegments("/api/specializations") ||
    context.Request.Path.StartsWithSegments("/api/legal-services") ||
    context.Request.Path.StartsWithSegments("/api/lawyer-recommendations") ||
    context.Request.Path.StartsWithSegments("/api/member1"), branch => branch.UseExceptionHandler());

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Legal Service API v1");
    });
}

app.UseCors("AllowAll");

// Only redirect to HTTPS in production – in dev the HTTPS port is not configured,
// causing mobile HTTP requests to hang on the 307 redirect.
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseAuthentication();   // Must be before UseAuthorization()
app.UseAuthorization();

app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    try
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var passwordService = scope.ServiceProvider.GetRequiredService<LegalService.API.Authentication.Services.IPasswordService>();
        await DbInitializer.SeedCategoriesAsync(dbContext);
        await DbInitializer.SeedDocumentationServicesAsync(dbContext);
        await DbInitializer.SeedStaffAccountsAsync(dbContext, passwordService,app.Configuration);
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Failed to seed lawyer categories, documentation services, or staff accounts in database.");
    }
}

app.Run();

public partial class Program { }
