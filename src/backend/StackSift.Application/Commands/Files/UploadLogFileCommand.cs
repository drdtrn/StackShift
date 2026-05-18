using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Http;
using StackSift.Application.DTOs;

namespace StackSift.Application.Commands.Files;

public record UploadLogFileCommand(IFormFile File, Guid ProjectId) : IRequest<FileUploadDto>;

public class UploadLogFileCommandValidator : AbstractValidator<UploadLogFileCommand>
{
    private static readonly HashSet<string> AllowedExtensions =
        new(StringComparer.OrdinalIgnoreCase) { ".log", ".txt", ".yaml", ".yml" };

    private static readonly HashSet<string> AllowedContentTypes =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "text/plain",
            "application/x-yaml",
            "application/yaml",
            "application/octet-stream",
        };

    public UploadLogFileCommandValidator()
    {
        RuleFor(x => x.ProjectId).NotEqual(Guid.Empty);

        RuleFor(x => x.File).NotNull();

        When(x => x.File is not null, () =>
        {
            RuleFor(x => x.File.Length)
                .InclusiveBetween(1L, 52_428_800L)
                .WithMessage("File must be between 1 byte and 50 MB.");

            RuleFor(x => Path.GetExtension(x.File.FileName))
                .Must(ext => AllowedExtensions.Contains(ext))
                .WithMessage("Only .log, .txt, .yaml, and .yml files are allowed.");

            RuleFor(x => x.File.ContentType)
                .Must(ct => AllowedContentTypes.Contains(ct))
                .WithMessage("Content-Type must be text/plain, application/x-yaml, application/yaml, or application/octet-stream.");
        });
    }
}

public class UploadLogFileCommandHandler(
    IFileStorageService storage,
    ICurrentUserService currentUser,
    IUnitOfWork uow)
    : IRequestHandler<UploadLogFileCommand, FileUploadDto>
{
    public async Task<FileUploadDto> Handle(UploadLogFileCommand request, CancellationToken ct)
    {
        // Cross-tenant guard: project must exist and belong to the caller's org.
        var project = await uow.Projects.GetByIdAsync(request.ProjectId, ct)
            ?? throw new NotFoundException(nameof(Project), request.ProjectId);

        if (project.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        var metadata = new Dictionary<string, string>
        {
            ["organization-id"] = currentUser.OrganizationId.ToString(),
            ["project-id"] = request.ProjectId.ToString(),
            ["uploaded-by"] = currentUser.UserId.ToString(),
        };

        await using var stream = request.File.OpenReadStream();

        var result = await storage.UploadAsync(
            stream,
            request.File.FileName,
            request.File.ContentType,
            metadata,
            ct);

        return new FileUploadDto(
            result.ObjectKey,
            result.Size,
            result.ContentType,
            result.PresignedDownloadUrl);
    }
}
