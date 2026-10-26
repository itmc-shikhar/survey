import Link from "next/link";
import Beacon from "@/components/Beacon";
import { cleanTag } from "@/lib/questions";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  // Carry ref / vouch codes from shared links into the survey.
  const qs = new URLSearchParams();
  const ref = cleanTag(sp.ref);
  const vouch = cleanTag(sp.vouch);
  if (ref) qs.set("ref", ref);
  if (vouch) qs.set("vouch", vouch);
  const href = `/survey${qs.size ? `?${qs}` : ""}`;

  return (
    <main>
      <Beacon />
      <section className="hero">
        <div className="hero-inner">
          <div className="wordmark">Noticed</div>
          <h1>Everyone gets noticed.</h1>
          <p>We&apos;re building a dating app for India where likes mean something and every profile gets a fair look. Tell us how dating apps really work for you.</p>
          <Link className="btn btn-white" href={href}>Take the 3-minute survey</Link>
          <small>Anonymous · 18+ · Early access if you want it</small>
        </div>
      </section>

      <section className="points">
        <div className="points-inner">
          <div>
            <h2>Fewer likes. Real looks.</h2>
            <p>Everyone gets a limited number of likes a day, so each one is a real choice, not a swipe.</p>
          </div>
          <div>
            <h2>Every profile gets seen.</h2>
            <p>Attention doesn&apos;t all go to the same few profiles. A normal profile gets a fair shot.</p>
          </div>
          <div>
            <h2>Personality first.</h2>
            <p>Prompts and voice notes before photos, so people are noticed for who they are.</p>
          </div>
        </div>
      </section>

      <footer className="foot">
        <div className="foot-inner">Noticed is in early research. Your answers decide what we build first.</div>
      </footer>
    </main>
  );
}
