import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import PlausibleProvider from "next-plausible";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://stacksift.io"),
  title: {
    default: "StackSift — AI root-cause analysis for your logs",
    template: "%s · StackSift",
  },
  description:
    "StackSift watches your logs, fires alerts when something cascades, " +
    "and explains the root cause with AI — built for solo devs and small teams.",
  applicationName: "StackSift",
  openGraph: {
    title: "StackSift — AI root-cause analysis for your logs",
    description:
      "Tell me what just broke. In plain English. In seconds. " +
      "Datadog for the solo dev.",
    url: "https://stacksift.io",
    siteName: "StackSift",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StackSift — AI root-cause analysis for your logs",
    description: "Datadog for the solo dev. $0–$79/mo.",
  },
  alternates: { canonical: "https://stacksift.io" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0F1117" },
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
  ],
  width: "device-width",
  initialScale: 1,
};

const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('ss-marketing-theme');
    var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    var theme = stored || (prefersLight ? 'light' : 'dark');
    document.documentElement.classList.add(theme === 'light' ? 'light' : 'dark');
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <PlausibleProvider
          domain="stacksift.io"
          customDomain="https://plausible.stacksift.io"
          selfHosted
          trackOutboundLinks
          taggedEvents
        >
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:px-3 focus:py-2 focus:bg-surface focus:text-primary focus:rounded focus:z-50"
          >
            Skip to content
          </a>
          {children}
        </PlausibleProvider>
      </body>
    </html>
  );
}
