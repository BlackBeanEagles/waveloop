"use client";

import { useEffect, useRef, useState } from "react";
import { useQuestGame, type QuestEvent } from "@/components/QuestGame";

const kit = ["Laptop ready", "Browser open", "Got an idea"];

export default function QuestConsole({ branch, interest, skill, stage }: { branch: string; interest: string; skill: string; stage: "idea" | "register" | "otp" }) {
  const { award } = useQuestGame();
  const [tab, setTab] = useState<"loadout" | "practice">("loadout");
  const [packed, setPacked] = useState<string[]>([]);
  const [duration, setDuration] = useState(300);
  const [remaining, setRemaining] = useState(300);
  const [running, setRunning] = useState(false);
  const deadline = useRef(0);
  const active = running && remaining > 0;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) award("practice_complete");
    }, 250);
    return () => clearInterval(id);
  }, [active, award]);

  function startPause() {
    if (active) { setRunning(false); return; }
    const next = remaining || duration;
    setRemaining(next);
    deadline.current = Date.now() + next * 1000;
    setRunning(true);
  }
  function reset(seconds = duration) { setRunning(false); setDuration(seconds); setRemaining(seconds); }
  const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
  const seconds = (remaining % 60).toString().padStart(2, "0");
  const stageIndex = ["idea", "register", "otp"].indexOf(stage);
  function pack(item: string, index: number) {
    if (!packed.includes(item)) award((["kit_laptop", "kit_browser", "kit_idea"] as QuestEvent[])[index]);
    setPacked(p => p.includes(item) ? p.filter(v => v !== item) : [...p, item]);
  }
  function moveTab(e: React.KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next = e.key === "Home" ? "loadout" : e.key === "End" ? "practice" : tab === "loadout" ? "practice" : "loadout";
    setTab(next);
    document.getElementById(`${next}-tab`)?.focus();
  }

  return <section className="quest-console" aria-label="Player console">
    <div className="console-header"><span><span className="console-led" /> PLAYER CONSOLE</span><Gamepad /><span>{active ? `${minutes}:${seconds}` : "01—P"}</span></div>
    <div className="console-tabs" role="tablist" aria-label="Player console panels">
      <button type="button" role="tab" id="loadout-tab" aria-controls="loadout-panel" tabIndex={tab === "loadout" ? 0 : -1} aria-selected={tab === "loadout"} onKeyDown={moveTab} onClick={() => setTab("loadout")}>▣ Your loadout</button>
      <button type="button" role="tab" id="practice-tab" aria-controls="practice-panel" tabIndex={tab === "practice" ? 0 : -1} aria-selected={tab === "practice"} onKeyDown={moveTab} onClick={() => setTab("practice")}>◷ Practice round</button>
    </div>
    <div role="tabpanel" id="loadout-panel" aria-labelledby="loadout-tab" hidden={tab !== "loadout"}>
      <div className="player-readout"><div className="player-avatar" aria-hidden><Gamepad /><span>P1</span></div><div><span className="console-small">PLAYER CLASS</span><h3>{branch} builder</h3><span className="player-skill">{skill === "beginner" ? "Rookie · learning the ropes" : skill === "confident" ? "Explorer · ready for a challenge" : "Builder · a few projects in"}</span></div></div>
      <div className="equipped-slot"><span className="console-small">EQUIPPED INTEREST</span><strong>{interest || "No idea equipped… yet."}</strong><span>{interest ? "Ready for your project finder ↗" : "Pick a quest card or type your own."}</span></div>
      <div className="mission-save"><span className="console-small">STORY PROGRESS</span><div className="save-slots">{["IDEA", "REGISTER", "VERIFY"].map((s, i) => <span key={s} className={i <= stageIndex ? "unlocked" : ""} aria-current={i === stageIndex ? "step" : undefined}><i />{s}</span>)}</div></div>
      <div className="inventory-heading"><span>PACK YOUR KIT</span><span>{packed.length}/3 READY</span></div>
      <div className="inventory-slots">{kit.map((item, i) => <label key={item} className={packed.includes(item) ? "is-packed" : ""}><input type="checkbox" checked={packed.includes(item)} onChange={() => pack(item, i)} /><span aria-hidden>{["▰", "⌘", "ϟ"][i]}</span><b>{item}</b></label>)}</div>
      <p className="console-hint" aria-live="polite">{packed.length === 3 ? "Kit packed. You’re ready to make something." : "Optional checklist. Tick what you have ready."}</p>
    </div>
    <div role="tabpanel" id="practice-panel" aria-labelledby="practice-tab" hidden={tab !== "practice"}>
      <p className="practice-intro">A little focus before the big build.</p>
      <div className="timer-presets" role="group" aria-label="Practice timer duration">{[300, 900, 1500].map(s => <button type="button" key={s} aria-pressed={s === duration} onClick={() => reset(s)}>{s / 60} MIN</button>)}</div>
      <div className="timer-display" role="timer" aria-label={`${minutes} minutes ${seconds} seconds remaining`}><span>{minutes}</span><b>:</b><span>{seconds}</span></div>
      <div className="timer-track" aria-hidden><span style={{ width: `${100 * (duration - remaining) / duration}%` }} /></div>
      <div className="timer-controls"><button type="button" onClick={startPause}>{active ? "Ⅱ Pause" : remaining === 0 ? "↻ Play again" : "▶ Start round"}</button><button type="button" onClick={() => reset()}>Reset</button></div>
      <p className="practice-task"><b>YOUR MINI MISSION</b><br />Write down one problem your friends keep complaining about. Could a small app help?</p>
      <p className="console-hint" aria-live="polite">{remaining === 0 ? "Round complete. Take your idea to the project finder." : "Optional practice timer, not the workshop countdown."}</p>
    </div>
    <div className="console-base" aria-hidden><span>+ ━━ +</span><span>WAVELOOP / BUILD MODE</span><i /><i /></div>
  </section>;
}

function Gamepad() {
  return <svg aria-hidden width="34" height="24" viewBox="0 0 34 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 5h14c3 0 4 2 5 6l2 6c1 5-3 6-5 3l-4-4H12l-4 4c-2 3-6 2-5-3l2-6c1-4 2-6 5-6Z" /><path d="M9 9v6m-3-3h6" /><circle cx="24" cy="10" r="1" fill="currentColor" /><circle cx="27" cy="13" r="1" fill="currentColor" /></svg>;
}
