"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const EVENTS = {
  choose_project: { xp: 10, title: "QUEST EQUIPPED", detail: "Your interest is loaded. Make it your own." },
  build_plan: { xp: 25, title: "BLUEPRINT UNLOCKED", detail: "Your project plan is ready. Next: reserve your seat." },
  register: { xp: 25, title: "CHECKPOINT REACHED", detail: "One verification code away from joining the crew." },
  verified: { xp: 50, title: "YOU’RE IN!", detail: "Seat verified. Your next chapter starts here." },
  kit_laptop: { xp: 5, title: "GEAR EQUIPPED", detail: "Laptop: check. Your workshop kit is coming together." },
  kit_browser: { xp: 5, title: "GEAR EQUIPPED", detail: "Browser ready. One less thing before the build." },
  kit_idea: { xp: 5, title: "IDEA EQUIPPED", detail: "Curiosity is a pretty good superpower." },
  practice_complete: { xp: 20, title: "PRACTICE COMPLETE", detail: "A little focus goes a long way. Take a breather." },
} as const;
export type QuestEvent = keyof typeof EVENTS;
const STORAGE_KEY = "wl_quest_progress_v1";
const GameContext = createContext<{ award: (event: QuestEvent) => void }>({ award: () => {} });
export const useQuestGame = () => useContext(GameContext);

export default function QuestGame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const studentMode = !path.startsWith("/admin") && !path.startsWith("/mentor");
  const [earned, setEarned] = useState<QuestEvent[]>([]);
  const earnedRef = useRef<QuestEvent[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [effects, setEffects] = useState(true);
  const [burst, setBurst] = useState<{ id: number; x: number; y: number } | null>(null);
  const [notice, setNotice] = useState<QuestEvent | null>(null);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(saved)) {
        const valid = [...new Set(saved.filter((e): e is QuestEvent => typeof e === "string" && Object.hasOwn(EVENTS, e)))];
        earnedRef.current = valid;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore browser-only progress after hydration so server markup stays stable.
        setEarned(valid);
      }
    } catch { /* Storage is optional; the quest still works in this session. */ }
    return () => {
      if (burstTimer.current) clearTimeout(burstTimer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  const award = useCallback((event: QuestEvent) => {
    if (earnedRef.current.includes(event)) return;
    const next = [...earnedRef.current, event];
    earnedRef.current = next;
    setEarned(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    setNotice(event);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4200);
  }, []);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!effects || !studentMode) return;
    const button = (e.target as Element).closest("button, a");
    if (!button || button.closest("[data-no-fx]") || button.hasAttribute("disabled")) return;
    const rect = button.getBoundingClientRect();
    const x = e.detail === 0 ? rect.left + rect.width / 2 : e.clientX;
    const y = e.detail === 0 ? rect.top + rect.height / 2 : e.clientY;
    setBurst({ id: Date.now(), x: Math.max(75, Math.min(window.innerWidth - 75, x)), y: Math.max(65, Math.min(window.innerHeight - 65, y)) });
    if (burstTimer.current) clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBurst(null), 650);
  }

  const xp = earned.reduce((n, key) => n + EVENTS[key].xp, 0);
  const level = 1 + Math.floor(xp / 100);
  return <GameContext.Provider value={{ award }}>
    <div className="quest-game-root" onClickCapture={handleClick}>
      {children}
      {burst && <div key={burst.id} className="click-boom" style={{ left: burst.x, top: burst.y }} aria-hidden><span>BOOM!</span><i /><i /><i /></div>}
      <div className="quest-announcer" role="status" aria-live="polite" aria-atomic="true">
        {notice && <div className={`quest-notice ${effects ? "with-effects" : ""}`} key={notice} data-no-fx>
          <div className="notice-system"><span>◇ SYSTEM / QUEST UPDATE</span><button type="button" aria-label="Dismiss quest update" onClick={() => setNotice(null)}>×</button></div>
          <div className="notice-body"><span className="notice-xp">+{EVENTS[notice].xp}<small>XP</small></span><div><strong>{EVENTS[notice].title}</strong><p>{EVENTS[notice].detail}</p></div></div>
        </div>}
      </div>
      {studentMode && <aside className="game-hud" aria-label="Your local quest progress" data-no-fx>
        {expanded && <div className="hud-panel" id="quest-progress-panel">
          <p className="hud-system">PLAYER STATUS / THIS BROWSER</p><h2>{level > 1 ? "BUILDER AWAKENED" : "ROOKIE BUILDER"}</h2>
          <div className="hud-level"><strong>LV. {String(level).padStart(2, "0")}</strong><span>{xp} TOTAL XP</span></div>
          <div className="hud-progress" role="progressbar" aria-label="Progress to next level" aria-valuenow={xp % 100} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${xp % 100}%` }} /></div>
          <p className="hud-next">{100 - xp % 100} XP TO LEVEL {level + 1}</p>
          <ul className="hud-objectives">{(["choose_project", "build_plan", "register", "verified"] as QuestEvent[]).map((key, i) => <li key={key}><span>{earned.includes(key) ? "✓" : `0${i + 1}`}</span><b>{["Equip a project", "Generate your plan", "Register for the workshop", "Verify your seat"][i]}</b><small>+{EVENTS[key].xp}</small></li>)}</ul>
          <label className="hud-effect-switch"><input type="checkbox" checked={effects} onChange={e => { setEffects(e.target.checked); setBurst(null); }} /> Comic click effects</label>
          <p className="hud-disclaimer">XP is just for fun, saved in this browser. Each milestone counts once. Referral prizes use verified referrals, not XP.</p>
        </div>}
        <button type="button" className="hud-toggle" aria-expanded={expanded} aria-controls="quest-progress-panel" onClick={() => setExpanded(!expanded)}><span className="hud-avatar" aria-hidden>ϟ</span><span><strong>LV. {String(level).padStart(2, "0")}</strong><small>{xp} XP · {expanded ? "CLOSE" : "YOUR QUEST"}</small></span><span aria-hidden>{expanded ? "−" : "+"}</span></button>
      </aside>}
    </div>
  </GameContext.Provider>;
}
