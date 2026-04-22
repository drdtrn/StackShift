using FluentValidation;
using MediatR;
using StackSift.Application.DTOs;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.AlertRules;

public record CreateAlertRuleCommand(
    Guid ProjectId,
    string Name,
    AlertRuleCondition Condition,
    decimal? Threshold,
    int WindowMinutes,
    LogLevel? LogLevel,
    string? Pattern
) : IRequest<AlertRuleDto>;

public class CreateAlertRuleCommandValidator : AbstractValidator<CreateAlertRuleCommand>
{
    public CreateAlertRuleCommandValidator()
    {
        RuleFor(x => x.ProjectId).NotEqual(Guid.Empty);
        RuleFor(x => x.Name).NotEmpty().Length(2, 100);
        RuleFor(x => x.WindowMinutes).InclusiveBetween(1, 1440);
        RuleFor(x => x.Threshold)
            .GreaterThan(0)
            .When(x => x.Condition == AlertRuleCondition.Threshold)
            .WithMessage("Threshold must be greater than 0 when condition is Threshold.");
    }
}

public class CreateAlertRuleCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<CreateAlertRuleCommand, AlertRuleDto>
{
    public async Task<AlertRuleDto> Handle(CreateAlertRuleCommand request, CancellationToken ct)
    {
        var project = await uow.Projects.GetByIdAsync(request.ProjectId, ct)
            ?? throw new NotFoundException(nameof(Project), request.ProjectId);

        if (project.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        var rule = new AlertRule
        {
            Id = Guid.NewGuid(),
            ProjectId = request.ProjectId,
            OrganizationId = currentUser.OrganizationId,
            Name = request.Name,
            Condition = request.Condition,
            Threshold = request.Threshold,
            WindowMinutes = request.WindowMinutes,
            LogLevel = request.LogLevel,
            Pattern = request.Pattern,
            IsActive = true
        };

        await uow.AlertRules.AddAsync(rule, ct);
        await uow.SaveChangesAsync(ct);

        return rule.ToDto();
    }
}
