using FluentValidation;
using MediatR;
using StackSift.Application.DTOs;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.AiAnalyses;

public record TriggerAiAnalysisCommand(Guid IncidentId) : IRequest<AiAnalysisDto>;

public class TriggerAiAnalysisCommandValidator : AbstractValidator<TriggerAiAnalysisCommand>
{
    public TriggerAiAnalysisCommandValidator()
    {
        RuleFor(x => x.IncidentId).NotEqual(Guid.Empty);
    }
}

public class TriggerAiAnalysisCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<TriggerAiAnalysisCommand, AiAnalysisDto>
{
    public async Task<AiAnalysisDto> Handle(TriggerAiAnalysisCommand request, CancellationToken ct)
    {
        var incident = await uow.Incidents.GetByIdAsync(request.IncidentId, ct)
            ?? throw new NotFoundException(nameof(Incident), request.IncidentId);

        if (incident.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Incident), request.IncidentId);

        var analysis = new AiAnalysis
        {
            Id = Guid.NewGuid(),
            IncidentId = request.IncidentId,
            OrganizationId = currentUser.OrganizationId,
            Status = AiAnalysisStatus.Pending,
            SuggestedFixes = [],
            RelevantLogIds = []
        };

        await uow.AiAnalyses.AddAsync(analysis, ct);
        await uow.SaveChangesAsync(ct);

        return analysis.ToDto();
    }
}
