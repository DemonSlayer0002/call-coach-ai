// Independent, conservative guards for speech-recognition loops and contact details.
// These are heuristics, not a complete personal-data scrubber or ASR quality measure.
export function isSpeechLoop(text) {
  const words = text.toLowerCase().match(/\p{L}+/gu) || [];
  if (words.length < 18) return false;
  const counts = new Map();
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  if (counts.size / words.length < 0.15 || Math.max(...counts.values()) / words.length > 0.5) return true;
  if (words.length < 24) return false;
  const phrases = new Map();
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = words.slice(i, i + 3).join(" ");
    phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
  }
  return Math.max(...phrases.values()) / (words.length - 2) > 0.25;
}

export function redactContactDetails(text) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[identifier]")
    .replace(/(?:\+?1[ .-]?)?(?:\(\d{3}\)|\b\d{3})[ .-]\d{3}[ .-]\d{4}\b/g, "[phone]")
    .replace(/\b\d{7,}\b/g, "[identifier]");
}
