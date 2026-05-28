namespace StackSift.Application.Interfaces;

public interface IApiKeyHasher
{
    string Generate();
    string Hash(string apiKey);
    bool Verify(string apiKey, string hash);
}
