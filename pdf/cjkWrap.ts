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
//
// THE STRAY HYPHEN — what it is, and what does not fix it
// -------------------------------------------------------
// Extracting the text back out of a rendered PDF shows the character textkit
// appends at a CJK break is U+002D HYPHEN-MINUS. It is added by the hyphenation
// pass itself: any split this callback returns is, by definition, a
// hyphenation, so textkit marks it. Investigated 2026-08-18. Ruled out:
//
//   - U+200B ZERO WIDTH SPACE between CJK characters, with or without a real
//     zero-width glyph added to the font. textkit does not treat U+200B as a
//     break opportunity at all — text that wrapped in that experiment was
//     breaking at nearby ASCII spaces, and all-CJK strings still overflowed.
//   - An identity hyphenation callback. Removes the hyphen but restores the
//     original 文字跑位 bug: CJK prose with no ASCII spaces is one unbreakable
//     word and runs straight off the page. Strictly worse.
//   - Removing U+00AD SOFT HYPHEN from the font. textkit uses U+00AD
//     internally, but a subsetted face with no U+00AD glyph still shows the
//     mark, because the mark is U+002D.
//   - Blanking U+002D in the font. It would work, and it is not acceptable:
//     the back cover prints a phone number.
//
// A real fix needs an upstream change or our own measured line-breaking pass.
// Until then the hyphen is a known, accepted cosmetic defect on CJK prose; it
// is most visible in narrow columns, where breaks are frequent.

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

