// Run: npm test
import assert from "node:assert/strict";
import { validate, visibleQuestions, cleanTag, contactKeys, enoughWords, wordStats, MIN_WORDS } from "./questions.ts";

const story = Array.from({ length: 50 }, (_, n) => `word${String.fromCharCode(97 + (n % 26))}${String.fromCharCode(97 + Math.floor(n / 26))}`).join(" ");
const base = { A1: "21–24", consent: true, A4: "On a college campus (student)", A5: "Pune", C1: story, F1: "Free premium features" };

// Open question needs MIN_WORDS real, varied words.
assert.equal(MIN_WORDS, 50);
assert.ok(enoughWords(story, 50));
assert.equal(enoughWords("good ".repeat(60), 50), false); // filler
assert.equal(enoughWords("too short", 50), false);
assert.equal(validate({ ...base, A2: "Woman", C1: "nothing much" }).ok, false);
assert.equal(validate({ ...base, A2: "Woman", C1: undefined }).ok, false); // required
assert.equal(wordStats("Mostly low-effort 'hi' msgs, 3 matches").words, 6); // "3" is not a word; "low", "effort" are

// Woman sees the woman branch, not the man branch.
const wIds = visibleQuestions({ ...base, A2: "Woman" }).map((q) => q.id);
assert.ok(wIds.includes("D9") && !wIds.includes("E1"));
const mIds = visibleQuestions({ ...base, A2: "Man" }).map((q) => q.id);
assert.ok(mIds.includes("E9") && !mIds.includes("D1"));

// Core counts: 10 per gender excluding setup + concept screen (G3 only after contact).
const setup = new Set(["A1", "consent", "A2", "A4", "A5", "A6", "concept"]);
const core = (a: object) => visibleQuestions({ ...a, G1: { phone: "9876543210", consent: true } }).filter((q) => !setup.has(q.id)).length;
assert.equal(core({ ...base, A2: "Woman" }), 10);
assert.equal(core({ ...base, A2: "Man" }), 10);
assert.equal(core({ ...base, A2: "Non-binary" }), 10);

// Valid man submission with contact keeps G3, strips contact details from answers.
const ok = validate({ ...base, A2: "Man", E4: ["Cars / bikes", "Looks"], G1: { phone: "+91 98765 43210", consent: true, platform: "iPhone" }, G3: "Yes" });
assert.ok(ok.ok);
if (ok.ok) {
  assert.equal(ok.value.branch, "man");
  assert.equal(ok.value.answers.G3, "Yes");
  assert.deepEqual(ok.value.answers.G1, { given: true, platform: "iPhone" });
  assert.equal(ok.value.contact?.phone, "+91 98765 43210");
}

// Answers for the other branch are dropped, not stored.
const cross = validate({ ...base, A2: "Woman", E1: "0" });
assert.ok(cross.ok && !("E1" in cross.value.answers));

// Rejections at the trust boundary.
assert.equal(validate({ ...base, A2: "Man", A1: "Under 18" }).ok, false);
assert.equal(validate({ ...base, A2: "Man", consent: false }).ok, false);
assert.equal(validate({ ...base, A2: "Man", B45: "made up" }).ok, false);
assert.equal(validate({ ...base, A2: "Man", E4: ["Looks", "Height", "Pure luck", "Money / luxury"] }).ok, false);
assert.equal(validate({ ...base, A2: "Man", G1: { phone: "12", consent: true } }).ok, false);
assert.equal(validate({ ...base, A2: "Man", G1: { email: "a@b.co" } }).ok, false); // no consent
assert.equal(validate({ ...base, A2: "Man", G3: "Yes" }).ok && true, true); // G3 ignored without contact
const g3 = validate({ ...base, A2: "Man", G3: "Yes" });
assert.ok(g3.ok && !("G3" in g3.value.answers));

// Long text is capped.
const long = validate({ ...base, A2: "Woman", C1: (story + " ").repeat(20) });
assert.ok(long.ok && (long.value.answers.C1 as string).length === 2000);

// Same person, different phone formatting -> same key.
const k = (phone: string) => contactKeys({ phone }).phoneKey;
assert.equal(k("+91 98765 43210"), "919876543210");
assert.equal(k("9876543210"), "919876543210");
assert.equal(k("09876543210"), "919876543210");
assert.equal(k("(987) 654-3210"), "919876543210");
assert.equal(contactKeys({ email: " A@B.co " }).emailKey, "a@b.co");
assert.deepEqual(contactKeys({}), {});

assert.equal(cleanTag("insta-du_1"), "insta-du_1");
assert.equal(cleanTag("<script>"), undefined);

console.log("questions: all checks passed");
