"use client";

import { useEffect, useRef, useState } from "react";
import { type Answers, type Contact, type Question, UNDER_18, branchOf, enoughWords, visibleQuestions, wordStats } from "@/lib/questions";
import { track } from "@/lib/track";

type Phase = "checking" | "asking" | "under18" | "sending" | "done" | "already";
type Done = { id: string; woman: boolean; gaveContact: boolean };

// ponytail: per-device flag only (private mode / another browser gets around it); the server merges repeats by phone/email.
const DONE_KEY = "noticed_survey_done_v1";

export default function Survey() {
  const [answers, setAnswers] = useState<Answers>({});
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const startedAt = useRef(0);
  const sid = useRef(""); // anonymous per-visit id for funnel events
  const honeypot = useRef<HTMLInputElement>(null);

  useEffect(() => {
    sid.current = crypto.randomUUID();
    let prior: Done | null = null;
    try {
      prior = JSON.parse(localStorage.getItem(DONE_KEY) || "null");
    } catch { /* storage blocked: let them take it */ }
    if (prior?.id) {
      setDone(prior);
      setPhase("already");
      track(sid.current, "already");
      return;
    }
    setPhase("asking");
    track(sid.current, "start");
    startedAt.current = Date.now();
    // Each question is a history entry, so browser/phone back steps through questions.
    history.replaceState({ step: 0 }, "");
    const onPop = (e: PopStateEvent) => {
      const step = e.state?.step;
      if (typeof step !== "number") return;
      setPhase((p) => (p === "done" || p === "sending" ? p : "asking"));
      setI((cur) => Math.min(step, cur)); // only backwards: never skip ahead past unanswered questions
      window.scrollTo(0, 0);
    };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);

  function go(step: number) {
    setI(step);
    history.pushState({ step }, "");
    window.scrollTo(0, 0);
  }

  const list = visibleQuestions(answers);
  const q = list[Math.min(i, list.length - 1)];
  const value = answers[q.id];
  const set = (v: unknown) => setAnswers((a) => ({ ...a, [q.id]: v }));

  useEffect(() => {
    if (phase === "asking") track(sid.current, "view", q.id);
  }, [q.id, phase]);

  function next(a: Answers = answers) {
    setError("");
    const v = a[q.id];
    if (q.kind !== "info") {
      const answered = !(v === undefined || v === "" || (Array.isArray(v) && v.length === 0));
      // Only fixed option values leave the page; typed text and contact details never do.
      track(sid.current, answered ? "answer" : "skip", q.id, q.kind === "single" || q.kind === "multi" ? v : undefined);
    }
    if (q.id === "A1" && a.A1 === UNDER_18) {
      track(sid.current, "under18", "A1");
      history.pushState({ step: 0 }, "");
      return setPhase("under18");
    }
    const nextList = visibleQuestions(a);
    const pos = nextList.findIndex((x) => x.id === q.id);
    if (pos + 1 < nextList.length) go(pos + 1);
    else submit(a);
  }

  async function submit(a: Answers) {
    setPhase("sending");
    const params = new URLSearchParams(window.location.search);
    try {
      const res = await fetch("/api/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: a,
          ref: params.get("ref") || undefined,
          vouch: params.get("vouch") || undefined,
          startedAt: startedAt.current,
          website: honeypot.current?.value || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      const d: Done = { id: data.id, woman: branchOf(a) === "woman", gaveContact: hasContact(a.G1) };
      try { localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch { /* storage blocked */ }
      track(sid.current, "submit");
      setDone(d);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("asking");
    }
  }

  if (phase === "under18") {
    return (
      <Shell onBack={() => history.back()}>
        <div className="step">
          <h1>Thanks for stopping by</h1>
          <p className="help">This survey is for adults 18 and over. Nothing you entered was saved.</p>
        </div>
      </Shell>
    );
  }
  if (phase === "checking") return <Shell>{null}</Shell>;
  if ((phase === "done" || phase === "already") && done) return <ThankYou {...done} already={phase === "already"} />;

  const empty = value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  const longEnough = !(q.kind === "text" && q.minWords) || enoughWords((value as string) || "", q.minWords);
  const canContinue =
    q.kind === "info" || (q.kind === "contact" ? contactValid(value as Contact | undefined) : !(q.required && empty) && longEnough);
  const progress = Math.round((i / list.length) * 100);
  // First question: back returns to the landing page (keeping ref/vouch codes).
  const back = phase !== "asking" ? undefined : i > 0 ? () => history.back() : () => location.assign("/" + location.search);

  return (
    <Shell progress={progress} step={`${i + 1} of ${list.length}`} onBack={back}>
      <input ref={honeypot} className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" />
      <div className="step" key={q.id}>
        <h1 id={`${q.id}-title`}>{q.text}</h1>
        {q.help && <p className="help">{q.help}</p>}
        <Field q={q} value={value} set={set} onPick={(v) => next({ ...answers, [q.id]: v })} />
        {error && <p className="error" role="alert">Couldn&apos;t send: {error}. Please try again.</p>}
      </div>
      {q.kind !== "single" && (
        <div className="actions">
          {!q.required && empty && q.kind !== "info" && q.kind !== "consent" && (
            <button className="btn btn-text" onClick={() => next()}>Skip</button>
          )}
          <button className="btn btn-primary" disabled={!canContinue || phase === "sending"} onClick={() => next()}>
            {phase === "sending" ? "Sending…" : i === list.length - 1 ? "Submit" : "Continue"}
          </button>
        </div>
      )}
      {q.kind === "single" && !q.required && (
        <div className="actions">
          <button className="btn btn-text" disabled={phase === "sending"} onClick={() => next()}>
            {phase === "sending" ? "Sending…" : value ? "Continue" : "Skip"}
          </button>
        </div>
      )}
    </Shell>
  );
}

function Field({ q, value, set, onPick }: { q: Question; value: unknown; set: (v: unknown) => void; onPick: (v: string) => void }) {
  const labelledBy = `${q.id}-title`;
  switch (q.kind) {
    case "single":
      return (
        <div className="options" role="group" aria-labelledby={labelledBy}>
          {q.options.map((o) => (
            <button key={o} className="opt" aria-pressed={value === o} onClick={() => { set(o); onPick(o); }}>
              {o}
            </button>
          ))}
        </div>
      );
    case "multi": {
      const picked = (value as string[]) || [];
      return (
        <div className="options" role="group" aria-labelledby={labelledBy}>
          {q.options.map((o) => {
            const on = picked.includes(o);
            return (
              <button
                key={o}
                className="opt"
                aria-pressed={on}
                disabled={!on && picked.length >= q.max}
                onClick={() => set(on ? picked.filter((x) => x !== o) : [...picked, o])}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    case "text":
      if (q.long) {
        const text = (value as string) || "";
        const { words, unique } = wordStats(text);
        const min = q.minWords;
        const filler = !!min && words >= min && unique < Math.ceil(min / 2);
        return (
          <>
            <textarea className="field" aria-labelledby={labelledBy} aria-describedby={`${q.id}-count`} placeholder={q.placeholder}
              maxLength={2000} value={text} onChange={(e) => set(e.target.value)} />
            {min && (
              <p id={`${q.id}-count`} className={`wordcount${words >= min && !filler ? " ok" : ""}`} aria-live="polite">
                {filler ? "Try writing it in your own words, with fewer repeats." : `${words} / ${min} words`}
              </p>
            )}
          </>
        );
      }
      return (
        <>
          <input className="field" aria-labelledby={labelledBy} placeholder={q.placeholder} maxLength={120}
            list={q.suggestions ? `${q.id}-list` : undefined} value={(value as string) || ""} onChange={(e) => set(e.target.value)} />
          {q.suggestions && (
            <datalist id={`${q.id}-list`}>{q.suggestions.map((s) => <option key={s} value={s} />)}</datalist>
          )}
        </>
      );
    case "consent":
      return (
        <label className="check">
          <input type="checkbox" checked={value === true} onChange={(e) => set(e.target.checked || undefined)} />
          <span>{q.label}</span>
        </label>
      );
    case "contact": {
      const c = (value as Contact) || {};
      const upd = (p: Partial<Contact>) => set({ ...c, ...p });
      const given = !!(c.phone || c.email);
      return (
        <>
          <label className="label" htmlFor="phone">WhatsApp number</label>
          <input id="phone" className="field" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210"
            value={c.phone || ""} onChange={(e) => upd({ phone: e.target.value })} />
          <label className="label" htmlFor="email">or email</label>
          <input id="email" className="field" type="email" autoComplete="email" placeholder="you@example.com"
            value={c.email || ""} onChange={(e) => upd({ email: e.target.value })} />
          {given && (
            <>
              <span className="label" id="platform-label">Which phone do you use?</span>
              <div className="options" role="group" aria-labelledby="platform-label" style={{ gridTemplateColumns: "1fr 1fr" }}>
                {["Android", "iPhone"].map((p) => (
                  <button key={p} className="opt" aria-pressed={c.platform === p} onClick={() => upd({ platform: p })}>{p}</button>
                ))}
              </div>
              <label className="check">
                <input type="checkbox" checked={c.consent === true} onChange={(e) => upd({ consent: e.target.checked })} />
                <span>OK to contact me about early access. I can opt out anytime.</span>
              </label>
            </>
          )}
        </>
      );
    }
    default:
      return null;
  }
}

function hasContact(v: unknown) {
  const c = v as Contact | undefined;
  return !!(c && (c.phone || c.email));
}

// Empty is fine (skip); if anything is typed, it must look valid and have consent.
function contactValid(c: Contact | undefined) {
  if (!hasContact(c)) return true;
  const phoneOk = !c!.phone || /^\+?[0-9][0-9 ()-]{6,19}$/.test(c!.phone.trim());
  const emailOk = !c!.email || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c!.email.trim());
  return phoneOk && emailOk && c!.consent === true;
}

function Shell({ children, progress, step, onBack }: { children: React.ReactNode; progress?: number; step?: string; onBack?: () => void }) {
  return (
    <main className="survey">
      <div className="bar">
        {onBack && <button className="back" onClick={onBack} aria-label="Back">←</button>}
        {step && <span className="count">{step}</span>}
        <a className="wordmark" href="/">Noticed</a>
      </div>
      {progress !== undefined && (
        <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
      {children}
    </main>
  );
}

function ThankYou({ id, woman, gaveContact, already }: Done & { already: boolean }) {
  const [copied, setCopied] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${origin}/?ref=${id}`;
  const vouchUrl = `${origin}/?vouch=${id}`;

  async function share(url: string, label: string, text: string) {
    if (navigator.share) {
      try { await navigator.share({ title: "Noticed", text, url }); return; } catch { /* cancelled */ }
    }
    await navigator.clipboard.writeText(url);
    setCopied(label);
  }

  return (
    <Shell>
      <div className="step">
        <h1>{already ? "You've already taken the survey." : "Thanks. You've been noticed."}</h1>
        <p className="help">
          {already ? "One response per person keeps the results honest. Thanks for yours." : "Your answers shape what we build first."}
          {gaveContact ? " We'll message you when early access opens near you." : ""}
        </p>
        <div className="share">
          <button className="btn btn-primary" onClick={() => share(shareUrl, "share", "Quick 3-min survey on dating apps in India. Your answers shape a new app:")}>
            {copied === "share" ? "Link copied" : "Send this to a friend"}
          </button>
          {woman && gaveContact && (
            <button className="btn btn-quiet" onClick={() => share(vouchUrl, "vouch", "I'm vouching for you on Noticed, a new dating app. Take the 3-min survey to get on the list:")}>
              {copied === "vouch" ? "Invite link copied" : "Invite a guy friend you'd vouch for"}
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}
