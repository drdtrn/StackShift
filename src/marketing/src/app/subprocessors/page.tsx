import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Subprocessors",
  description: "Third-party services StackSift uses to operate the platform.",
  robots: { index: false, follow: true },
};

type Subprocessor = { name: string; purpose: string; region: string };

const SUBPROCESSORS: readonly Subprocessor[] = [
  {
    name: "Vercel",
    purpose: "Marketing site hosting (stacksift.io)",
    region: "Global edge",
  },
  {
    name: "Hetzner Cloud",
    purpose: "Application + database + log indexing",
    region: "EU (Falkenstein, Germany)",
  },
  {
    name: "OpenAI",
    purpose: "Embeddings (text-embedding-3-small) and chat completion (gpt-4o-mini) for AI root-cause analyses",
    region: "US",
  },
  {
    name: "Plausible",
    purpose: "Privacy-friendly site analytics (self-hosted at plausible.stacksift.io)",
    region: "EU",
  },
];

export default function SubprocessorsPage() {
  return (
    <main className="container-page py-24 max-w-3xl">
      <h1 className="text-4xl font-bold">Subprocessors</h1>
      <p className="mt-2 text-sm text-muted">Last updated: TBD</p>
      <p className="mt-6 text-muted leading-relaxed">
        StackSift uses the following third-party services to operate the
        platform. Email{" "}
        <a
          href="mailto:dardan.ternava@gjirafa.com"
          className="text-primary underline"
        >
          dardan.ternava@gjirafa.com
        </a>{" "}
        with any questions.
      </p>
      <div className="mt-10 overflow-x-auto">
        <table className="w-full text-left border border-line rounded-xl overflow-hidden min-w-[500px]">
          <thead className="bg-surface">
            <tr>
              <th scope="col" className="p-4 font-semibold">
                Service
              </th>
              <th scope="col" className="p-4 font-semibold">
                Purpose
              </th>
              <th scope="col" className="p-4 font-semibold">
                Region
              </th>
            </tr>
          </thead>
          <tbody>
            {SUBPROCESSORS.map((s) => (
              <tr key={s.name} className="border-t border-line">
                <th scope="row" className="p-4 font-medium text-left">
                  {s.name}
                </th>
                <td className="p-4 text-muted">{s.purpose}</td>
                <td className="p-4 text-muted">{s.region}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-12 text-sm text-muted">
        <Link href="/" className="hover:text-primary">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
