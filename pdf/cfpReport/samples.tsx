// Aesthetic direction samples — cover + 整体健康 page in 3 premium directions,
// for the user to choose. Real Lim Wei Jian data. Headless render only.
import path from "path";
import {
  Document, Page, Text, View, Svg, Circle, Path, Rect, Line, Font, renderToFile,
} from "@react-pdf/renderer";

// react-pdf 4.5.1 cannot use variable fonts: registering a *-VF.ttf with a named
// instance crashes fontkit's subsetter, and registering it without one silently
// embeds the DEFAULT axis position — Thin (100) for NotoSansSC-VF, ExtraLight
// (200) for NotoSerifSC-VF. Every earlier render of these samples was hairline,
// and "SansSC" was actually thinner than "SansSClight". Use the static faces
// baked by scripts/build-cfp-fonts.mjs instead.
Font.register({ family: "SerifSC", src: path.resolve("public/fonts/XwSerifSC-Medium.ttf") });
Font.register({ family: "SansSC", src: path.resolve("public/fonts/XwSansSC-Medium.ttf") });
Font.register({ family: "SansSClight", src: path.resolve("public/fonts/NotoSansSC-Regular.ttf") });
Font.registerHyphenationCallback((w) => [w]);

// ---- real data ----
const D = {
  client: "Lim Wei Jian", advisor: "Leon Lee", period: "TEST-P2", date: "2026",
  score: 77,
  components: [
    { label: "紧急预备金", score: 100 }, { label: "储蓄率", score: 100 },
    { label: "偿债压力", score: 100 }, { label: "保障覆盖度", score: 8 },
    { label: "退休资金覆盖度", score: 100 },
  ],
  netWorth: 291500, assets: 1063000, liab: 771500,
  wf: { stage: 2, passive: 3800, expenses: 5800, gap: 2000 },
  budget: [
    { zh: "保障缺口", v: 14131 }, { zh: "紧急预备金", v: 0 }, { zh: "退休储蓄", v: 0 },
    { zh: "人生目标", v: 5424 }, { zh: "财富增值", v: 154445 },
  ],
  surplus: 174000,
};
const rm = (n: number) => "RM " + n.toLocaleString("en-US");

// ---- palettes ----
const NAVY = "#0F2A43", NAVY2 = "#1B3A57", GOLD = "#B0894F", GOLDL = "#C9A96A";
const INK = "#2A3441", MUTE = "#8A94A0", HAIR = "#E4E0D6";
const GOOD = "#2E7D57", WARN = "#B45309", BAD = "#B4443C";
const IVORY = "#FBF9F4", NEARWHITE = "#FCFCFB";

const scoreColor = (s: number) => (s >= 70 ? GOOD : s >= 40 ? WARN : BAD);

// ---- shared gauge ----
function Gauge({ score, size = 96, stroke = 7, serif = false, big = 30 }: any) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, cx = size / 2;
  const frac = Math.max(0, Math.min(1, score / 100));
  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cx} r={r} stroke="#E9E4D8" strokeWidth={stroke} fill="none" />
        <Path
          d={describeArc(cx, cx, r, 0, frac * 360)}
          stroke={scoreColor(score)} strokeWidth={stroke} fill="none" strokeLinecap="round"
        />
      </Svg>
      <View style={{ position: "absolute", top: 0, left: 0, width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: serif ? "SerifSC" : "SansSC", fontSize: big, color: NAVY }}>{score}</Text>
        <Text style={{ fontFamily: "SansSClight", fontSize: 8, color: MUTE, marginTop: -2 }}>/100</Text>
      </View>
    </View>
  );
}
function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function describeArc(cx: number, cy: number, r: number, a0: number, a1: number) {
  if (a1 - a0 >= 359.9) a1 = a0 + 359.9;
  const s = polar(cx, cy, r, a1), e = polar(cx, cy, r, a0);
  const large = a1 - a0 <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}
function Bar({ frac, color = NAVY, h = 6, track = "#EAE6DA", w = "100%" }: any) {
  const pct = Math.max(0, Math.min(1, frac));
  return (
    <View style={{ width: w, height: h, backgroundColor: track, borderRadius: h / 2 }}>
      <View style={{ width: `${pct * 100}%`, height: h, backgroundColor: color, borderRadius: h / 2 }} />
    </View>
  );
}

// ============================================================ DIRECTION A
// 私人银行经典 — ivory paper, serif headings & numbers, gold hairlines.
const A = () => (<>
  <Page size="A4" style={{ backgroundColor: IVORY, paddingVertical: 64, paddingHorizontal: 60 }}>
    {/* watermark period numeral */}
    <Text style={{ position: "absolute", top: 300, right: 30, fontFamily: "SerifSC", fontSize: 200, color: "#F1ECE0" }}>26</Text>
    <View style={{ width: 46, height: 2, backgroundColor: GOLD }} />
    <Text style={{ fontFamily: "SerifSC", fontSize: 30, color: NAVY, marginTop: 18, letterSpacing: 1 }}>XinWealth</Text>
    <Text style={{ fontFamily: "SansSClight", fontSize: 9, color: GOLD, letterSpacing: 3, marginTop: 26 }}>PRIVATE WEALTH REPORT</Text>
    <Text style={{ fontFamily: "SerifSC", fontSize: 40, color: NAVY, marginTop: 8 }}>财务规划报告</Text>
    <Text style={{ fontFamily: "SerifSC", fontSize: 16, color: GOLD, marginTop: 4 }}>{D.period}</Text>
    <View style={{ marginTop: 200 }}>
      <View style={{ height: 0.75, backgroundColor: HAIR, marginBottom: 16 }} />
      <Row label="呈交予" value={D.client} />
      <Row label="顾问" value={D.advisor} />
      <Row label="日期" value="21 / 07 / 2026" />
    </View>
    <Text style={{ position: "absolute", bottom: 44, left: 60, fontFamily: "SansSClight", fontSize: 7.5, color: MUTE, letterSpacing: 1 }}>
      私人及保密文件 · CONFIDENTIAL · 仅供指名客户参阅
    </Text>
  </Page>
  <Page size="A4" style={{ backgroundColor: IVORY, paddingVertical: 56, paddingHorizontal: 56 }}>
    <Text style={{ fontFamily: "SansSClight", fontSize: 8.5, color: GOLD, letterSpacing: 3 }}>OVERALL FINANCIAL HEALTH</Text>
    <Text style={{ fontFamily: "SerifSC", fontSize: 24, color: NAVY, marginTop: 2 }}>整体财务健康</Text>
    <View style={{ width: 40, height: 2, backgroundColor: GOLD, marginTop: 10 }} />

    <View style={{ flexDirection: "row", marginTop: 26, alignItems: "center" }}>
      <Gauge score={D.score} serif big={34} size={104} />
      <View style={{ marginLeft: 26, flex: 1 }}>
        {D.components.map((c, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 7 }}>
            <Text style={{ width: 92, fontFamily: "SansSC", fontSize: 8.5, color: INK }}>{c.label}</Text>
            <View style={{ flex: 1 }}><Bar frac={c.score / 100} color={scoreColor(c.score)} h={5} /></View>
            <Text style={{ width: 40, textAlign: "right", fontFamily: "SerifSC", fontSize: 9, color: NAVY }}>{c.score}</Text>
          </View>
        ))}
      </View>
    </View>

    <View style={{ height: 0.75, backgroundColor: HAIR, marginTop: 22, marginBottom: 18 }} />
    <Text style={{ fontFamily: "SansSClight", fontSize: 8.5, color: GOLD, letterSpacing: 2 }}>预算分配 · ANNUAL ALLOCATION</Text>
    <View style={{ marginTop: 12 }}>
      {D.budget.map((b, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 9 }}>
          <Text style={{ width: 78, fontFamily: "SansSC", fontSize: 8.5, color: INK }}>{b.zh}</Text>
          <View style={{ flex: 1 }}><Bar frac={b.v / D.surplus} color={i === 4 ? GOLD : NAVY} h={6} /></View>
          <Text style={{ width: 84, textAlign: "right", fontFamily: "SerifSC", fontSize: 10, color: NAVY }}>{rm(b.v)}</Text>
        </View>
      ))}
    </View>

    <View style={{ height: 0.75, backgroundColor: HAIR, marginTop: 20, marginBottom: 16 }} />
    <Text style={{ fontFamily: "SansSClight", fontSize: 8.5, color: GOLD, letterSpacing: 2 }}>财务自由进程</Text>
    <View style={{ flexDirection: "row", marginTop: 12 }}>
      {["起步", "积累", "财务独立", "财务自由"].map((s, i) => (
        <View key={i} style={{ flex: 1, marginRight: i < 3 ? 6 : 0 }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: i < D.wf.stage ? GOLD : "#EAE6DA" }} />
          <Text style={{ fontFamily: "SansSC", fontSize: 7.5, color: i === D.wf.stage - 1 ? NAVY : MUTE, marginTop: 5 }}>{s}</Text>
        </View>
      ))}
    </View>
    <Text style={{ fontFamily: "SansSClight", fontSize: 9, color: INK, marginTop: 14, lineHeight: 1.6 }}>
      被动收入 {rm(D.wf.passive)}/月 · 每月支出 {rm(D.wf.expenses)}/月 · 距下一阶段 {rm(D.wf.gap)}/月
    </Text>
    <Text style={{ position: "absolute", bottom: 34, left: 56, right: 56, fontFamily: "SansSClight", fontSize: 7, color: MUTE, letterSpacing: 1 }}>
      Lim Wei Jian · TEST-P2 · 私人及保密 · 2 / 22
    </Text>
  </Page>
</>);
function Row({ label, value }: any) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 9 }}>
      <Text style={{ width: 120, fontFamily: "SansSClight", fontSize: 8, color: GOLD, letterSpacing: 2 }}>{label.toUpperCase?.() ?? label}</Text>
      <Text style={{ fontFamily: "SerifSC", fontSize: 12, color: NAVY }}>{value}</Text>
    </View>
  );
}

// ============================================================ DIRECTION B
// 现代轻奢 — near-white, huge light sans numbers, whitespace, single gold dot.
const B = () => (<>
  <Page size="A4" style={{ backgroundColor: NEARWHITE, padding: 64 }}>
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: GOLD, marginRight: 8 }} />
      <Text style={{ fontFamily: "SansSC", fontSize: 13, color: NAVY, letterSpacing: 1 }}>XinWealth</Text>
    </View>
    <View style={{ marginTop: 180 }}>
      <Text style={{ fontFamily: "SansSClight", fontSize: 10, color: MUTE, letterSpacing: 4 }}>FINANCIAL REPORT</Text>
      <Text style={{ fontFamily: "SansSC", fontSize: 52, color: NAVY, marginTop: 12 }}>财务规划</Text>
      <Text style={{ fontFamily: "SansSClight", fontSize: 52, color: MUTE }}>报告</Text>
    </View>
    <View style={{ position: "absolute", bottom: 64, left: 64 }}>
      <Text style={{ fontFamily: "SansSClight", fontSize: 9, color: MUTE, letterSpacing: 1 }}>{D.client}   ·   {D.period}   ·   {D.advisor}</Text>
    </View>
  </Page>
  <Page size="A4" style={{ backgroundColor: NEARWHITE, padding: 60 }}>
    <Text style={{ fontFamily: "SansSClight", fontSize: 10, color: MUTE, letterSpacing: 4 }}>OVERALL HEALTH</Text>
    <Text style={{ fontFamily: "SansSC", fontSize: 22, color: NAVY, marginTop: 4 }}>整体财务健康</Text>

    <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 40 }}>
      <Text style={{ fontFamily: "SansSClight", fontSize: 110, color: NAVY, lineHeight: 1 }}>77</Text>
      <Text style={{ fontFamily: "SansSClight", fontSize: 20, color: MUTE, marginBottom: 18, marginLeft: 8 }}>/ 100</Text>
      <View style={{ width: 40, height: 3, backgroundColor: GOLD, marginBottom: 26, marginLeft: 20 }} />
    </View>

    <View style={{ marginTop: 44 }}>
      {D.components.map((c, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 13 }}>
          <Text style={{ width: 100, fontFamily: "SansSClight", fontSize: 9, color: INK }}>{c.label}</Text>
          <View style={{ flex: 1 }}><Bar frac={c.score / 100} color={c.score >= 70 ? NAVY : BAD} h={3} track="#EFEFED" /></View>
          <Text style={{ width: 40, textAlign: "right", fontFamily: "SansSClight", fontSize: 10, color: MUTE }}>{c.score}</Text>
        </View>
      ))}
    </View>

    <View style={{ marginTop: 46 }}>
      <Text style={{ fontFamily: "SansSClight", fontSize: 10, color: MUTE, letterSpacing: 3 }}>ANNUAL ALLOCATION</Text>
      <View style={{ flexDirection: "row", marginTop: 16, height: 10, borderRadius: 5, overflow: "hidden" }}>
        {D.budget.filter((b) => b.v > 0).map((b, i) => (
          <View key={i} style={{ width: `${(b.v / D.surplus) * 100}%`, backgroundColor: i === 2 ? GOLD : [NAVY, NAVY2, GOLD][i % 3], marginRight: 1.5 }} />
        ))}
      </View>
      <Text style={{ fontFamily: "SansSClight", fontSize: 9, color: MUTE, marginTop: 12 }}>
        保障 {rm(14131)}  ·  目标 {rm(5424)}  ·  财富增值 {rm(154445)}
      </Text>
    </View>
    <Text style={{ position: "absolute", bottom: 36, left: 60, fontFamily: "SansSClight", fontSize: 7, color: MUTE, letterSpacing: 1 }}>
      {D.client} · {D.period} · 2 / 22
    </Text>
  </Page>
</>);

// ============================================================ DIRECTION C
// 杂志编辑风 — navy bands, serif display + sans, strong contrast, pull-quote.
const C = () => (<>
  <Page size="A4" style={{ backgroundColor: "#FFFFFF" }}>
    <View style={{ backgroundColor: NAVY, height: 300, paddingHorizontal: 56, paddingTop: 60 }}>
      <View style={{ width: 46, height: 2, backgroundColor: GOLDL }} />
      <Text style={{ fontFamily: "SerifSC", fontSize: 28, color: "#FFFFFF", marginTop: 16, letterSpacing: 1 }}>XinWealth</Text>
      <Text style={{ fontFamily: "SansSClight", fontSize: 9, color: GOLDL, letterSpacing: 4, marginTop: 60 }}>FINANCIAL REPORT</Text>
      <Text style={{ fontFamily: "SerifSC", fontSize: 44, color: "#FFFFFF", marginTop: 8 }}>财务规划报告</Text>
    </View>
    <View style={{ paddingHorizontal: 56, marginTop: 40 }}>
      <Text style={{ fontFamily: "SerifSC", fontSize: 18, color: NAVY }}>{D.period}</Text>
      <View style={{ height: 1, backgroundColor: HAIR, marginTop: 20, marginBottom: 20 }} />
      <Row label="呈交予" value={D.client} />
      <Row label="顾问" value={D.advisor} />
    </View>
    <Text style={{ position: "absolute", bottom: 40, left: 56, fontFamily: "SansSClight", fontSize: 7.5, color: MUTE, letterSpacing: 1 }}>私人及保密文件 · 仅供指名客户参阅</Text>
  </Page>
  <Page size="A4" style={{ backgroundColor: "#FFFFFF" }}>
    <View style={{ backgroundColor: NAVY, paddingHorizontal: 56, paddingVertical: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View>
        <Text style={{ fontFamily: "SansSClight", fontSize: 8, color: GOLDL, letterSpacing: 3 }}>OVERALL FINANCIAL HEALTH</Text>
        <Text style={{ fontFamily: "SerifSC", fontSize: 22, color: "#FFFFFF", marginTop: 2 }}>整体财务健康</Text>
      </View>
      <Text style={{ fontFamily: "SerifSC", fontSize: 40, color: "#FFFFFF" }}>77<Text style={{ fontSize: 14, color: GOLDL }}> /100</Text></Text>
    </View>
    <View style={{ paddingHorizontal: 56, paddingTop: 26 }}>
      {/* pull quote */}
      <View style={{ borderLeftWidth: 2, borderLeftColor: GOLD, paddingLeft: 14, marginBottom: 22 }}>
        <Text style={{ fontFamily: "SerifSC", fontSize: 13, color: NAVY, lineHeight: 1.5 }}>
          「稳健的地基，唯一的软肋在风险保障——先补足保障，再谈财富增值。」
        </Text>
      </View>
      <Text style={{ fontFamily: "SansSC", fontSize: 9, color: GOLD, letterSpacing: 2 }}>评分构成</Text>
      <View style={{ marginTop: 12 }}>
        {D.components.map((c, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ width: 96, fontFamily: "SansSC", fontSize: 8.5, color: INK }}>{c.label}</Text>
            <View style={{ flex: 1 }}><Bar frac={c.score / 100} color={scoreColor(c.score)} h={6} /></View>
            <Text style={{ width: 40, textAlign: "right", fontFamily: "SerifSC", fontSize: 10, color: NAVY }}>{c.score}</Text>
          </View>
        ))}
      </View>
      <Text style={{ fontFamily: "SansSC", fontSize: 9, color: GOLD, letterSpacing: 2, marginTop: 22 }}>预算分配</Text>
      <View style={{ marginTop: 12 }}>
        {D.budget.map((b, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 9 }}>
            <Text style={{ width: 78, fontFamily: "SansSC", fontSize: 8.5, color: INK }}>{b.zh}</Text>
            <View style={{ flex: 1 }}><Bar frac={b.v / D.surplus} color={i === 4 ? GOLD : NAVY} h={6} /></View>
            <Text style={{ width: 84, textAlign: "right", fontFamily: "SerifSC", fontSize: 10, color: NAVY }}>{rm(b.v)}</Text>
          </View>
        ))}
      </View>
    </View>
    <Text style={{ position: "absolute", bottom: 34, left: 56, fontFamily: "SansSClight", fontSize: 7, color: MUTE, letterSpacing: 1 }}>{D.client} · {D.period} · 2 / 22</Text>
  </Page>
</>);

const Which = process.argv[3] || "A";
const Doc = () => <Document>{Which === "A" ? <A /> : Which === "B" ? <B /> : <C />}</Document>;
(async () => { await renderToFile(<Doc />, path.resolve(process.argv[2])); console.log("ok", Which); })();
