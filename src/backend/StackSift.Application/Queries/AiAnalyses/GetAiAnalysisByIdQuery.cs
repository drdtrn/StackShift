using FluentValidation;
using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Mapping;
using StackSift.Domain.Entities;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Queries.AiAnalyses;

public record GetAiAnalysisByIdQuery(Guid Id) : IRequest<AiAnalysisDto>;

public class GetAiAnalysisByIdQueryValidator : AbstractValidator<GetAiAnalysisByIdQuery>
{
    public GetAiAnalysisByIdQueryValidator()
    {
        RuleFor(x => x.Id).NotEqual(Guid.Empty);
    }
}

public class GetAiAnalysisByIdQueryHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<GetAiAnalysisByIdQuery, AiAnalysisDto>
{
    public async Task<AiAnalysisDto> Handle(GetAiAnalysisByIdQuery request, CancellationToken ct)
    {
        var analysis = await uow.AiAnalyses.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(AiAnalysis), request.Id);

        if (analysis.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(AiAnalysis), request.Id);

        var incident = await uow.Incidents.GetByIdAsync(analysis.IncidentId, ct)
            ?? throw new NotFoundException(nameof(Incident), analysis.IncidentId);

        return analysis.ToDto(incident.ProjectId);
    }
}
