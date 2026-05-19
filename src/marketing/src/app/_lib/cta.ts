export type Tier = "free" | "indie" | "team";

const APP_BASE =
  process.env.NEXT_PUBLIC_APP_BASE_URL ?? "https://app.stacksift.io";

export function ctaUrl(tier: Tier, source: string): string {
  const url = new URL("/login", APP_BASE);
  url.searchParams.set("plan", tier);
  url.searchParams.set("from", `marketing-${source}`);
  return url.toString();
}
