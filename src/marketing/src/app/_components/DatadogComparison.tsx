type Row = readonly [label: string, datadog: string, stacksift: string];

const ROWS: readonly Row[] = [
  ["Designed for", "50-engineer teams with SRE", "Solo devs · 2–8-engineer teams"],
  ["Time to first useful insight", "A week of config", "10 minutes"],
  ["Monthly cost (small team)", "$500–$5,000", "$0–$79"],
  [
    "Root-cause explanation",
    "“Here’s a graph”",
    "“Here’s a paragraph that names the bug”",
  ],
  ["Open-source agent", "No", "Yes"],
];

export default function DatadogComparison() {
  return (
    <section className="container-page py-24 border-t border-line">
      <h2 className="text-3xl md:text-4xl font-bold">
        Why not just use Datadog?
      </h2>
      <p className="mt-3 text-muted max-w-2xl">
        Because you’re not their customer. We’re not theirs either.
      </p>
      <div className="mt-10 overflow-x-auto">
        <table className="w-full text-left border border-line rounded-xl overflow-hidden min-w-[600px]">
          <thead className="bg-surface">
            <tr>
              <th scope="col" className="p-4" />
              <th scope="col" className="p-4 text-muted font-semibold">
                Datadog / New Relic
              </th>
              <th scope="col" className="p-4 text-low font-semibold">
                StackSift
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, dd, ss]) => (
              <tr key={label} className="border-t border-line">
                <th scope="row" className="p-4 font-medium text-left">
                  {label}
                </th>
                <td className="p-4 text-muted">{dd}</td>
                <td className="p-4 text-primary">{ss}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
