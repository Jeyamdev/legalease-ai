using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using LegalService.API.Models.Entities;
using Microsoft.IdentityModel.Tokens;
namespace LegalService.API.Authentication.Services;
public sealed class TokenService(IConfiguration config)
{
    public string Create(User user)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, user.UserId.ToString()), new(ClaimTypes.Name, user.FullName), new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()) };
        claims.Add(new Claim(ClaimTypes.Role, user.Role));
        var token = new JwtSecurityToken(config["Jwt:Issuer"], config["Jwt:Audience"], claims,
            expires: DateTime.UtcNow.AddMinutes(60), signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!)), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
