import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk, Public_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Glow } from "@/components/Art";

const display = Space_Grotesk({ variable: "--font-display", subsets: ["latin"], weight: ["500", "700"] });
const body = Public_Sans({ variable: "--font-body", subsets: ["latin"], weight: ["400", "600", "700"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WaveLoop · NxtWave AI Workshop",
  description: "Get your personal AI project idea and a free seat at NxtWave's 'Build Your First AI Project in 60 Minutes' workshop.",
};

const STUDENT = [
  { href: "/", label: "Workshop" },
  { href: "/whatsapp", label: "WhatsApp bot" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/live", label: "Live room" },
  { href: "/help", label: "Help desk" },
  { href: "/submit", label: "Submit project" },
];
const TEAM = [
  { href: "/ambassador", label: "Ambassadors" },
  { href: "/mentor", label: "Mentors" },
  { href: "/admin", label: "Growth dashboard" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <nav className="sticky top-0 z-50 border-b border-white/10 bg-ink/95 text-white backdrop-blur">
          <div className="no-scrollbar mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2.5 text-sm">
            <Link href="/" className="mr-4 flex shrink-0 items-center gap-2 font-[family-name:var(--font-display)] text-base font-bold tracking-tight">
              <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6">
                <circle cx="12" cy="12" r="11" fill="#B4501F" />
                <path d="M7 13.5a5 5 0 1 0 5-5" fill="none" stroke="#F6F4EF" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M10.5 6.5 12.5 8.5 10.5 10.5" fill="none" stroke="#F6F4EF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>
                Wave<span className="text-sun">Loop</span>
              </span>
            </Link>
            {STUDENT.map((t) => (
              <Link key={t.href} href={t.href} className="shrink-0 rounded-lg px-2.5 py-1 text-white/75 hover:bg-white/10 hover:text-white">
                {t.label}
              </Link>
            ))}
            <span className="mx-2 h-5 w-px shrink-0 bg-white/20" />
            <span className="mr-1 shrink-0 text-[11px] uppercase tracking-widest text-white/40">Team</span>
            {TEAM.map((t) => (
              <Link key={t.href} href={t.href} className="shrink-0 rounded-lg px-2.5 py-1 text-white/75 hover:bg-white/10 hover:text-white">
                {t.label}
              </Link>
            ))}
          </div>
        </nav>
        <main className="relative isolate flex-1 overflow-x-clip">
          <Glow className="-right-48 -top-56 -z-10 h-[560px] w-[560px]" opacity={0.3} />
          <Glow color="blue" className="-left-64 top-[45%] -z-10 h-[560px] w-[560px]" opacity={0.14} />
          {children}
        </main>
        <footer className="border-t border-line py-6 text-center text-xs text-ink-soft">
          WaveLoop is a growth-challenge prototype for NxtWave. Not an official NxtWave product.
        </footer>
      </body>
    </html>
  );
}
