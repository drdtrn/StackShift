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
 *     <head>
 *       <script>           ← inline anti-FOUC script (runs before first paint)
 *     <body>
 *       <Providers>        ← client boundary (TanStack Query, theme)
 *         {children}       ← route group layouts render here
 *       </Providers>
 *       <ToastContainer /> ← outside Providers so toasts survive provider rerenders
 *     </body>
 *   </html>
 *
 * suppressHydrationWarning on <html> is required because the inline script
 * adds 'dark' or 'light' to the class list before React hydrates, causing a
 * mismatch between the server-rendered HTML and the client DOM.
 *
 * Anti-FOUC script logic (mirrors src/app/lib/resolve-theme.ts):
 *   1. Read 'stacksift-ui-preferences' from localStorage.
 *   2. Parse the Zustand-persisted theme value (state.theme).
 *   3. Apply 'dark' or 'light' class to <html> before first paint.
 *   4. Fall back to prefers-color-scheme if no preference is stored.
 */

// Inline script content (raw JS — cannot import modules).
// Logic must be kept in sync with src/app/lib/resolve-theme.ts.
const themeInitScript = `(function(){
  try{
    var raw=localStorage.getItem('stacksift-ui-preferences');
    var dark=false;
    if(raw){
      try{
        var s=JSON.parse(raw);
        var t=s&&s.state&&s.state.theme;
        if(t==='dark'){dark=true;}
        else if(t==='light'){dark=false;}
        else{dark=window.matchMedia('(prefers-color-scheme: dark)').matches;}
      }catch(e){dark=window.matchMedia('(prefers-color-scheme: dark)').matches;}
    }else{dark=window.matchMedia('(prefers-color-scheme: dark)').matches;}
    document.documentElement.classList.add(dark?'dark':'light');
  }catch(e){}
})();`;

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
      {/* Anti-FOUC: set theme class before React hydrates to avoid flash */}
      <head>
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-canvas text-primary font-sans antialiased">
        <Providers>{children}</Providers>
        <ToastContainer />
      </body>
    </html>
  );
}
