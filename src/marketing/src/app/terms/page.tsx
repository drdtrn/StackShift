import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of service for StackSift.",
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <main className="container-page py-24 max-w-3xl">
      <h1 className="text-4xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">Last updated: TBD</p>
      <p className="mt-6 text-muted leading-relaxed">
        The terms of service are being prepared. Please email{" "}
        <a
          href="mailto:dardan.ternava@gjirafa.com"
          className="text-primary underline"
        >
          dardan.ternava@gjirafa.com
        </a>{" "}
        with any questions while we finalise them.
      </p>
      <p className="mt-12 text-sm text-muted">
        <Link href="/" className="hover:text-primary">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
