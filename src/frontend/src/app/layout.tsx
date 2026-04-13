import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/components/providers/Providers";
import { ToastContainer } from "@/app/components/ui/Toast";

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
  title: "StackSift",
  description: "AI-Powered SRE & Log-Analysis Platform",
};

/**
 * Root layout — Server Component.
 *
 * Structure:
 *   <html>
 *     <body>
 *       <Providers>        ← client boundary (TanStack Query, theme — added later)
 *         {children}       ← route group layouts render here
 *       </Providers>
 *       <ToastContainer /> ← outside Providers so toasts survive provider rerenders
 *     </body>
 *   </html>
 *
 * suppressHydrationWarning on <html> is required because the dark class is set
 * server-side but a theme toggle (FE-06) may change it client-side on first paint.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-canvas text-primary font-sans antialiased">
        <Providers>{children}</Providers>
        <ToastContainer />
      </body>
    </html>
  );
}
