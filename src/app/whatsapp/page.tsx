"use client";

import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/client";

type Msg = { direction: "in" | "out"; body: string };

const QUICK = ["Hi", "1", "2", "3", "4", "STATUS", "MENU"];

export default function WhatsAppSim() {
  const [phone, setPhone] = useState("9876500001");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!/^[6-9]\d{9}$/.test(phone)) return;
    fetch(`/api/whatsapp/simulator?phone=${phone}`)
      .then((r) => r.json())
      .then((d) => setMsgs(d.messages ?? []));
  }, [phone]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  async function send(body: string) {
    if (!body.trim()) return;
    setMsgs((m) => [...m, { direction: "in", body }]);
    setText("");
    setTyping(true);
    const r = await post<{ replies?: string[]; error?: string }>("/api/whatsapp/simulator", { phone, text: body });
    setTyping(false);
    setMsgs((m) => [...m, ...(r.replies ?? [r.error ?? "error"]).map((b) => ({ direction: "out" as const, body: b }))]);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[380px_1fr]">
      <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-[2.5rem] border-8 border-ink bg-[#efeae2] shadow-2xl">
        <div className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-sm font-bold">NW</div>
          <div>
            <div className="text-sm font-semibold">NxtWave Workshops</div>
            <div className="text-xs text-white/70">{typing ? "typing…" : "bot · online"}</div>
          </div>
        </div>
        <div ref={scroller} className="flex h-[480px] flex-col gap-2 overflow-y-auto p-3">
          {msgs.length === 0 && <div className="mx-auto mt-6 rounded-lg bg-[#fff3c4] px-3 py-2 text-center text-xs text-ink">Say &quot;Hi&quot; to start. Try &quot;JOIN &lt;code&gt;&quot; to arrive through a referral.</div>}
          {msgs.map((m, i) => (
            <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm shadow-sm ${m.direction === "in" ? "self-end bg-[#d9fdd3]" : "self-start bg-paper"}`}>
              {formatWa(m.body)}
            </div>
          ))}
          {typing && <div className="self-start rounded-lg bg-paper px-3 py-2 text-sm text-ink-soft/70">●●●</div>}
        </div>
        <div className="flex flex-wrap gap-1 bg-[#f0f2f5] px-2 pt-2">
          {QUICK.map((q) => (
            <button key={q} onClick={() => send(q)} className="rounded-full bg-paper px-2.5 py-1 text-xs shadow-sm hover:bg-sand">
              {q}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2 bg-[#f0f2f5] p-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <input className="flex-1 rounded-full bg-paper px-4 py-2 text-sm outline-none" placeholder="Type a message" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="grid h-10 w-10 place-items-center rounded-full bg-[#25d366] text-white">➤</button>
        </form>
      </div>

      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">WhatsApp registration bot</h1>
        <p className="text-ink-soft">
          Most final-year students live on WhatsApp, not email. This bot lets them get an AI project idea, register, check referrals and ask questions without
          leaving the chat. Because the message comes from their own number, <b>the phone is already verified, so no OTP step is needed</b>.
        </p>
        <div className="card">
          <label className="label">Simulated phone number</label>
          <input className="input font-mono" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
          <p className="mt-2 text-xs text-ink-soft">Change the number to start a fresh conversation as a different student.</p>
        </div>
        <div className="card text-sm">
          <h2 className="mb-2 font-bold">Same engine, two transports</h2>
          <ul className="list-disc space-y-1 pl-5 text-ink-soft">
            <li>
              <b>This simulator</b> calls <code className="font-mono text-xs">/api/whatsapp/simulator</code>.
            </li>
            <li>
              <b>Real WhatsApp</b>: set the Twilio sandbox webhook to <code className="font-mono text-xs">/api/whatsapp/twilio</code>. The same state machine replies with TwiML, and requests are checked with Twilio&apos;s signature.
            </li>
            <li>Free-text questions are matched against FAQs first, then answered by Claude, with strict rules not to invent dates or prices.</li>
            <li>Referral links pre-fill &quot;JOIN CODE&quot;, so referrals are credited even when someone registers in the chat.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function formatWa(s: string) {
  // WhatsApp-style *bold* and _italic_
  const parts = s.split(/(\*[^*]+\*|_[^_]+_)/g);
  return parts.map((p, i) =>
    p.startsWith("*") && p.endsWith("*") ? <b key={i}>{p.slice(1, -1)}</b> : p.startsWith("_") && p.endsWith("_") ? <i key={i}>{p.slice(1, -1)}</i> : p,
  );
}
