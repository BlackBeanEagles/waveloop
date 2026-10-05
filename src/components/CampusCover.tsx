"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import campusHero from "../../public/images/campus-hero-comic.png";

const projects = [
  { title: "The placement wingman", interest: "resume and job matching", category: "Career", description: "Match your resume to a job. Find what’s missing before the recruiter does.", color: "pink", symbol: "↗", tag: "RESUME × AI" },
  { title: "The movie night decider", interest: "movies", category: "Campus", description: "Six friends. Six moods. One movie everyone can actually agree on.", color: "yellow", symbol: "▶", tag: "MOVIES × AI" },
  { title: "The cricket know-it-all", interest: "cricket", category: "Just for fun", description: "Turn match stats into a little app your group chat will have opinions about.", color: "blue", symbol: "✳", tag: "CRICKET × AI" },
  { title: "The revision sidekick", interest: "study notes and revision", category: "Campus", description: "Turn a wall of notes into bite-sized questions for your next revision session.", color: "blue", symbol: "Aa", tag: "STUDY × AI" },
  { title: "The interview warm-up", interest: "job interview preparation", category: "Career", description: "Practice answering questions about your project before the real conversation.", color: "yellow", symbol: "?", tag: "CAREERS × AI" },
  { title: "The playlist personality", interest: "music", category: "Just for fun", description: "A song-finding app for very specific moods. Yes, post-exam freedom counts.", color: "pink", symbol: "♫", tag: "MUSIC × AI" },
];
const filters = ["All ideas", "Career", "Campus", "Just for fun"];

export default function CampusCover({ onChoose, headline, sub, isEnglish, workshopDate, busy }: { onChoose: (interest: string) => void; headline: string; sub: string; isEnglish: boolean; workshopDate: string; busy: boolean }) {
  const [filter, setFilter] = useState("All ideas");
  const [shuffle, setShuffle] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const visible = filter === "All ideas" ? [...projects.slice(shuffle), ...projects.slice(0, shuffle)].slice(0, 3) : projects.filter(p => p.category === filter);
  function choose(interest: string) { setPicked(interest); onChoose(interest); }
  return <>
    <section className="comic-cover" aria-labelledby="cover-title">
      <div className="cover-window"><span className="window-dots" aria-hidden><i /><i /><i /></span><span>WAVELOOP / THE BUILD SOMETHING ISSUE</span><span>VOL. 001 ↗</span></div>
      <div className="cover-grid">
        <div className="cover-copy">
          <span className="issue-tag">FOR THE “I COULD BUILD THAT” CROWD</span>
          <h1 id="cover-title">{isEnglish ? <>YOUR FIRST<br /><span className="highlight-word">AI SIDE</span><br />QUEST<span className="title-period">.</span></> : headline}</h1>
          <p className="cover-promise">{isEnglish ? headline : sub}</p>
          {isEnglish && <p className="cover-description">One free workshop. One hour. A real project with your name on it. Bring your laptop and that oddly specific interest.</p>}
          <div className="cover-actions"><a className="quest-button" href="#project-builder">Find my side quest <span aria-hidden>↗</span></a><a className="browse-link" href="#idea-playground">Or steal an idea ↓</a></div>
          <p className="cover-date"><span aria-hidden>◷</span> {workshopDate.replace(" · live, 60 minutes", "")}<br /><span className="date-note">LIVE ONLINE · ALL ENGINEERING BRANCHES</span></p>
        </div>
        <div className="cover-art">
          <div className="art-grid" aria-hidden />
          <span className="free-sticker">ZERO<br /><b>₹</b><br />ALL IN.</span>
          <span className="speech-sticker">wait, I built<br /><b>that?!</b></span>
          <Image className="student-collage" src={campusHero} alt="Comic illustration of a college student with headphones, a laptop, and a yellow action burst" sizes="(max-width: 760px) 100vw, 50vw" priority />
          <div className="build-sticker"><span className="smiley" aria-hidden><i /><i /><b /></span><span>LESS SCROLL.<br /><strong>MORE BUILD.</strong></span></div>
          <span className="art-scribble" aria-hidden>✳</span>
          <span className="art-caption-note">your next “made it myself” moment ↖</span>
        </div>
      </div>
      <div className="cover-bottom"><span>NO EXPERIENCE? YOU’RE IN THE RIGHT PLACE.</span><span>BEGINNER ENERGY WELCOME <span aria-hidden>✳</span></span></div>
    </section>
    <div className="comic-ribbon" aria-label="Workshop benefits"><span>60 MINUTES</span><b aria-hidden>✳</b><span>ACTUALLY FREE</span><b aria-hidden>✳</b><span>BUILT BY YOU</span><b aria-hidden>✳</b><span>BETTER WITH FRIENDS</span><b aria-hidden>✳</b></div>
    <section className="idea-playground" id="idea-playground" aria-labelledby="playground-title">
      <div className="chapter-heading"><div><p className="chapter-label">01 / PICK YOUR PLOT</p><h2 id="playground-title">Your interests.<br /><em>Main-character projects.</em></h2></div><p>Not another to-do app.<br />Make something you’d actually use.</p></div>
      <div className="idea-toolbar"><div className="idea-filters" role="group" aria-label="Filter example projects">{filters.map(f => <button type="button" key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}>{f}</button>)}</div><button type="button" className="shuffle-button" onClick={() => { setFilter("All ideas"); setShuffle((shuffle + 1) % projects.length); }}>↻ Shuffle the ideas</button></div>
      <div className="project-shelf" aria-live="polite">{visible.map(p => <article className={`quest-card quest-${p.color}`} key={p.title}>
        <div className="quest-card-top"><span>{p.tag}</span><span>EXAMPLE PROJECT</span></div>
        <div className="quest-symbol" aria-hidden>{p.symbol}<span className="symbol-spark">✧</span></div>
        <h3>{p.title}</h3><p>{p.description}</p>
        <button type="button" disabled={busy} onClick={() => choose(p.interest)}>{picked === p.interest ? "Picked. Make it mine" : "This is my kind of project"}<span aria-hidden>↗</span></button>
      </article>)}</div>
      <p className="ideas-note">These are starting points. Your project finder makes the idea fit your branch and skill level.</p>
    </section>
    <div className="comic-chapter-break"><span>THE ORIGIN STORY STARTS HERE</span><span aria-hidden>↓ ↓ ↓</span><Link href="/leaderboard">Meet the campus crew ↗</Link></div>
  </>;
}
