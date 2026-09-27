using LegalService.API.Services.Lawyers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace LegalService.API.Controllers;
[ApiController, Route("api/lawyer-recommendations"), Authorize(Roles = "Admin")]
public sealed class LawyerRecommendationsController(ILawyerRecommendationService service) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Recommend(RecommendationRequest request, CancellationToken ct) => Ok(await service.RecommendAsync(request, ct));
}
