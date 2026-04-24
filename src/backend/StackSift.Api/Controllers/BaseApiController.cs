using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace StackSift.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public abstract class BaseApiController(IMediator mediator) : ControllerBase
{
    protected readonly IMediator Mediator = mediator;
}