// Shared page furniture. Every content page wears the same frame, which is what
// makes 29 pages read as one document.
//
// Grammar borrowed from the Canva template the user chose
// (docs/design-refs/canva-extract.md), recoloured to XinWealth navy/gold:
// gold section-number block, heavy navy title, short gold rule, and a running
// footer whose page number and title swap sides on facing pages.

import React from "react";
import { Page, View, Text } from "@react-pdf/renderer";
import { T, TYPE, SPACE, PAGE, LEADING } from "../theme";
import { FONT, WEIGHT } from "../fonts";

/** Identifies the page as the first of its module, which earns the navy band. */
export interface ModuleOpener {
  moduleNo: number;
  moduleZh: string;
  titleZh: string;
  titleEn: string;
}

export interface PageFrameProps {
  /** 1-based; drives the alternating footer */
  pageNumber: number;
  /** italic line in the footer */
  runningTitle: string;
  children: React.ReactNode;
  /** cover and back cover opt out of the frame */
  background?: string;
  /**
   * Present only on the first page of a module. Twenty-nine pages of the same
   * title-plus-content architecture read as a stack of tables rather than a
   * book; giving each module's opening page a full-bleed navy band gives the
   * reader a breath at every section change. Pages that carry this must NOT
   * also render <PageTitle> — the band replaces it.
   */
  opener?: ModuleOpener;
}

export function PageFrame({
  pageNumber, runningTitle, children, background, opener,
}: PageFrameProps) {
  // Recto (odd) keeps the number outboard right, verso (even) outboard left —
  // the convention the template follows and the reason it feels like a booklet.
  const numberOnRight = pageNumber % 2 === 1;
  return (
    <Page
      size="A4"
      style={{
        backgroundColor: background ?? T.paper,
        fontFamily: FONT.body,
        fontSize: TYPE.body,
        color: T.text,
        lineHeight: 1.5,
      }}
    >
      {opener && <ModuleBand {...opener} />}
      {/* Padding lives on this wrapper, not the Page, so a banner above it can
          run full-bleed to the sheet edge. */}
      <View
        style={{
          paddingTop: opener ? SPACE.xl : PAGE.marginTop,
          paddingBottom: PAGE.marginBottom,
          paddingHorizontal: PAGE.marginX,
          flexGrow: 1,
        }}
      >
        {children}
      </View>
      <Footer pageNumber={pageNumber} runningTitle={runningTitle} numberOnRight={numberOnRight} />
    </Page>
  );
}

/** Full-bleed navy band: the section change the reader feels when turning in. */
function ModuleBand({ moduleNo, moduleZh, titleZh, titleEn }: ModuleOpener) {
  return (
    <View style={{ backgroundColor: T.blue, paddingTop: 34, paddingBottom: 28, paddingHorizontal: PAGE.marginX }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View
          style={{
            width: 54, height: 54, backgroundColor: T.gold,
            alignItems: "center", justifyContent: "center", marginRight: SPACE.lg,
          }}
        >
          <Text style={{ fontFamily: FONT.serif, fontWeight: WEIGHT.bold, fontSize: 24, color: T.white }}>
            {String(moduleNo).padStart(2, "0")}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: FONT.sans, fontWeight: WEIGHT.medium, fontSize: TYPE.kicker,
              color: T.gold, letterSpacing: 2.4,
            }}
          >
            {titleEn.toUpperCase()}
          </Text>
          <Text
            style={{
              fontFamily: FONT.serif, fontWeight: WEIGHT.bold, fontSize: TYPE.h1,
              color: T.white, marginTop: 3, lineHeight: LEADING.display,
            }}
          >
            {titleZh}
          </Text>
          <Text
            style={{
              fontFamily: FONT.sans, fontSize: TYPE.caption, color: T.onDarkMute,
              letterSpacing: 1.6, marginTop: 5,
            }}
          >
            {moduleZh}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Footer({
  pageNumber, runningTitle, numberOnRight,
}: { pageNumber: number; runningTitle: string; numberOnRight: boolean }) {
  const badge = (
    <View
      style={{
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: T.panel,
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={{ fontFamily: FONT.serif, fontWeight: WEIGHT.bold, fontSize: TYPE.caption + 1, color: T.blue }}>
        {String(pageNumber).padStart(2, "0")}
      </Text>
    </View>
  );
  const title = (
    <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.caption, color: T.muted }}>
      {runningTitle}
    </Text>
  );
  return (
    <View
      fixed
      style={{
        position: "absolute",
        bottom: 24, left: PAGE.marginX, right: PAGE.marginX,
      }}
    >
      <View style={{ height: 0.75, backgroundColor: T.hairline, marginBottom: 8 }} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {numberOnRight ? title : badge}
        {numberOnRight ? badge : title}
      </View>
    </View>
  );
}

/** Gold block carrying the module number — the template's strongest wayfinder. */
export function SectionNumber({ n, size = 54 }: { n: number | string; size?: number }) {
  return (
    <View style={{ width: size, height: size, backgroundColor: T.gold, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: FONT.serif, fontWeight: WEIGHT.bold, fontSize: size * 0.45, color: T.white }}>
        {typeof n === "number" ? String(n).padStart(2, "0") : n}
      </Text>
    </View>
  );
}

export interface PageTitleProps {
  zh: string;
  en: string;
  /** module number for the gold block; omit for pages outside the ten modules */
  moduleNo?: number;
}

/** Kicker + heavy title + short gold rule, the template's title lockup. */
export function PageTitle({ zh, en, moduleNo }: PageTitleProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: SPACE.xl }}>
      {moduleNo != null && (
        <View style={{ marginRight: SPACE.lg }}>
          <SectionNumber n={moduleNo} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: FONT.sans, fontWeight: WEIGHT.medium, fontSize: TYPE.kicker,
            color: T.goldDark, letterSpacing: 2.4,
          }}
        >
          {en.toUpperCase()}
        </Text>
        <Text
          style={{
            fontFamily: FONT.serif, fontWeight: WEIGHT.bold, fontSize: TYPE.h1,
            color: T.blue, marginTop: 2, lineHeight: LEADING.display,
          }}
        >
          {zh}
        </Text>
        <View style={{ width: 58, height: 4, backgroundColor: T.gold, marginTop: SPACE.sm }} />
      </View>
    </View>
  );
}

/** Sub-heading inside a page. No left border stripe — that reads as a template. */
export function H2({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.h2,
        color: T.blue, marginTop: SPACE.lg, marginBottom: SPACE.sm,
        lineHeight: LEADING.heading,
      }}
    >
      {children}
    </Text>
  );
}

export function Hairline({ my = SPACE.md }: { my?: number }) {
  return <View style={{ height: 0.75, backgroundColor: T.hairline, marginVertical: my }} />;
}

/**
 * Shown wherever a page's module has not been generated. A fixed template must
 * still emit the page — a missing page would renumber everything after it and
 * break the table of contents.
 */
export function EmptyState({ zh, en }: { zh: string; en: string }) {
  return (
    <View
      style={{
        borderWidth: 0.75, borderColor: T.hairline, borderRadius: 6,
        paddingVertical: SPACE.xl, paddingHorizontal: SPACE.lg,
        alignItems: "center", backgroundColor: T.white,
      }}
    >
      <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.medium, fontSize: TYPE.body, color: T.muted }}>
        {zh}
      </Text>
      <Text style={{ fontFamily: FONT.sans, fontSize: TYPE.caption, color: T.faint, marginTop: 3 }}>
        {en}
      </Text>
    </View>
  );
}

/** Body copy — one place to change if prose styling ever needs to move. */
export function Prose({
  children, style,
}: {
  children: string;
  style?: Record<string, unknown>;
}) {
  return (
    <Text
      style={{
        fontFamily: FONT.body, fontSize: TYPE.body, color: T.text,
        lineHeight: LEADING.body, ...style,
      }}
    >
      {children}
    </Text>
  );
}
