namespace StackSift.Application.Common;

public record PaginatedResponse<T>(
    IList<T> Data,
    int Total,
    int Page,
    int PageSize,
    bool HasNextPage,
    bool HasPreviousPage
);
