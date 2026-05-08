using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StackSift.Api.Models.Requests;
using StackSift.Application.Commands.LogSources;
using StackSift.Application.Commands.Projects;
using StackSift.Application.Common;
using StackSift.Application.DTOs;
using StackSift.Application.Queries.LogSources;
using StackSift.Application.Queries.Projects;
using StackSift.Domain.Entities;

namespace StackSift.Api.Controllers;

/// <summary>Manage projects within the current organisation.</summary>
public class ProjectsController(MediatR.IMediator mediator) : BaseApiController(mediator)
{
    /// <summary>List all projects for the current organisation.</summary>
    /// <remarks>
    /// Uses 1-based page indexing. <paramref name="pageSize"/> is clamped to 100; values above
    /// that are silently reduced rather than rejected. Soft-deleted projects are excluded.
    /// </remarks>
    /// <param name="page">Page number (1-based, default 1).</param>
    /// <param name="pageSize">Items per page (default 20, max 100).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Paginated list of projects.</returns>
    /// <response code="200">Page of projects belonging to the caller's organisation.</response>
    [HttpGet]
    [ProducesResponseType(typeof(PaginatedResponse<ProjectDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetProjects(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
        => Ok(await Mediator.Send(new GetProjectsQuery(page, Math.Min(pageSize, 100)), ct));

    /// <summary>Get a single project by ID.</summary>
    /// <param name="id">Project GUID.</param>
    /// <returns>The project.</returns>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ProjectDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProject(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new GetProjectByIdQuery(id), ct));

    /// <summary>Create a new project.</summary>
    /// <param name="body">Project name, optional description, and hex colour.</param>
    /// <returns>The created project.</returns>
    [HttpPost]
    [Authorize(Policy = "MemberOrAbove")]
    [ProducesResponseType(typeof(ProjectDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateProject([FromBody] CreateProjectCommand body, CancellationToken ct)
    {
        var result = await Mediator.Send(body, ct);
        return CreatedAtAction(nameof(GetProject), new { id = result.Id }, result);
    }

    /// <summary>Update an existing project.</summary>
    /// <param name="id">Project GUID.</param>
    /// <param name="body">Updated name, description, and colour.</param>
    /// <returns>The updated project.</returns>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "MemberOrAbove")]
    [ProducesResponseType(typeof(ProjectDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateProject(Guid id, [FromBody] UpdateProjectBody body, CancellationToken ct)
        => Ok(await Mediator.Send(new UpdateProjectCommand(id, body.Name, body.Description, body.Color), ct));

    /// <summary>Soft-delete a project.</summary>
    /// <param name="id">Project GUID.</param>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AdminOrAbove")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteProject(Guid id, CancellationToken ct)
    {
        await Mediator.Send(new DeleteProjectCommand(id), ct);
        return NoContent();
    }

    /// <summary>List log sources for a project.</summary>
    /// <param name="id">Project GUID.</param>
    /// <returns>All log sources attached to the project.</returns>
    [HttpGet("{id:guid}/log-sources")]
    [ProducesResponseType(typeof(List<LogSourceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetLogSources(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new GetLogSourcesQuery(id), ct));
    
    /// <summary>Create a log source for a project.</summary>
    /// <param name="id">Project GUID.</param>
    /// <param name="body">Log source name and type.</param>
    /// <returns>The created log source.</returns>
    [HttpPost("{id:guid}/log-sources")]
    [Authorize(Policy = "MemberOrAbove")]
    [ProducesResponseType(typeof(LogSourceDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateLogSource(Guid id, [FromBody] CreateLogSourceBody body, CancellationToken ct)
    {
        var result = await Mediator.Send(new CreateLogSourceCommand(id, body.Name, body.Type), ct);
        return CreatedAtAction(nameof(GetLogSources), new { id }, result);
    }

}