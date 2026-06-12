export const MIN_FONT_SIZE = 6;

/** 从 startSize 起以 0.5 步长缩小直到 maxWidth 放得下；放不下返回 null */
export function fitTextSize(
  widthAt: (size: number) => number,
  startSize: number,
  maxWidth: number
): number | null {
  for (let s = startSize; s >= MIN_FONT_SIZE; s -= 0.5) {
    if (widthAt(s) <= maxWidth) return s;
  }
  return null;
}

/** 拆成单字符数组（一格一字）；strip 用于清洗连字符/空格 */
export function combChars(value: string, strip?: RegExp): string[] {
  const cleaned = strip ? value.replace(strip, '') : value;
  return [...cleaned];
}

/** 'YYYY-MM-DD' → 'DDMMYYYY'；非法返回 null */
export function splitDateDDMMYYYY(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  return `${m[3]}${m[2]}${m[1]}`;
}
