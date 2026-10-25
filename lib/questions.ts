// Single source of truth for the survey: the client renders from it, the API validates with it.
// IDs match SURVEY_QUESTIONS.md and become the stored field names.

export const FORM_VERSION = "v1";

export type Answers = Record<string, unknown>;
export type Branch = "woman" | "man" | "other";

type Base = { id: string; text: string; help?: string; required?: boolean; show?: (a: Answers) => boolean };
export type Question =
  | (Base & { kind: "single"; options: string[] })
  | (Base & { kind: "multi"; options: string[]; max: number })
  | (Base & { kind: "text"; long?: boolean; minWords?: number; placeholder?: string; suggestions?: string[] })
  | (Base & { kind: "consent"; label: string })
  | (Base & { kind: "info" })
  | (Base & { kind: "contact" });

export type Contact = { phone?: string; email?: string; platform?: string; consent?: boolean };

export const UNDER_18 = "Under 18";

// Minimum length for the open pain question (C1). Raise toward 100 if answers come back thin.
export const MIN_WORDS = 50;

// Words = runs of 2+ letters (any script). Unique count blocks "good good good…" filler.
export function wordStats(s: string): { words: number; unique: number } {
  const w = (s.toLowerCase().match(/\p{L}{2,}/gu) || []);
  return { words: w.length, unique: new Set(w).size };
}

export function enoughWords(s: string, min: number): boolean {
  const { words, unique } = wordStats(s);
  return words >= min && unique >= Math.ceil(min / 2);
}

export function branchOf(a: Answers): Branch {
  if (a.A2 === "Woman") return "woman";
  if (a.A2 === "Man") return "man";
  return "other";
}

const isWoman = (a: Answers) => branchOf(a) === "woman";
const isMan = (a: Answers) => branchOf(a) === "man";
const isOther = (a: Answers) => branchOf(a) === "other";
const either = (...fs: ((a: Answers) => boolean)[]) => (a: Answers) => fs.some((f) => f(a));
const gaveContact = (a: Answers) => {
  // Client holds the raw contact; after validation the server holds { given: true }.
  const c = a.G1 as (Contact & { given?: boolean }) | undefined;
  return !!(c && (c.phone || c.email || c.given));
};

export const QUESTIONS: Question[] = [
  // Setup (not counted in the top 10)
  { id: "A1", kind: "single", required: true, text: "How old are you?", options: [UNDER_18, "18–20", "21–24", "25–28", "29–32", "33+"] },
  {
    id: "consent", kind: "consent", required: true,
    text: "Before we start",
    help: "Answers are anonymous unless you leave your number at the end. You can skip most questions.",
    label: "I agree my answers can be used to design this app. I can ask for my data to be deleted anytime.",
  },
  { id: "A2", kind: "single", required: true, text: "How do you identify?", options: ["Woman", "Man", "Non-binary", "Another identity", "Prefer not to say"] },
  { id: "A4", kind: "single", required: true, text: "Where are you right now?", options: ["On a college campus (student)", "In a city (working / not a student)", "Both (working student)"] },
  {
    id: "A5", kind: "text", required: true, text: "Which city?", placeholder: "Start typing your city",
    suggestions: ["Delhi NCR", "Mumbai", "Bengaluru", "Pune", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad", "Jaipur", "Indore", "Lucknow", "Chandigarh", "Nagpur"],
  },
  { id: "A6", kind: "text", text: "Which college or area?", help: "College name if you're a student, neighbourhood if not.", placeholder: "e.g. Miranda House, or Koramangala" },

  // 1. Pain, unprompted (before the idea is shown)
  {
    id: "C1", kind: "text", long: true, required: true, minWords: MIN_WORDS,
    text: "Describe your last week on dating apps. What happened?",
    help: `Don't use dating apps? Tell us why, or how you meet people instead. At least ${MIN_WORDS} words, your honest experience helps most.`,
    placeholder: "Swiped a bit, got 3 matches, nobody replied…",
  },

  // 2. Pain
  {
    id: "B45", kind: "single",
    text: "In the last 6 months, have you deleted a dating app because you were frustrated?",
    help: "If yes, pick the main reason.",
    options: [
      "No", "I don't use dating apps",
      "Yes: too few matches", "Yes: fake profiles or scams", "Yes: paywalls / too expensive",
      "Yes: too many low-effort messages", "Yes: felt unsafe or harassed", "Yes: got banned or restricted",
      "Yes: bugs / too slow", "Yes: wasn't meeting anyone serious", "Yes: something else",
    ],
  },

  // 3–7. Branch questions
  { id: "D1", kind: "single", show: isWoman, text: "Roughly how many likes do you get in a week?", options: ["Under 10", "10–50", "50–200", "200+", "I don't check", "Not sure"] },
  {
    id: "D2", kind: "single", show: either(isWoman, isOther),
    text: "When you go through likes or profiles, how many do you actually read (bio, prompts) versus judge on the first photo?",
    options: ["I read most", "I read about half", "I read a few", "I mostly go by the first photo"],
  },
  { id: "D5", kind: "single", show: either(isWoman, isOther), text: "How often do you get messages that make you uncomfortable?", options: ["Never", "Rarely", "Sometimes", "Often", "Prefer not to say"] },
  {
    id: "D8", kind: "single", show: either(isWoman, isOther), text: "If you had to choose, which would you prefer?",
    options: ["Fewer likes, but each one from someone who really chose me", "Lots of likes, I'll filter them myself", "Not sure"],
  },
  {
    id: "D9", kind: "single", show: isWoman,
    text: "Would you invite a guy friend you trust to a dating app, if only invited men could join?",
    options: ["Yes, I'd invite a few", "Maybe, depends who", "No, I wouldn't want my name attached", "Not sure"],
  },
  { id: "E1", kind: "single", show: isMan, text: "Roughly how many matches do you get in a week?", options: ["0", "1–2", "3–5", "6–10", "10+", "Not sure"] },
  { id: "E3", kind: "single", show: either(isMan, isOther), text: "Out of your matches, how many actually reply?", options: ["Almost none", "A few", "About half", "Most", "I don't get matches"] },
  {
    id: "E4", kind: "multi", max: 3, show: isMan, text: "What do you think gets other guys the most matches?", help: "Pick up to 3.",
    options: ["Looks", "Cars / bikes", "Travel photos", "Gym / fitness", "Money / luxury", "Funny bio or prompts", "Height", "Verified badge", "Paying for premium", "Pure luck"],
  },
  {
    id: "E8", kind: "single", show: either(isMan, isOther),
    text: "Would you accept a limit of about 8 likes a day if it meant every like you send is actually seen?",
    options: ["Yes", "Maybe", "No, I want unlimited", "Not sure"],
  },
  {
    id: "E9", kind: "single", show: isMan, text: "Would you join an app where men can only get in if a woman already on the app invites them?",
    options: ["Yes, makes sense", "Maybe", "No, too hard to get in", "Not sure"],
  },

  // The idea, shown for the first time
  {
    id: "concept", kind: "info", text: "Here's what we're building",
    help:
      "A dating app where every profile gets a fair chance to be seen. Everyone gets a limited number of likes a day, so likes mean something. " +
      "Women get fewer but more serious likes instead of hundreds. Profiles lead with personality before photos. Fake profiles get removed fast.",
  },

  // 8. Gap + demand
  {
    id: "F1", kind: "single", required: true, text: "What would make you try a new dating app?",
    options: [
      "Fewer but more serious likes", "Every profile gets a fair chance to be seen", "Only verified, real profiles",
      "Free premium features", "Nothing, I'm fine with my current apps",
    ],
  },

  // 9–10. Demand (commitment)
  { id: "G1", kind: "contact", text: "Want early access when we launch near you?", help: "Optional. Leave a WhatsApp number or email, or skip." },
  {
    id: "G3", kind: "single", show: gaveContact,
    text: "Can we invite you to a 20-minute session to try the app before anyone else?",
    options: ["Yes", "Maybe later", "No"],
  },
];

export function visibleQuestions(a: Answers): Question[] {
  return QUESTIONS.filter((q) => !q.show || q.show(a));
}

// ---------- Server-side validation (trust boundary) ----------

const TEXT_MAX = 2000;
const SHORT_MAX = 120;
const PHONE_RE = /^\+?[0-9][0-9 ()-]{6,19}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const TAG_RE = /^[A-Za-z0-9_-]{1,40}$/;

export type Clean = { answers: Answers; contact: Contact | null; branch: Branch };

export function validate(raw: unknown): { ok: true; value: Clean } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "bad body" };
  const input = raw as Answers;
  const answers: Answers = {};
  let contact: Contact | null = null;

  // Walk questions in order so `show` sees only already-validated answers.
  for (const q of QUESTIONS) {
    if (q.show && !q.show(answers)) continue;
    const v = input[q.id];
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    if (q.kind === "info") continue;
    if (empty) {
      if (q.required) return { ok: false, error: `missing ${q.id}` };
      continue;
    }
    switch (q.kind) {
      case "single":
        if (typeof v !== "string" || !q.options.includes(v)) return { ok: false, error: `bad ${q.id}` };
        answers[q.id] = v;
        break;
      case "multi":
        if (!Array.isArray(v) || v.length > q.max || !v.every((x) => typeof x === "string" && q.options.includes(x)))
          return { ok: false, error: `bad ${q.id}` };
        answers[q.id] = [...new Set(v as string[])];
        break;
      case "text":
        if (typeof v !== "string") return { ok: false, error: `bad ${q.id}` };
        answers[q.id] = v.trim().slice(0, q.long ? TEXT_MAX : SHORT_MAX);
        if (q.minWords && !enoughWords(answers[q.id] as string, q.minWords)) return { ok: false, error: `${q.id} too short` };
        break;
      case "consent":
        if (v !== true) return { ok: false, error: `bad ${q.id}` };
        answers[q.id] = true;
        break;
      case "contact": {
        const c = v as Contact;
        if (typeof c !== "object") return { ok: false, error: "bad G1" };
        const phone = typeof c.phone === "string" ? c.phone.trim() : "";
        const email = typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
        if (!phone && !email) break;
        if (phone && !PHONE_RE.test(phone)) return { ok: false, error: "bad phone" };
        if (email && !EMAIL_RE.test(email)) return { ok: false, error: "bad email" };
        if (c.consent !== true) return { ok: false, error: "contact needs consent" };
        const platform = c.platform === "Android" || c.platform === "iPhone" ? c.platform : undefined;
        contact = { phone: phone || undefined, email: email || undefined, platform, consent: true };
        answers.G1 = { given: true, platform }; // contact details live in a separate collection
        break;
      }
    }
    if (q.id === "A1" && v === UNDER_18) return { ok: false, error: "under 18" };
  }
  return { ok: true, value: { answers, contact, branch: branchOf(answers) } };
}

// Keys used to recognise the same person across submissions (one response per phone/email).
// Phone: digits only, Indian 10-digit and 0-prefixed numbers normalised to 91XXXXXXXXXX.
export function contactKeys(c: Contact): { phoneKey?: string; emailKey?: string } {
  const keys: { phoneKey?: string; emailKey?: string } = {};
  if (c.phone) {
    let d = c.phone.replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
    if (d.length === 10) d = "91" + d;
    keys.phoneKey = d;
  }
  if (c.email) keys.emailKey = c.email.trim().toLowerCase();
  return keys;
}

export function cleanTag(v: unknown): string | undefined {
  return typeof v === "string" && TAG_RE.test(v) ? v : undefined;
}
