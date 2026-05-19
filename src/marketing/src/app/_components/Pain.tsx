export default function Pain() {
  return (
    <section className="container-page py-20 border-t border-line">
      <pre className="font-mono text-sm md:text-base overflow-x-auto p-6 bg-surface border border-line rounded-lg leading-relaxed">
{`[ERROR] 2026-03-27 02:14:33  NullReferenceException at UserService.cs:142
[WARN]  2026-03-27 02:14:33  Redis connection timeout after 30000ms
[ERROR] 2026-03-27 02:14:34  Database query exceeded timeout (pool exhausted)
[ERROR] 2026-03-27 02:14:34  NullReferenceException at UserService.cs:142
[ERROR] 2026-03-27 02:14:34  NullReferenceException at UserService.cs:142
... 395 more lines ...`}
      </pre>
      <p className="mt-6 text-2xl md:text-3xl font-semibold">
        45 minutes to 3 hours.{" "}
        <span className="text-muted">
          Average time to root cause. At 2 AM. On a Tuesday.
        </span>
      </p>
    </section>
  );
}
