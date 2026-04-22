using FluentValidation;
using MediatR;
using StackSift.Application.DTOs;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.AlertRules;

public record UpdateAlertRuleCommand(
    Guid Id,
    string Name,
    AlertRuleCondition Condition,
    decimal? Threshold,
    int WindowMinutes,
    LogLevel? LogLevel,
    string? Pattern,
    bool IsActive
) : IRequest<AlertRuleDto>;

public class UpdateAlertRuleCommandValidator : AbstractValidator<UpdateAlertRuleCommand>
{
    public UpdateAlertRuleCommandValidator()
    {
        RuleFor(x => x.Id).NotEqual(Guid.Empty);
        RuleFor(x => x.Name).NotEmpty().Length(2, 100);
        RuleFor(x => x.WindowMinutes).InclusiveBetween(1, 1440);
        RuleFor(x => x.Threshold)
            .GreaterThan(0)
            .When(x => x.Condition == AlertRuleCondition.Threshold)
            .WithMessage("Threshold must be greater than 0 when condition is Threshold.");
    }
}

public class UpdateAlertRuleCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<UpdateAlertRuleCommand, AlertRuleDto>
{
    public async Task<AlertRuleDto> Handle(UpdateAlertRuleCommand request, CancellationToken ct)
    {
        var rule = await uow.AlertRules.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(AlertRule), request.Id);

        if (rule.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(AlertRule), request.Id);

        rule.Name = request.Name;
        rule.Condition = request.Condition;
        rule.Threshold = request.Threshold;
        rule.WindowMinutes = request.WindowMinutes;
        rule.LogLevel = request.LogLevel;
        rule.Pattern = request.Pattern;
        rule.IsActive = request.IsActive;

        await uow.AlertRules.UpdateAsync(rule, ct);
        await uow.SaveChangesAsync(ct);

        return rule.ToDto();
    }
}
