using System.Text.Json;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using StackSift.Application.Interfaces;

namespace StackSift.Infrastructure.Caching;

public class RedisCacheService(IConnectionMultiplexer redis, ILogger<RedisCacheService> logger)
    : ICacheService
{
    private readonly IDatabase _db = redis.GetDatabase();

    public async Task<T?> GetAsync<T>(string key, CancellationToken ct = default)
    {
        try
        {
            var value = await _db.StringGetAsync(key);
            if (!value.HasValue)
                return default;
            return JsonSerializer.Deserialize<T>((string)value!);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Redis GetAsync failed for key {Key}", key);
            return default;
        }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default)
    {
        try
        {
            var json = JsonSerializer.Serialize(value);
            await _db.StringSetAsync(key, json, ttl);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Redis SetAsync failed for key {Key}", key);
        }
    }

    public async Task RemoveAsync(string key, CancellationToken ct = default)
    {
        try
        {
            await _db.KeyDeleteAsync(key);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Redis RemoveAsync failed for key {Key}", key);
        }
    }
}
