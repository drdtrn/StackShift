type QA = { q: string; a: string };

const ENTRIES: readonly QA[] = [
  {
    q: "How is this different from Datadog?",
    a: "Cheaper, simpler, and the AI summary is built in — not an add-on. We’re designed for one engineer; Datadog is designed for fifty.",
  },
  {
    q: "How do I send logs to StackSift?",
    a: "Three options. (1) Official Serilog sink for .NET apps — five lines of LoggerConfiguration. (2) Official Winston transport for Node.js apps — one transport added to your existing logger. (3) Direct HTTP POST from any language — full curl recipe and API reference in the docs. All three hit the same /api/v1/logs/ingest endpoint.",
  },
  {
    q: "What happens if I exceed the AI-analysis cap?",
    a: "The Analyze button returns a graceful 402 and an upgrade nudge. Nothing else breaks. You upgrade in-app or wait until the month resets.",
  },
  {
    q: "Do I need to change my application code?",
    a: "Yes, lightly. You add the StackSift sink or transport to your existing logger (Serilog or Winston) — about five lines. We do not run an agent on your servers and we do not tail files from disk.",
  },
  {
    q: "How is my data isolated from other customers?",
    a: "Every entity carries an OrganizationId enforced at the repository level. Elasticsearch indices are per-org. S3 keys are namespaced per-org. SignalR groups are scoped per-project. Verified by integration tests.",
  },
  {
    q: "Can I delete my data?",
    a: "Yes. Account deletion hard-deletes all rows, ES indices, and S3 objects. No tombstones.",
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="container-page py-24 border-t border-line">
      <h2 className="text-3xl md:text-4xl font-bold">
        Questions, before you start.
      </h2>
      <div className="mt-10 max-w-3xl">
        {ENTRIES.map(({ q, a }) => (
          <details
            key={q}
            className="group border-b border-line py-5"
          >
            <summary className="cursor-pointer text-lg font-medium flex justify-between items-center list-none">
              <span>{q}</span>
              <span className="text-muted text-2xl transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-muted leading-relaxed">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
