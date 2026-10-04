const CONTACT_PATTERNS = [
  /\b[A-Z0-9._%+-]+\s*(?:@|\bat\b)\s*[A-Z0-9-]+\s*(?:\.|\bdot\b)\s*[A-Z]{2,}\b/i,
  /(?:https?:\/\/|www\.)\S+/i,
  /\b[A-Z0-9-]+\s*\.\s*(?:se|com|nu|net|org)\b/i,
  /(?:^|\s)@[A-Z0-9_.-]{2,}\b/i,
  /\b(?:instagram|facebook|whatsapp|telegram|signal|snapchat|linkedin)\b/i,
  /(?:^|\D)(?:\+?46|0)[\s().-]*(?:\d[\s().-]*){7,10}(?:$|\D)/,
  /\b(?:ring|sms:a|mejla|maila|kontakta)\s+(?:mig|oss)\b/i,
] as const;

export function containsContactInformation(value: string): boolean {
  const normalized = value.normalize("NFKC");
  if (CONTACT_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  const digitRun = normalized.replace(/[^+\d]/g, "");
  return /^(?:\+?46|0)\d{7,10}$/.test(digitRun);
}
