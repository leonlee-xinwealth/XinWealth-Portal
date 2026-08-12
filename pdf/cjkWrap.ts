// Shared CJK line-breaking callback for every @react-pdf/renderer document.
//
// react-pdf's text layout (@react-pdf/textkit) only recognises literal ASCII
// spaces as word boundaries. Real Chinese prose has none, so an entire long CJK
// paragraph is treated as ONE unbreakable "word". insuranceReport's
// registerFonts() sets a hyphenationCallback of `(word) => [word]` — right for
// Latin, but it also makes that giant CJK "word" impossible to break, so it
// overflows straight off the page instead of wrapping (the 文字跑位 bug).
//
// Registering splitForCjkWrap AFTER registerFonts() fixes it: CJK characters
// become individually breakable while Latin words and numbers (e.g.
// "RM500,000") stay intact so they never split mid-token. The cost is a small
// "-" glyph at some CJK line-wraps — a known textkit limitation (any
// hyphenation break point renders a hyphen) and a vast improvement over text
// spilling across page boundaries.
//
// ORDER MATTERS. Always:
//   registerFonts(...);                          // installs (w) => [w]
//   Font.registerHyphenationCallback(splitForCjkWrap);   // must come second

export function isCjkChar(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0x3000 && code <= 0x303f) || // CJK punctuation
    (code >= 0xff00 && code <= 0xffef) || // Fullwidth forms
    (code >= 0x3400 && code <= 0x4dbf) // CJK Extension A
  );
}

export function splitForCjkWrap(word: string): string[] {
  if (!word) return [word];
  let hasCjk = false;
  for (const ch of word) {
    if (isCjkChar(ch)) { hasCjk = true; break; }
  }
  if (!hasCjk) return [word];
  const parts: string[] = [];
  let latinBuf = "";
  for (const ch of word) {
    if (isCjkChar(ch)) {
      if (latinBuf) { parts.push(latinBuf); latinBuf = ""; }
      parts.push(ch);
    } else {
      latinBuf += ch;
    }
  }
  if (latinBuf) parts.push(latinBuf);
  return parts;
}
