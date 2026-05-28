import Link from "next/link";
import { ctaUrl, type Tier } from "../_lib/cta";

type TierCard = {
  id: Tier;
  name: string;
  price: string;
  ctaLabel: string;
  features: readonly string[];
  highlight?: boolean;
};

const TIERS: readonly TierCard[] = [
  {
    id: "free",
    name: "Free",
    price: "$0/mo",
    ctaLabel: "Start free →",
    features: ["1 project", "7-day retention", "10 AI analyses / mo", "1 user"],
  },
  {
    id: "indie",
    name: "Indie",
    price: "$19/mo",
    ctaLabel: "Start with Indie →",
    highlight: true,
    features: [
      "5 projects",
      "30-day retention",
      "100 AI analyses / mo",
      "1 user",
    ],
  },
  {
    id: "team",
    name: "Team",
    price: "$79/mo",
    ctaLabel: "Start with Team →",
    features: [
      "Unlimited projects",
      "90-day retention",
      "Unlimited AI analyses",
      "Unlimited users + roles",
    ],
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="container-page py-24 border-t border-line">
      <h2 className="text-3xl md:text-4xl font-bold">
        Pricing that fits in your Stripe statement.
      </h2>
      <p className="mt-3 text-muted max-w-2xl">
        No credit card to start. The SDKs are open source. Cancel any time.
      </p>

      <div className="mt-12 grid md:grid-cols-3 gap-6">
        {TIERS.map((t) => {
          const cardClass = t.highlight
            ? "border-low bg-elevated shadow-2xl md:scale-[1.02]"
            : "border-line bg-surface";
          const buttonClass = t.highlight
            ? "bg-low text-white hover:opacity-90"
            : "border border-line text-primary hover:bg-elevated";

          return (
            <div
              key={t.id}
              className={`rounded-2xl border p-8 flex flex-col ${cardClass}`}
            >
              <div className="text-xl font-semibold">{t.name}</div>
              <div className="mt-2 text-4xl font-bold">{t.price}</div>
              <ul className="mt-6 space-y-2 text-muted flex-1">
                {t.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link
                href={ctaUrl(t.id, `pricing-${t.id}`)}
                className={`plausible-event-name=cta-click plausible-event-tier=${t.id} mt-8 px-5 py-3 rounded-lg text-center font-medium transition ${buttonClass}`}
              >
                {t.ctaLabel}
              </Link>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-sm text-muted max-w-2xl">
        We’re a 3-person team. Your money goes into making this better, not
        into a sales department.
      </p>
    </section>
  );
}
