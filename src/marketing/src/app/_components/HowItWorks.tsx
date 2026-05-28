type Step = { n: number; title: string; body: string };

const STEPS: Step[] = [
  {
    n: 1,
    title: "Connect",
    body: "Add the Serilog sink (.NET) or Winston transport (Node.js) to your app in ~5 lines. Or POST JSON directly with curl — full API reference in the docs.",
  },
  {
    n: 2,
    title: "Stream",
    body: "Logs flow in, your dashboard updates live, and alerts fire on the patterns you care about.",
  },
  {
    n: 3,
    title: "Resolve",
    body: "Click Analyze with AI on any incident. ~8 seconds later you have a root cause and a fix.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="container-page py-24 border-t border-line"
    >
      <h2 className="text-3xl md:text-4xl font-bold mb-12">How it works</h2>
      <ol className="grid md:grid-cols-3 gap-6">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="rounded-xl bg-surface border border-line p-6"
          >
            <div className="text-low font-mono text-2xl">
              {String(s.n).padStart(2, "0")}
            </div>
            <div className="mt-2 text-xl font-semibold">{s.title}</div>
            <p className="mt-3 text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
