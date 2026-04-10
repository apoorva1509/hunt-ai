import type { MessageScore, MessageVerdict } from "./types.js";

const BANNED_PHRASES = [
  "i came across your profile",
  "i noticed",
  "i was impressed",
  "i'd love to",
  "hope this finds you well",
  "quick question",
  "i'm passionate about",
  "i believe i could",
  "just wanted to",
  "would love to",
  "i wanted to reach out",
  "sorry to bother you",
  "i love what",
  "i think i'd be a good fit",
  "take a look at my",
  "please find attached",
  "per my last",
  "as per our conversation",
  "don't hesitate to",
  "please do not hesitate",
];

const CREDENTIAL_DUMP_PATTERNS = [
  /i have \d+ years/i,
  /my background includes/i,
  /i bring \d+ years/i,
  /with over \d+ years/i,
  /my experience spans/i,
];

/**
 * Score a message set (0-100) using Lavender-inspired heuristics.
 */
export function scoreMessage(
  body: string,
  channel: "linkedin" | "email" | "whatsapp",
  subject?: string
): MessageScore {
  const words = body.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = body.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLength = wordCount / Math.max(sentences.length, 1);
  const paragraphs = body.split(/\n\n+/).filter((p) => p.trim().length > 0);

  // ── Hard-fail checks ────────────────────────────────────

  if (!body.trim()) {
    return hardFail("Empty message");
  }
  if (wordCount > 200) {
    return hardFail(`Over 200 words (${wordCount})`);
  }
  if (/\{\{[A-Z_]+\}\}/.test(body)) {
    return hardFail("Unresolved merge fields");
  }

  const credentialDumps = CREDENTIAL_DUMP_PATTERNS.filter((p) =>
    p.test(body)
  ).length;
  if (credentialDumps >= 2) {
    return hardFail("Credential dump detected");
  }

  const iCount = (body.match(/\bI\b/g) ?? []).length;
  const youCount = (body.match(/\byou\b/gi) ?? []).length;
  if (iCount >= 4 && youCount / Math.max(iCount, 1) < 0.33) {
    return hardFail("Severely skewed I:You ratio");
  }

  // ── Scoring ─────────────────────────────────────────────

  let brevity = 0;
  let readability = 0;
  let tone = 0;
  let ctaQuality = 0;
  let antiPatterns = 0;
  let subjectLine = 0;
  let channelFit = 0;

  // Brevity & Structure (20 pts)
  const idealRange = channel === "linkedin" ? [30, 120] : channel === "whatsapp" ? [20, 100] : [75, 120];
  if (wordCount >= idealRange[0] && wordCount <= idealRange[1]) brevity += 12;
  else if (wordCount < idealRange[0] * 0.7 || wordCount > idealRange[1] * 1.3) brevity += 4;
  else brevity += 8;
  if (paragraphs.length <= 3) brevity += 4;
  else brevity += 2;
  // Mobile-friendly (lines < 120 chars)
  const longLines = body.split("\n").filter((l) => l.length > 120).length;
  if (longLines === 0) brevity += 4;
  else if (longLines <= 2) brevity += 2;

  // Readability (15 pts)
  if (avgSentenceLength <= 15) readability += 10;
  else if (avgSentenceLength <= 20) readability += 6;
  else readability += 3;
  // Simple words check (approximate Flesch-Kincaid)
  const longWords = words.filter((w) => w.length > 10).length;
  if (longWords / wordCount < 0.1) readability += 5;
  else if (longWords / wordCount < 0.2) readability += 3;

  // Tone & Framing (15 pts)
  const youIRatio = youCount / Math.max(iCount, 1);
  if (youIRatio >= 2) tone += 8;
  else if (youIRatio >= 1) tone += 5;
  else tone += 2;
  // Doesn't open with "I"
  if (!/^\s*I\b/.test(body)) tone += 4;
  // Uses contractions (casual tone)
  if (/\b(I'm|you're|we're|don't|can't|it's|that's)\b/i.test(body)) tone += 3;

  // CTA Quality (15 pts)
  const questions = (body.match(/\?/g) ?? []).length;
  if (questions === 1) ctaQuality += 10;
  else if (questions === 2) ctaQuality += 6;
  else if (questions === 0) ctaQuality += 3;
  // Interest-based CTA (not commitment-based)
  if (/worth|open to|curious|interested|make sense/i.test(body)) ctaQuality += 5;
  else ctaQuality += 2;

  // Anti-Pattern Check (15 pts)
  let bannedCount = 0;
  const lower = body.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) bannedCount++;
  }
  if (bannedCount === 0) antiPatterns += 10;
  else if (bannedCount === 1) antiPatterns += 5;
  // No exclamation overuse
  const exclamations = (body.match(/!/g) ?? []).length;
  if (exclamations <= 1) antiPatterns += 3;
  // No ALL CAPS words
  const capsWords = words.filter((w) => w.length > 2 && w === w.toUpperCase()).length;
  if (capsWords === 0) antiPatterns += 2;

  // Subject Line (10 pts, email only)
  if (channel === "email" && subject) {
    const subjectWords = subject.split(/\s+/).length;
    if (subjectWords <= 4) subjectLine += 5;
    else if (subjectWords <= 7) subjectLine += 3;
    if (subject === subject.toLowerCase() || subject[0] === subject[0].toLowerCase()) subjectLine += 3;
    if (!/free|urgent|act now|limited time/i.test(subject)) subjectLine += 2;
  } else if (channel !== "email") {
    subjectLine = 10; // N/A for non-email, give full marks
  }

  // Channel Fit (10 pts)
  if (channel === "linkedin") {
    const charCount = body.length;
    if (charCount <= 300) channelFit += 7;
    else if (charCount <= 500) channelFit += 4;
    if (!body.includes("http")) channelFit += 3; // No links in connection requests
  } else if (channel === "email") {
    if (body.includes("P.S.") || body.includes("PS:")) channelFit += 3;
    if (paragraphs.length >= 2) channelFit += 4;
    channelFit += 3;
  } else if (channel === "whatsapp") {
    if (wordCount <= 100) channelFit += 7;
    if (/\b(hey|hi)\b/i.test(body)) channelFit += 3; // Casual opener
  }

  const total =
    brevity + readability + tone + ctaQuality + antiPatterns + subjectLine + channelFit;

  const verdict = getVerdict(total);

  return {
    brevity,
    readability,
    tone,
    ctaQuality,
    antiPatterns,
    subjectLine,
    channelFit,
    total,
    hardFail: false,
    verdict,
    sendReady: total >= 60,
  };
}

function hardFail(reason: string): MessageScore {
  return {
    brevity: 0,
    readability: 0,
    tone: 0,
    ctaQuality: 0,
    antiPatterns: 0,
    subjectLine: 0,
    channelFit: 0,
    total: 0,
    hardFail: true,
    hardFailReason: reason,
    verdict: "fail",
    sendReady: false,
  };
}

function getVerdict(total: number): MessageVerdict {
  if (total >= 86) return "excellent";
  if (total >= 71) return "good";
  if (total >= 51) return "acceptable";
  if (total >= 31) return "weak";
  return "fail";
}
