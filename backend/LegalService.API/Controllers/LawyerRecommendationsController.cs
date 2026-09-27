using LegalService.API.Services.Lawyers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using LegalService.API.Infrastructure;
namespace LegalService.API.Controllers;
[ApiController, Route("api/lawyer-recommendations"), Authorize(Roles = "Admin")]
public sealed class LawyerRecommendationsController(ILawyerRecommendationService service) : ControllerBase
{
    private int UserId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
        ? id : throw new ApiException(401, "A valid staff identity is required.");

    [HttpPost]
    public async Task<IActionResult> Recommend(RecommendationRequest request, CancellationToken ct) => Ok(await service.RecommendAsync(request, UserId, ct));

    [HttpGet("{workflowId:guid}")]
    public async Task<IActionResult> Get(Guid workflowId, CancellationToken ct) => Ok(await service.GetAsync(workflowId, UserId, ct));

    [HttpPost("{workflowId:guid}/approve")]
    public async Task<IActionResult> Approve(Guid workflowId, ApproveRecommendationRequest request, CancellationToken ct)
        => Ok(await service.ApproveAsync(workflowId, request, UserId, ct));
}
