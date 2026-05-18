namespace StackSift.Application.Common;

public record CursorPaginatedResponse<T>(
    IList<T> Data,
    string? NextCursor,
    bool HasMore
);
