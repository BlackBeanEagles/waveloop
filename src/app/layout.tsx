import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WaveLoop · NxtWave AI Workshop",
  description: "Get your personal AI project idea and a free seat at NxtWave's 'Build Your First AI Project in 60 Minutes' workshop.",
};

const TOUR = [
  { href: "/", label: "Student page" },
  { href: "/whatsapp", label: "WhatsApp bot" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/ambassador", label: "Ambassadors" },
  { href: "/live", label: "Live workshop" },
  { href: "/help", label: "Help desk" },
  { href: "/mentor", label: "Mentors" },
  { href: "/submit", label: "AI grading" },
  { href: "/admin", label: "Growth dashboard" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <nav className="sticky top-0 z-50 border-b border-white/10 bg-ink text-white">
          <div className="mx-auto flex max-w-6xl items-center gap-4 overflow-x-auto px-4 py-2 text-sm">
            <Link href="/" className="shrink-0 font-bold tracking-tight">
              Wave<span className="text-sun">Loop</span>
            </Link>
            <span className="hidden shrink-0 text-xs text-white/40 sm:inline">system tour →</span>
            {TOUR.map((t) => (
              <Link key={t.href} href={t.href} className="shrink-0 rounded-lg px-2 py-1 text-white/75 hover:bg-white/10 hover:text-white">
                {t.label}
              </Link>
            ))}
          </div>
        </nav>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          WaveLoop is a growth-challenge prototype for NxtWave. Not an official NxtWave product.
        </footer>
      </body>
    </html>
  );
}
