using Keycloak.AuthServices.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StackSift.Api.Middleware;
using Microsoft.EntityFrameworkCore;
using StackSift.Infrastructure.Extensions;
using StackSift.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddControllers();

builder.Services.AddKeycloakWebApiAuthentication(
    builder.Configuration,
    o =>
    {
        o.RequireHttpsMetadata = false;
        o.Events = new JwtBearerEvents
        {
            OnChallenge = async ctx =>
            {
                ctx.HandleResponse();
                ctx.Response.StatusCode = 401;
                ctx.Response.ContentType = "application/problem+json";
                await ctx.Response.WriteAsJsonAsync(new ProblemDetails
                {
                    Status = 401,
                    Title = "Unauthorized",
                    Type = "https://httpstatuses.io/401",
                });
            },
            OnForbidden = async ctx =>
            {
                ctx.Response.StatusCode = 403;
                ctx.Response.ContentType = "application/problem+json";
                await ctx.Response.WriteAsJsonAsync(new ProblemDetails
                {
                    Status = 403,
                    Title = "Forbidden",
                    Type = "https://httpstatuses.io/403",
                });
            },
        };
    });

builder.Services.AddAuthorization(options =>
{
    var viewerOrAbove = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .RequireClaim("stacksift_role", "owner", "admin", "member", "viewer")
        .Build();

    options.DefaultPolicy = viewerOrAbove;
    options.AddPolicy("ViewerOrAbove", viewerOrAbove);
    options.AddPolicy("MemberOrAbove", p =>
        p.RequireAuthenticatedUser().RequireClaim("stacksift_role", "owner", "admin", "member"));
    options.AddPolicy("AdminOrAbove", p =>
        p.RequireAuthenticatedUser().RequireClaim("stacksift_role", "owner", "admin"));
    options.AddPolicy("OwnerOnly", p =>
        p.RequireAuthenticatedUser().RequireClaim("stacksift_role", "owner"));
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseMiddleware<ApiKeyAuthMiddleware>();
app.UseAuthorization();
app.MapControllers();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
