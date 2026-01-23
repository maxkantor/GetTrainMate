using Amazon.DynamoDBv2.DataModel;
using Amazon.DynamoDBv2.DocumentModel;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public class CmsService : ICmsService
{
    private readonly IDynamoDBContext _context;
    private readonly ILogger<CmsService> _logger;

    public CmsService(IDynamoDBContext context, ILogger<CmsService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<CMSContent>> ListContentAsync(string? contentType = null, string? status = null, int limit = 100, string? q = null)
    {
        try
        {
            List<CMSContent> items;

            if (!string.IsNullOrEmpty(contentType))
            {
                var query = _context.QueryAsync<CMSContent>(contentType);
                items = await query.GetRemainingAsync();
            }
            else
            {
                var scan = _context.ScanAsync<CMSContent>(new List<ScanCondition>());
                items = await scan.GetRemainingAsync();
            }

            if (!string.IsNullOrEmpty(status))
            {
                items = items.Where(i => string.Equals(i.Status, status, StringComparison.OrdinalIgnoreCase)).ToList();
            }

            if (!string.IsNullOrWhiteSpace(q))
            {
                var qq = q.Trim();
                items = items.Where(i => (i.Title ?? string.Empty).Contains(qq, StringComparison.OrdinalIgnoreCase)).ToList();
            }

            return items
                .OrderByDescending(i => i.CreatedAt)
                .Take(limit)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error listing CMS content: {ex.Message}");
            throw;
        }
    }

    public async Task<CMSContent> GetContentAsync(string contentType, string contentId)
    {
        try
        {
            var content = await _context.LoadAsync<CMSContent>(contentType, contentId);
            return content ?? throw new KeyNotFoundException($"Content {contentId} not found");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting CMS content: {ex.Message}");
            throw;
        }
    }

    public async Task<CMSContent> CreateContentAsync(string adminId, CreateContentRequest request)
    {
        try
        {
            var content = new CMSContent
            {
                ContentType = request.ContentType,
                ContentId = Guid.NewGuid().ToString(),
                Title = request.Title,
                Body = request.Body,
                Translations = request.Translations ?? new Dictionary<string, string>(),
                Status = string.IsNullOrWhiteSpace(request.Status) ? "draft" : request.Status,
                CreatedAt = DateTime.UtcNow,
                PublishedAt = request.Status == "published" ? DateTime.UtcNow : null,
                CreatedBy = adminId
            };

            await _context.SaveAsync(content);
            _logger.LogInformation($"Created CMS content {content.ContentId} by admin {adminId}");
            return content;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error creating CMS content: {ex.Message}");
            throw;
        }
    }

    public async Task<CMSContent> UpdateContentAsync(string contentType, string contentId, CreateContentRequest request)
    {
        try
        {
            var content = await GetContentAsync(contentType, contentId);

            content.Title = request.Title ?? content.Title;
            content.Body = request.Body ?? content.Body;
            content.Translations = request.Translations ?? content.Translations;

            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                content.Status = request.Status;
                if (request.Status == "published")
                {
                    content.PublishedAt = DateTime.UtcNow;
                }
                else if (request.Status != "published")
                {
                    content.PublishedAt = null;
                }
            }

            await _context.SaveAsync(content);
            _logger.LogInformation($"Updated CMS content {contentId}");
            return content;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error updating CMS content: {ex.Message}");
            throw;
        }
    }

    public async Task<CMSContent> PublishContentAsync(string contentType, string contentId)
    {
        try
        {
            var content = await GetContentAsync(contentType, contentId);
            content.Status = "published";
            content.PublishedAt = DateTime.UtcNow;

            await _context.SaveAsync(content);
            _logger.LogInformation($"Published CMS content {contentId}");
            return content;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error publishing CMS content: {ex.Message}");
            throw;
        }
    }

    public async Task<CMSContent> ArchiveContentAsync(string contentType, string contentId)
    {
        try
        {
            var content = await GetContentAsync(contentType, contentId);
            content.Status = "archived";
            content.PublishedAt = null;

            await _context.SaveAsync(content);
            _logger.LogInformation($"Archived CMS content {contentId}");
            return content;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error archiving CMS content: {ex.Message}");
            throw;
        }
    }

    public async Task DeleteContentAsync(string contentType, string contentId)
    {
        try
        {
            var content = await _context.LoadAsync<CMSContent>(contentType, contentId);
            if (content == null)
            {
                throw new KeyNotFoundException($"Content {contentId} not found");
            }
            await _context.DeleteAsync(content);
            _logger.LogInformation($"Deleted CMS content {contentId}");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error deleting CMS content: {ex.Message}");
            throw;
        }
    }
}
