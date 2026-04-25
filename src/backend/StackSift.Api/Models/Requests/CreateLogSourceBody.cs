using StackSift.Domain.Enums;

namespace StackSift.Api.Models.Requests;

public record CreateLogSourceBody(string Name, LogSourceType Type);