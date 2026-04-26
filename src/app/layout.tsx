import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { loadNewsAction } from "./actions/news";
import { AppProvider } from "../components/app-provider.jsx";
import { TopBar } from "../components/top-bar.jsx";
import { createTranslator, getLocaleTag, normalizeLanguage } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "SeniorNett",
  description: "SeniorNett ist ein ruhiger, gut lesbarer Treffpunkt fuer Seniorinnen und Senioren.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const language = normalizeLanguage(requestHeaders.get("x-user-language"));
  const t = createTranslator(language);
  const initialIdentity = {
    loading: false,
    userName: requestHeaders.get("x-user-name")?.trim() || t("topbar.userUnknown"),
    deviceId: requestHeaders.get("x-device-id")?.trim() || "unbekannt",
    vpnIp: requestHeaders.get("x-vpn-ip")?.trim() || "-",
    role: requestHeaders.get("x-user-role")?.trim() || "-",
    language,
    source: "server",
  };

  return (
    <html lang={getLocaleTag(language)} suppressHydrationWarning>
      <body>
        <AppProvider loadNewsAction={loadNewsAction} initialIdentity={initialIdentity}>
          <div className="tablet-screen">
            <TopBar />
            <main className="content">{children}</main>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
