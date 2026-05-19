type QA = { q: string; a: string };

const ENTRIES: readonly QA[] = [
  {
    q: "How is this different from Datadog?",
    a: "Cheaper, simpler, and the AI summary is built in — not an add-on. We’re designed for one engineer; Datadog is designed for fifty.",
  },
  {
    q: "What does the agent actually collect?",
    a: "Only the log files you point it at. It never reads anything else on the host. The agent is open source — read the code before you run it.",
  },
  {
    q: "What happens if I exceed the AI-analysis cap?",
    a: "The Analyze button returns a graceful 429 and a banner. Nothing else breaks. You upgrade in-app or wait until the month resets.",
  },
  {
    q: "Do I need to change my application code?",
    a: "No. The agent tails your existing log files. The 3-line SDK is optional, for apps that prefer to push.",
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
