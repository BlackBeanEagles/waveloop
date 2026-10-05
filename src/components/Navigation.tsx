"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
const links = [["/", "The workshop"], ["/leaderboard", "Campus leaderboard"], ["/ambassador", "Ambassadors"], ["/help", "Help desk"], ["/submit", "Submit project"]];
export default function Navigation() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Main navigation">
        <Link href="/" className="wordmark" aria-label="WaveLoop home" onClick={() => setOpen(false)}>
          <svg viewBox="0 0 32 32" fill="none" aria-hidden><path d="M4 18c3-13 9-13 12-4s9 9 12-4M4 25c3-13 9-13 12-4s9 9 12-4" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" /></svg>
          waveloop<span className="brand-dot">.</span>
        </Link>
        <button className="nav-toggle" type="button" aria-expanded={open} aria-controls="nav-links" onClick={() => setOpen(!open)}>{open ? "Close ×" : "Menu ☰"}</button>
        <div id="nav-links" className={`nav-links ${open ? "is-open" : ""}`}>
          {links.map(([href, label]) => <Link key={href} href={href} aria-current={path === href ? "page" : undefined} onClick={() => setOpen(false)}>{label}</Link>)}
        </div>
        <Link href="/#project-builder" className="nav-cta" onClick={() => setOpen(false)}>Find my project <span aria-hidden>↗</span></Link>
      </nav>
    </header>
  );
}
