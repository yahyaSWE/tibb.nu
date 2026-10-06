import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { SiteChrome } from "@/components/site-chrome";
import { getSettings } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { databaseConfigured } from "@/lib/database-config";
import "./globals.css";
import "@/components/learning/learning.css";
import "./public-theme.css";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});
const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata: Metadata = {
  title: {
    default: "Tibb.nu — Tradition, kunskap & omtanke",
    template: "%s | Tibb.nu",
  },
  description:
    "Klassisk kinesisk medicin i ljuset av den Profetiska vägledningen. Boka ett besök, upptäck våra kurser och läs artiklar hos Tibb.nu.",
  icons: { icon: "/favicon.svg" },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const needsDatabase = !!process.env.VERCEL && !databaseConfigured();
  const [settings, user] = needsDatabase
    ? [{ siteName: "Tibb.nu", email: "" }, null]
    : await Promise.all([getSettings(), getCurrentUser()]);
  return (
    <html lang="sv" data-scroll-behavior="smooth">
      <body className={`${serif.variable} ${sans.variable}`}>
        <SiteChrome
          siteName={settings.siteName || "Tibb.nu"}
          contactEmail={settings.email || ""}
          user={user ? { name: user.name, role: user.role } : null}
        >
          {children}
        </SiteChrome>
      </body>
    </html>
  );
}
