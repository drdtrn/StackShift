namespace StackSift.Application.Interfaces;

public interface IDisposableEmailBlocklist
{
    bool IsDisposable(string email);
}
