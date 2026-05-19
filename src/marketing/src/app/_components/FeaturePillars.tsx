type Pillar = { title: string; claim: string; backed: string };

const PILLARS: Pillar[] = [
  {
    title: "Live streaming",
    claim: "See errors the moment they happen — no F5, no SSH-tail.",
    backed: "SignalR + Redis backplane",
  },
  {
    title: "Smart alerts",
    claim: "Threshold and pattern rules. No PromQL.",
    backed: "LogBatchConsumer rule evaluation",
  },
  {
    title: "AI root cause",
    claim: "gpt-4o-mini turns 400 log lines into one paragraph.",
    backed: "RAG pipeline · ai-rag-architecture.md",
  },
  {
    title: "Past-incident memory",
    claim: "Every resolved incident teaches the AI about your system.",
    backed: "pgvector HNSW cosine top-3",
  },
];

export default function FeaturePillars() {
  return (
    <section className="container-page py-24 border-t border-line">
      <h2 className="text-3xl md:text-4xl font-bold mb-12">
        Four things, done well.
      </h2>
      <div className="grid md:grid-cols-2 gap-6">
        {PILLARS.map((p) => (
          <div
            key={p.title}
            className="rounded-xl bg-surface border border-line p-6 md:p-8"
          >
            <div className="text-xl font-semibold">{p.title}</div>
            <p className="mt-3 text-primary text-lg">{p.claim}</p>
            <p className="mt-3 text-sm text-muted font-mono">{p.backed}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
