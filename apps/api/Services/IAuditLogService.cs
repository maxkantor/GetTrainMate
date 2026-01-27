using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface IAuditLogService
{
    Task LogActionAsync(
        AdminIdentity admin,
        string action,
        string targetType,
        string? targetId = null,
        object? before = null,
        object? after = null,
        string? requestId = null);
    
    Task<List<AuditLog>> GetLogsAsync(
        string? adminSub = null,
        string? targetType = null,
        string? targetId = null,
        DateTime? from = null,
        DateTime? to = null,
        int page = 1,
        int pageSize = 50);
}
