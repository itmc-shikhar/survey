import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { loadInsights, type Row, type Tally } from "@/lib/insights";
import { QUESTIONS } from "@/lib/questions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Insights — Noticed", robots: { index: false, follow: false } };

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");
const when = (d?: Date) => (d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "");
const label = new Map(QUESTIONS.map((q) => [q.id, q.text]));

export default async function Insights() {
  // Real authorization check at the data source (proxy.ts only shows the login prompt).
  if (!isAdmin((await headers()).get("authorization"))) notFound();
  const { overview: o, funnel, options, channels, places, recent } = await loadInsights();

  return (
    <main className="admin">
      <header className="admin-head">
        <div>
          <div className="wordmark">Noticed</div>
          <h1>Survey insights</h1>
          <p className="muted">Live from MongoDB · refreshed on every load · times in IST{o.capped ? " · showing latest 5,000 responses" : ""}</p>
        </div>
        <a className="btn btn-primary" href="/insights-d99d5rfhj7/export">Download CSV</a>
      </header>

      <section>
        <h2>Overview</h2>
        <div className="stats">
          <Stat n={o.landing} label="Landing visits" />
          <Stat n={o.started} label="Started survey" sub={pct(o.started, o.landing) + " of visits"} />
          <Stat n={o.responses} label="Completed" sub={pct(o.responses, o.started) + " of starts"} />
          <Stat n={o.women} label="Women" sub={`${o.men} men · ${o.responses - o.women - o.men} other`} />
          <Stat n={o.contacts} label="Left a contact" sub={pct(o.contacts, o.responses) + " demand rate"} />
          <Stat n={o.womenContacts} label="Women left a contact" sub="launch-spot signal" />
          <Stat n={o.sessionYes} label="Said yes to hands-on session" />
          <Stat n={o.vouched} label="Joined via a woman's invite" sub="M1 signal" />
        </div>
        <p className="muted">{o.already} repeat visits were stopped by the &ldquo;already taken&rdquo; screen.</p>
      </section>

      <section>
        <h2>Where people drop off</h2>
        <p className="muted">Viewed = unique visits that saw the question. Dropped here = left the survey on this question without submitting.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Question</th><th>Viewed</th><th>Skipped</th><th>Dropped here</th><th>Drop rate</th></tr></thead>
            <tbody>
              {funnel.map((f) => (
                <tr key={f.id} className={f.viewed && f.droppedHere / f.viewed >= 0.15 ? "hot" : undefined}>
                  <td><b>{f.id}</b> {f.text}</td>
                  <td>{f.viewed}</td><td>{f.skipped}</td><td>{f.droppedHere}</td><td>{pct(f.droppedHere, f.viewed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>By channel</h2>
        <GroupTable rows={channels} first="Channel (ref code)" />
      </section>

      <section>
        <h2>By city and college</h2>
        <p className="muted">Sorted by women who left a contact: the launch-spot rule (top place with at least 15 wins).</p>
        <GroupTable rows={places} first="City · college / area" />
      </section>

      <section>
        <h2>Answers by option</h2>
        <p className="muted">From completed responses. Multi-select questions can add up to more than 100%.</p>
        <div className="option-grid">
          {options.map((q) => (
            <div key={q.id} className="option-card">
              <h3><b>{q.id}</b> {q.text}</h3>
              <p className="muted">{q.answered} answered</p>
              <table>
                <thead><tr><th>Option</th><th>All</th><th>Women</th><th>Men</th></tr></thead>
                <tbody>
                  {q.rows.map((r) => (
                    <tr key={r.option}>
                      <td>{r.option}</td>
                      <td>{r.total} <span className="muted">{pct(r.total, q.answered)}</span></td>
                      <td>{r.women}</td><td>{r.men}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Responses</h2>
        <p className="muted">Latest {recent.length}. Contact details are personal data: don&apos;t share screenshots of this page.</p>
        <div className="responses">
          {recent.map((r) => <Response key={r.respondentId} r={r} />)}
        </div>
      </section>
    </main>
  );
}

function Stat({ n, label, sub }: { n: number; label: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-n">{n}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="muted">{sub}</div>}
    </div>
  );
}

function GroupTable({ rows, first }: { rows: ({ name: string } & Tally)[]; first: string }) {
  if (!rows.length) return <p className="muted">No responses yet.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>{first}</th><th>Responses</th><th>Women</th><th>Men</th><th>Left contact</th><th>Women w/ contact</th><th>Session yes</th><th>Via invite</th></tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.name}>
              <td>{g.name}</td><td>{g.responses}</td><td>{g.women}</td><td>{g.men}</td>
              <td>{g.contacts} <span className="muted">{pct(g.contacts, g.responses)}</span></td>
              <td>{g.womenContacts}</td><td>{g.sessionYes}</td><td>{g.vouched}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Response({ r }: { r: Row }) {
  const skip = new Set(["A1", "A2", "A5", "A6", "C1", "G1", "consent"]);
  const fmt = (v: unknown) => (Array.isArray(v) ? v.join(", ") : String(v));
  return (
    <details className="response">
      <summary>
        <span className="pill">{r.branch}</span>
        <span>{String(r.answers.A1 || "")}</span>
        <span>{String(r.answers.A5 || "")}{r.answers.A6 ? ` · ${r.answers.A6}` : ""}</span>
        {r.contact && <span className="pill pill-brand">contact</span>}
        {(r.submissions || 1) > 1 && <span className="pill">submitted {r.submissions}×</span>}
        <span className="muted">{when(r.submittedAt)}</span>
      </summary>
      <div className="response-body">
        <p className="c1">{String(r.answers.C1 || "")}</p>
        <dl>
          {Object.entries(r.answers).filter(([k]) => !skip.has(k)).map(([k, v]) => (
            <div key={k}><dt>{k} · {label.get(k)}</dt><dd>{fmt(v)}</dd></div>
          ))}
          {r.contact && (
            <div><dt>Contact</dt><dd>{[r.contact.phone, r.contact.email, r.contact.platform].filter(Boolean).join(" · ")}</dd></div>
          )}
          <div>
            <dt>Source</dt>
            <dd>ref: {r.ref || "—"}{r.vouchBy ? ` · invited by ${r.vouchBy.slice(0, 8)}` : ""} · {r.device} · {r.durationSec ?? "?"}s · id {r.respondentId.slice(0, 8)}</dd>
          </div>
        </dl>
      </div>
    </details>
  );
}
