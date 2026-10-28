// Preserve real short answers such as yes, no, hello and thank you.
export function isHallucination(text) {
  if (/^\s*(?:\[[^\]]*\]|\([^)]*\)|\*[^*]*\*|♪.*♪)\s*$/.test(text)) return true;
  const lower = text.toLowerCase().replace(/[.!?,\s]+/g, ' ').trim();
  if (!lower || ['thanks for watching', 'subscribe', 'the end'].includes(lower)) return true;
  const words = lower.split(' ');
  return words.length >= 6 && words.every(word => word === words[0]);
}
