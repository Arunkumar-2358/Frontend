import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { THEME_BOOT_SCRIPT, THEME_COOKIE, parseThemePref } from "@/lib/theme";
import { ThemeWatcher } from "@/components/theme-watcher";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Nextenti Recruit CRM", template: "%s · Nextenti Recruit CRM" },
  description: "Healthcare talent lifecycle CRM",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Recruit CRM" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1318" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pref = parseThemePref((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en-IN" data-theme={pref} className={pref === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <ThemeWatcher />
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
