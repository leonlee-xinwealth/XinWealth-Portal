// Bakes the display faces the CFP report renders its headings and numerals in.
//
// Why this exists: @react-pdf/renderer 4.5.1 cannot use variable fonts.
// Registering a *-VF.ttf with a named instance crashes fontkit's subsetter
// ("First argument to DataView constructor must be an ArrayBuffer"); registering
// it without one silently embeds the font's DEFAULT axis position — which is
// Thin (wght 100) for NotoSansSC-VF and ExtraLight (200) for NotoSerifSC-VF.
// That is why every earlier sample rendered hairline. So we instance the axis
// here, at build time, and commit static faces.
//
// Size: a full static CJK instance is ~10MB. Body prose keeps using the already
// committed NotoSansSC-Regular.ttf (full coverage, handles arbitrary client
// names and LLM output). These display faces only ever render a CLOSED set of
// strings — the Chinese in LABELS/SECTION_META plus ASCII — so we subset to it
// and land under 200KB each.
//
// Requires the VF sources in public/fonts/ (git-ignored, ~43MB) and fonttools.
//   node scripts/build-cfp-fonts.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FONTS = path.join(ROOT, "public", "fonts");
const tmp = mkdtempSync(path.join(tmpdir(), "cfpfont-"));

// Every file that can contribute a Chinese glyph to a HEADING or a chart label.
// Body prose is not here on purpose — it renders in NotoSansSC-Regular.
const CHARSET_SOURCES = [
  "pdf/cfpReport/model.ts",
  "pdf/cfpReport/labels.ts",
  "components/advisor/cfp/sectionMeta.ts",
  "pdf/cfpReport/samples.tsx",
];

/**
 * Every character encodable in GB2312 (6,763 hanzi + kana + symbols). Chasing
 * the exact strings a page happens to use is a trap: a missing glyph in
 * react-pdf does not render a tofu box, it corrupts width measurement and the
 * heading overlaps itself. Cheap insurance — the whole set costs a few hundred
 * KB at these weights.
 */
function gb2312Charset() {
  const out = [];
  for (let hi = 0xa1; hi <= 0xf7; hi++) {
    for (let lo = 0xa1; lo <= 0xfe; lo++) {
      try {
        const ch = new TextDecoder("gb18030", { fatal: true })
          .decode(new Uint8Array([hi, lo]));
        if (ch && ch !== "�") out.push(ch);
      } catch { /* unassigned code point */ }
    }
  }
  return out;
}

function collectCharset() {
  const chars = new Set(gb2312Charset());
  // Full printable ASCII — numerals, RM amounts, English kickers, page numbers.
  for (let c = 0x20; c <= 0x7e; c++) chars.add(String.fromCharCode(c));
  // Typographic punctuation the report uses deliberately.
  for (const c of "·—–‘’“”「」《》…、。，；：？！（）％") chars.add(c);
  for (const rel of CHARSET_SOURCES) {
    const abs = path.join(ROOT, rel);
    if (!existsSync(abs)) continue;
    for (const c of readFileSync(abs, "utf8")) {
      if (c.codePointAt(0) > 0x2e7f) chars.add(c); // CJK & friends
    }
  }
  return [...chars].sort().join("");
}


function bake({ src, weight, out }) {
  const inst = path.join(tmp, `inst-${weight}.ttf`);
  execFileSync("python", ["-m", "fontTools.varLib.instancer",
    path.join(FONTS, src), `wght=${weight}`, "-o", inst], { stdio: "inherit" });
  const txt = path.join(tmp, "charset.txt");
  writeFileSync(txt, collectCharset(), "utf8");
  const outPath = path.join(FONTS, out);
  execFileSync("python", ["-m", "fontTools.subset", inst,
    `--text-file=${txt}`, "--layout-features=*", "--drop-tables+=DSIG",
    `--output-file=${outPath}`], { stdio: "inherit" });
  const kb = (statSync(outPath).size / 1024).toFixed(0);
  console.log(`  ${out}  ${kb} KB`);
}


const TARGETS = [
  { src: "NotoSerifSC-VF.ttf", weight: 500, out: "XwSerifSC-Medium.ttf" },
  { src: "NotoSerifSC-VF.ttf", weight: 700, out: "XwSerifSC-Bold.ttf" },
  { src: "NotoSansSC-VF.ttf",  weight: 500, out: "XwSansSC-Medium.ttf" },
  { src: "NotoSansSC-VF.ttf",  weight: 700, out: "XwSansSC-Bold.ttf" },
];

for (const t of TARGETS) {
  if (!existsSync(path.join(FONTS, t.src))) {
    console.error(`missing ${t.src} — download the variable source into public/fonts/ first`);
    process.exit(1);
  }
  console.log(`baking ${t.out} from ${t.src} @ wght=${t.weight}`);
  bake(t);
}
console.log(`charset: ${collectCharset().length} codepoints`);
