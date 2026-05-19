import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "StackSift is built by three engineers as their LIFE Fellows 2026 capstone — an AI-powered SRE platform priced for solo devs and small teams.",
};

export default function AboutPage() {
  return (
    <main className="container-page py-24">
      <h1 className="text-4xl font-bold">About StackSift</h1>
      <p className="mt-6 text-lg text-muted max-w-2xl">
        StackSift is built by three engineers — Dardan, Jona, and Albin — as
        their LIFE Fellows 2026 capstone. The mission is simple: every solo dev
        running production code deserves a 2 AM safety net that doesn’t cost
        $500/month.
      </p>
      <p className="mt-4 text-muted max-w-2xl">
        Full content drops in once the team page is finalised.
      </p>
      <p className="mt-12 text-sm text-muted">
        <Link href="/" className="hover:text-primary">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
