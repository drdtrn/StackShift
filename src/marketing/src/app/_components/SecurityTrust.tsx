type Point = { title: string; body: string };

const POINTS: readonly Point[] = [
  {
    title: "Multi-tenant by construction",
    body: "Per-org Postgres rows, per-org Elasticsearch indices, per-org S3 key prefixes, per-org SignalR groups. You cannot see another tenant’s data even if a bug tries.",
  },
  {
    title: "Auth handled by Keycloak",
    body: "Industry-standard OIDC + PKCE. Tokens never touch JavaScript — only an HTTP-only session cookie.",
  },
  {
    title: "The agent is open source",
    body: "Read the code before you run the binary. Coming soon — track progress on GitHub.",
  },
];

export default function SecurityTrust() {
  return (
    <section className="container-page py-24 border-t border-line">
      <h2 className="text-3xl md:text-4xl font-bold">Trust, by design.</h2>
      <div className="mt-10 grid md:grid-cols-3 gap-6">
        {POINTS.map((p) => (
          <div
            key={p.title}
            className="p-6 bg-surface border border-line rounded-xl"
          >
            <div className="text-lg font-semibold">{p.title}</div>
            <p className="mt-2 text-muted">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
