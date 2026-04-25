import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./globals.css";
import type { Metadata } from "next";
import { loadNewsAction } from "./actions/news";
import { AppProvider } from "../components/app-provider.jsx";
import { TopBar } from "../components/top-bar.jsx";

export const metadata: Metadata = {
  title: "SeniorNett",
  description: "SeniorNett ist ein ruhiger, gut lesbarer Treffpunkt fuer Seniorinnen und Senioren.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de-CH" suppressHydrationWarning>
      <body>
        <AppProvider loadNewsAction={loadNewsAction}>
          <div className="tablet-screen">
            <TopBar />
            <main className="content">{children}</main>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
