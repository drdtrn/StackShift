using FluentAssertions;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Persistence;
using StackSift.Infrastructure.Persistence.Repositories;
using StackSift.Tests.Helpers;
using StackSift.Tests.Integration;

namespace StackSift.Tests.Infrastructure.Persistence.Repositories;

[Collection("Postgres")]
public class AiAnalysisRepositoryTests(PostgresContainerFixture postgres) : IAsyncLifetime
{
    private AppDbContext _db = null!;
    private FakeCurrentUserService _user = null!;
    private readonly Guid _orgId = Guid.NewGuid();

    public async Task InitializeAsync()
    {
        await postgres.ResetAsync();
        _user = new FakeCurrentUserService { OrganizationId = _orgId };
        _db = postgres.CreateDbContext(_user);
    }

    public async Task DisposeAsync() => await _db.DisposeAsync();

    [Fact]
    public async Task SearchSimilarWithDistanceAsync_ReturnsTopKByAscendingDistance()
    {
        var query = UnitVector(0);
        var near = UnitVector(0);
        var middle = OffsetVector(0, 0.05f);
        var far = UnitVector(1);

        await SeedAnalysisAsync(near);
        await SeedAnalysisAsync(middle);
        await SeedAnalysisAsync(far);

        var sut = new AiAnalysisRepository(_db, _user);

        var results = await sut.SearchSimilarWithDistanceAsync(query, topK: 2);

        results.Should().HaveCount(2);
        results[0].Distance.Should().BeLessThanOrEqualTo(results[1].Distance);
        results[1].Distance.Should().BeLessThan(0.5);
    }

    [Fact]
    public async Task SearchSimilarWithDistanceAsync_ExcludesGivenId()
    {
        var query = UnitVector(0);
        var seed = await SeedAnalysisAsync(UnitVector(0));
        var other = await SeedAnalysisAsync(OffsetVector(0, 0.05f));

        var sut = new AiAnalysisRepository(_db, _user);

        var results = await sut.SearchSimilarWithDistanceAsync(query, topK: 5, excludeId: seed.Id);

        results.Should().ContainSingle();
        results[0].AnalysisId.Should().Be(other.Id);
    }

    [Fact]
    public async Task SearchSimilarWithDistanceAsync_DoesNotLeakAcrossOrganizations()
    {
        var query = UnitVector(0);
        var otherOrgId = Guid.NewGuid();
        var foreign = new AiAnalysis
        {
            Id = Guid.NewGuid(),
            OrganizationId = otherOrgId,
            IncidentId = Guid.NewGuid(),
            Status = AiAnalysisStatus.Completed,
            Embedding = UnitVector(0),
            SuggestedFixes = [],
            RelevantLogIds = [],
        };
        _db.AiAnalyses.Add(foreign);
        await _db.SaveChangesAsync();

        var sut = new AiAnalysisRepository(_db, _user);

        var results = await sut.SearchSimilarWithDistanceAsync(query, topK: 10);

        results.Should().BeEmpty();
    }

    private async Task<AiAnalysis> SeedAnalysisAsync(float[] embedding)
    {
        var analysis = new AiAnalysis
        {
            Id = Guid.NewGuid(),
            OrganizationId = _orgId,
            IncidentId = Guid.NewGuid(),
            Status = AiAnalysisStatus.Completed,
            Embedding = embedding,
            SuggestedFixes = [],
            RelevantLogIds = [],
        };
        _db.AiAnalyses.Add(analysis);
        await _db.SaveChangesAsync();
        return analysis;
    }

    private static float[] UnitVector(int axis)
    {
        var v = new float[1536];
        v[axis] = 1f;
        return v;
    }

    private static float[] OffsetVector(int axis, float perturbation)
    {
        var v = new float[1536];
        v[axis] = 1f - perturbation;
        v[axis + 1] = perturbation;
        return v;
    }
}
