import Link from "next/link";
import { ctaUrl } from "../_lib/cta";
import HeroMockup from "./HeroMockup";

export default function Hero() {
  return (
    <section className="container-page pt-20 pb-24 md:pt-32 md:pb-40">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Tell me what <span className="text-critical">just broke</span>.
            <br />
            In plain English. In seconds.
          </h1>
          <p className="mt-6 text-lg text-muted max-w-xl">
            StackSift watches your logs, fires alerts when something cascades,
            and explains the root cause with AI — built for solo devs and small
            teams, priced for them too.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={ctaUrl("free", "hero-primary")}
              className="plausible-event-name=cta-click plausible-event-tier=free px-6 py-3 rounded-lg bg-low text-white font-medium hover:opacity-90 transition"
            >
              Start free →
            </Link>
            <a
              href="#demo"
              data-plausible-event-name="demo-modal-cta"
              className="px-6 py-3 rounded-lg border border-line text-primary hover:bg-elevated transition"
            >
              Watch the 90-second demo
            </a>
            <a
              href="#pricing"
              className="px-6 py-3 rounded-lg text-muted hover:text-primary transition"
            >
              See pricing
            </a>
          </div>
        </div>
        <HeroMockup />
      </div>
    </section>
  );
}
