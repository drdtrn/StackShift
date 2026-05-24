using Xunit.Abstractions;
using Xunit.Sdk;

namespace StackSift.Tests.Helpers;

public sealed class AlphabeticalTestCaseOrderer : ITestCaseOrderer
{
    public IEnumerable<TTestCase> OrderTestCases<TTestCase>(IEnumerable<TTestCase> testCases)
        where TTestCase : ITestCase
        => testCases.OrderBy(c => c.TestMethod.Method.Name, StringComparer.Ordinal);
}
