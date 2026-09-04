// TEMP probe — verify the variable fonts register and render (CJK + Latin).
import path from "path";
import { Document, Page, Text, View, Font, renderToFile } from "@react-pdf/renderer";

Font.register({ family: "SerifSC", src: path.resolve("public/fonts/NotoSerifSC-VF.ttf") });
Font.register({ family: "SansSC", src: path.resolve("public/fonts/NotoSansSC-VF.ttf") });
Font.register({ family: "SansSCreg", src: path.resolve("public/fonts/NotoSansSC-Regular.ttf") });
Font.registerHyphenationCallback((w) => [w]);

const Probe = () => (
  <Document>
    <Page size="A4" style={{ padding: 50, backgroundColor: "#FBF9F4" }}>
      <Text style={{ fontFamily: "SerifSC", fontSize: 34, color: "#0F2A43" }}>
        私人银行 · Private Banking
      </Text>
      <Text style={{ fontFamily: "SerifSC", fontSize: 60, color: "#0F2A43", marginTop: 10 }}>
        RM 1,063,000
      </Text>
      <View style={{ marginTop: 20 }}>
        <Text style={{ fontFamily: "SansSC", fontSize: 12, color: "#334155" }}>
          无衬线可变字体 SansSC — 整体财务健康评分 77/100，储蓄率 71.4%。
        </Text>
        <Text style={{ fontFamily: "SansSCreg", fontSize: 12, color: "#334155", marginTop: 6 }}>
          现有 Regular 单字重 — 对比参照。The quick brown fox 0123456789.
        </Text>
      </View>
    </Page>
  </Document>
);

(async () => {
  await renderToFile(<Probe />, path.resolve(process.argv[2]));
  console.log("ok");
})();
