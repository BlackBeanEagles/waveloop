import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";
import "./comic.css";
import ChatWidget from "@/components/ChatWidget";
import Navigation from "@/components/Navigation";
import { siteUrl } from "@/lib/config";
import QuestGame from "@/components/QuestGame";

const display = localFont({ src: "../assets/fonts/PublicSans-700.woff", variable: "--font-heading", weight: "700", display: "swap" });
const comic = localFont({ src: "../assets/fonts/Bangers.woff", variable: "--font-lettering", weight: "400", display: "swap" });
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "WaveLoop · Your first AI side quest",
  description: "Find your AI project, build it in a free 60-minute workshop, and bring your campus along. A NxtWave Growth Challenge prototype.",
};
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${comic.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <QuestGame>
        <Navigation />
        <main id="main-content" className="relative isolate flex-1 overflow-x-clip">{children}</main>
        <ChatWidget />
        <footer className="site-footer">
          <div><Link href="/" className="footer-brand">waveloop<span>.</span></Link><p>LESS SCROLL. MORE BUILD.</p></div>
          <p>A NxtWave Growth Challenge prototype.<br />Independent project · Not an official NxtWave product.</p>
          <div className="footer-links"><Link href="/live">Workshop check-in ↗</Link><Link href="/admin">Team dashboard ↗</Link></div>
        </footer>
        </QuestGame>
      </body>
    </html>
  );
}
