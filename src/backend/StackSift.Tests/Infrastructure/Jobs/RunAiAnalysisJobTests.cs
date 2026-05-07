using Elastic.Clients.Elasticsearch;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.ValueObjects;
using StackSift.Infrastructure.Configuration;
using StackSift.Infrastructure.Jobs;
using StackSift.Infrastructure.Persistence;
using StackSift.Tests.Helpers;

namespace StackSift.Tests.Infrastructure.Jobs;

public class RunAiAnalysisJobTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly Mock<IVectorSearchService> _vectorSearch = new();
    private readonly Mock<IAiAnalysisService> _aiService = new();
    private readonly Mock<IAlertHubService> _alertHub = new();

    public RunAiAnalysisJobTests()
    {
        _db = TestAppDbContext.Create();
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task ExecuteAsync_AlreadyCompleted_NoOp()
    {
        var analysis = CreateAnalysis(AiAnalysisStatus.Completed);
        _db.AiAnalyses.Add(analysis);
        await _db.SaveChangesAsync();

        var sut = CreateJob(new OpenAiOptions { ApiKey = "sk-test" });
        await sut.ExecuteAsync(analysis.Id, CancellationToken.None);

        _vectorSearch.Verify(v => v.EmbedAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _aiService.Verify(a => a.AnalyzeAsync(It.IsAny<IncidentContext>(), It.IsAny<IReadOnlyList<SimilarIncident>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_NoApiKey_TransitionsToFailed()
    {
        var incident = CreateIncident();
        var analysis = CreateAnalysis(AiAnalysisStatus.Pending, incident.Id);
        _db.Incidents.Add(incident);
        _db.AiAnalyses.Add(analysis);
        await _db.SaveChangesAsync();

        var sut = CreateJob(new OpenAiOptions { ApiKey = "" });
        await sut.ExecuteAsync(analysis.Id, CancellationToken.None);

        var updated = await _db.AiAnalyses.FindAsync(analysis.Id);
        Assert.Equal(AiAnalysisStatus.Failed, updated!.Status);
        Assert.Contains("not configured", updated.Summary, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ExecuteAsync_HappyPath_CompletesAndBroadcasts()
    {
        var incident = CreateIncident();
        var analysis = CreateAnalysis(AiAnalysisStatus.Pending, incident.Id);
        _db.Incidents.Add(incident);
        _db.AiAnalyses.Add(analysis);
        await _db.SaveChangesAsync();

        var embedding = new float[1536];
        _vectorSearch.Setup(v => v.EmbedAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(embedding);

        _aiService.Setup(a => a.AnalyzeAsync(It.IsAny<IncidentContext>(), It.IsAny<IReadOnlyList<SimilarIncident>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiAnalysisResult("summary", "root cause", ["fix1"], 0.8));

        _alertHub.Setup(h => h.BroadcastAiAnalysisCompletedAsync(It.IsAny<AiAnalysisDto>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var sut = CreateJob(new OpenAiOptions { ApiKey = "sk-test" });
        await sut.ExecuteAsync(analysis.Id, CancellationToken.None);

        var updated = await _db.AiAnalyses.FindAsync(analysis.Id);
        Assert.Equal(AiAnalysisStatus.Completed, updated!.Status);
        Assert.Equal("summary", updated.Summary);
        Assert.Equal("root cause", updated.RootCause);
        Assert.Single(updated.SuggestedFixes!);
        Assert.Equal(0.8, updated.ConfidenceScore);
        Assert.NotNull(updated.CompletedAt);

        _alertHub.Verify(h => h.BroadcastAiAnalysisCompletedAsync(
            It.Is<AiAnalysisDto>(dto => dto.ProjectId == incident.ProjectId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_AiAnalysisException_FailsWithoutRethrow()
    {
        var incident = CreateIncident();
        var analysis = CreateAnalysis(AiAnalysisStatus.Pending, incident.Id);
        _db.Incidents.Add(incident);
        _db.AiAnalyses.Add(analysis);
        await _db.SaveChangesAsync();

        _vectorSearch.Setup(v => v.EmbedAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new float[1536]);

        _aiService.Setup(a => a.AnalyzeAsync(It.IsAny<IncidentContext>(), It.IsAny<IReadOnlyList<SimilarIncident>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new AiAnalysisException("parse failed"));

        var sut = CreateJob(new OpenAiOptions { ApiKey = "sk-test" });

        await sut.ExecuteAsync(analysis.Id, CancellationToken.None);

        var updated = await _db.AiAnalyses.FindAsync(analysis.Id);
        Assert.Equal(AiAnalysisStatus.Failed, updated!.Status);
        _alertHub.Verify(h => h.BroadcastAiAnalysisCompletedAsync(It.IsAny<AiAnalysisDto>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_GenericException_Rethrows()
    {
        var incident = CreateIncident();
        var analysis = CreateAnalysis(AiAnalysisStatus.Pending, incident.Id);
        _db.Incidents.Add(incident);
        _db.AiAnalyses.Add(analysis);
        await _db.SaveChangesAsync();

        _aiService.Setup(a => a.AnalyzeAsync(It.IsAny<IncidentContext>(), It.IsAny<IReadOnlyList<SimilarIncident>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("transient network error"));

        var sut = CreateJob(new OpenAiOptions { ApiKey = "sk-test" });

        await Assert.ThrowsAsync<HttpRequestException>(() =>
            sut.ExecuteAsync(analysis.Id, CancellationToken.None));
    }

    private RunAiAnalysisJob CreateJob(OpenAiOptions openAiOpts)
    {
        var esSettings = new ElasticsearchClientSettings(new Uri("http://localhost:9200"));
        var esClient = new ElasticsearchClient(esSettings);

        return new RunAiAnalysisJob(
            _db,
            esClient,
            _vectorSearch.Object,
            _aiService.Object,
            _alertHub.Object,
            Options.Create(openAiOpts),
            NullLogger<RunAiAnalysisJob>.Instance);
    }

    private static Incident CreateIncident() => new()
    {
        Id = Guid.NewGuid(),
        OrganizationId = Guid.NewGuid(),
        ProjectId = Guid.NewGuid(),
        Title = "Test incident",
        Status = IncidentStatus.Open,
        Severity = AlertSeverity.High,
        StartedAt = DateTimeOffset.UtcNow,
    };

    private static AiAnalysis CreateAnalysis(AiAnalysisStatus status, Guid? incidentId = null) => new()
    {
        Id = Guid.NewGuid(),
        IncidentId = incidentId ?? Guid.NewGuid(),
        OrganizationId = Guid.NewGuid(),
        Status = status,
        SuggestedFixes = [],
        RelevantLogIds = [],
    };
}
