using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface ICmsService
{
    Task<List<CMSContent>> ListContentAsync(string? contentType = null, string? status = null, int limit = 100, string? q = null);
    Task<CMSContent> GetContentAsync(string contentType, string contentId);
    Task<CMSContent> CreateContentAsync(string adminId, CreateContentRequest request);
    Task<CMSContent> UpdateContentAsync(string contentType, string contentId, CreateContentRequest request);
    Task<CMSContent> PublishContentAsync(string contentType, string contentId);
    Task<CMSContent> ArchiveContentAsync(string contentType, string contentId);
    Task DeleteContentAsync(string contentType, string contentId);
}
