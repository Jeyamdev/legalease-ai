using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
namespace LegalService.API.Infrastructure;
public sealed class ApiException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var status = exception is ApiException api ? api.Status : 500;
        var message = exception is ApiException ? exception.Message : "An unexpected error occurred.";
        var pg = exception as PostgresException ?? (exception as DbUpdateException)?.InnerException as PostgresException;
        if (pg?.SqlState is "23505" or "23503" or "40001")
        { status = 409; message = "The change conflicts with existing data. Refresh and try again."; }
        if (status == 500) logger.LogError(exception, "API request failed: {TraceId}", context.TraceIdentifier);
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new ProblemDetails { Status = status, Title = message,
            Extensions = { ["traceId"] = context.TraceIdentifier } }, ct);
        return true;
    }
}
