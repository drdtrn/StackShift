import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How StackSift handles your data.",
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="container-page py-24 max-w-3xl">
      <h1 className="text-4xl font-bold">Privacy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: TBD</p>
      <p className="mt-6 text-muted leading-relaxed">
        The privacy policy is being prepared. In the meantime, please email{" "}
        <a
          href="mailto:dardan.ternava@gjirafa.com"
          className="text-primary underline"
        >
          dardan.ternava@gjirafa.com
        </a>{" "}
        with any questions about how your data is stored, processed, or
        deleted.
      </p>
      <p className="mt-12 text-sm text-muted">
        <Link href="/" className="hover:text-primary">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
