import { fileURLToPath } from "node:url";
import { approxRange } from "@circles/shared";
import { Resvg } from "@resvg/resvg-js";

// The picture a chat shows under the invite link: the title, when, and the
// two answers, drawn the way the page draws them.

type PreviewEvent = {
  id: string;
  title: string;
  windowStart: string;
  windowEnd: string;
};

const width = 1200;
const height = 630;

// Inter draws the text; a glyph it lacks comes from the next font that has
// it. The CJK file is Noto Sans CJK SC cut with pyftsubset to the characters
// of GB 2312, JIS X 0208, Big5 level 1 and KS X 1001, with kana and the CJK
// punctuation and fullwidth forms; the emoji file is Noto Emoji at weight
// 400, drawn in one colour like the rest.
const fontFiles = [
  "Inter_400Regular.ttf",
  "Inter_600SemiBold.ttf",
  "NotoSansCJKsc-Subset.otf",
  "NotoEmoji-Regular.ttf",
].map((f) => fileURLToPath(new URL(`../assets/${f}`, import.meta.url)));

const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ]!,
  );

// Rough advance widths in ems, enough to wrap a title: Inter's by letter
// shape, a full em for kana, Han and Hangul, a bit more for emoji.
const wide = /[ᄀ-ᇿ　-ヿ㄰-㆏一-鿿가-힣＀-￯]/;
const pictographic = /\p{Extended_Pictographic}/u;
// Joiners and presentation selectors take no room of their own.
const joiner = /[‍︎️]/;
function textWidth(text: string, size: number): number {
  let em = 0;
  for (const ch of text) {
    if (joiner.test(ch)) continue;
    if (pictographic.test(ch)) em += 1.3;
    else if (wide.test(ch)) em += 1;
    else if (/[iljtfrI.,:;'!| ]/.test(ch)) em += 0.3;
    else if (/[mwMW]/.test(ch)) em += 0.9;
    else if (/[A-Z]/.test(ch)) em += 0.68;
    else em += 0.58;
  }
  return em * size;
}

const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });

// Lines no wider than maxWidth: words kept whole, and a word wider than a
// line on its own (a title with no spaces, or in a script without them) cut
// between characters, never inside one.
function wrap(text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  const fits = (candidate: string) => textWidth(candidate, size) <= maxWidth;
  for (const word of text.split(/\s+/)) {
    if (fits(word)) {
      const next = line ? `${line} ${word}` : word;
      if (line && !fits(next)) {
        lines.push(line);
        line = word;
      } else line = next;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const { segment } of graphemes.segment(word)) {
      if (line && !fits(line + segment)) {
        lines.push(line);
        line = segment;
      } else line += segment;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// The largest size on which the title takes at most two lines; failing
// that, two lines of the smallest with the rest cut.
export function fitTitle(title: string, maxWidth: number) {
  for (const size of [84, 68, 56]) {
    const lines = wrap(title, size, maxWidth);
    if (lines.length <= 2) return { size, lines };
  }
  const size = 56;
  const lines = wrap(title, size, maxWidth).slice(0, 2);
  const last = [...graphemes.segment(lines[1]!)].map((s) => s.segment);
  while (last.length && textWidth(`${last.join("")}…`, size) > maxWidth)
    last.pop();
  lines[1] = `${last.join("").trimEnd()}…`;
  return { size, lines };
}

const calendarGlyph = (x: number, y: number) =>
  `<g transform="translate(${x} ${y}) scale(1.75)" fill="none" stroke="#737373" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></g>`;

function pill(
  x: number,
  y: number,
  label: string,
  filled: boolean,
): { svg: string; width: number } {
  const size = 34;
  const w = Math.round(textWidth(label, size) + 96);
  const h = 96;
  const rect = filled
    ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#171717"/>`
    : `<rect x="${x + 1.5}" y="${y + 1.5}" width="${w - 3}" height="${h - 3}" rx="${(h - 3) / 2}" fill="#ffffff" stroke="#0a0a0a" stroke-width="3"/>`;
  const text = `<text x="${x + w / 2}" y="${y + h / 2 + 12}" text-anchor="middle" font-family="Inter" font-weight="600" font-size="${size}" fill="${filled ? "#fafafa" : "#0a0a0a"}">${escape(label)}</text>`;
  return { svg: rect + text, width: w };
}

function previewSvg(event: PreviewEvent, host: string): string {
  const card = { x: 36, y: 36, w: width - 72, h: height - 72 };
  const pad = 72;
  const left = card.x + pad;
  const right = card.x + card.w - pad;
  const { size, lines } = fitTitle(event.title, card.w - pad * 2);
  const lineHeight = Math.round(size * 1.12);
  const titleTop = 130;
  const title = lines
    .map(
      (line, i) =>
        `<tspan x="${left}" y="${Math.round(titleTop + size * 0.85 + i * lineHeight)}">${escape(line)}</tspan>`,
    )
    .join("");
  const rangeTop = titleTop + lines.length * lineHeight + 26;
  const pillTop = card.y + card.h - pad - 96;
  const out = pill(left, pillTop, "Can't make it", false);
  const inn = pill(left + out.width + 20, pillTop, "I'm in", true);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="#f5f5f5"/>
<rect x="${card.x}" y="${card.y}" width="${card.w}" height="${card.h}" rx="40" fill="#ffffff" stroke="#e5e5e5" stroke-width="2"/>
<text font-family="Inter" font-weight="600" font-size="${size}" letter-spacing="${(-size * 0.025).toFixed(1)}" fill="#0a0a0a">${title}</text>
${calendarGlyph(left, rangeTop)}
<text x="${left + 58}" y="${rangeTop + 33}" font-family="Inter" font-weight="400" font-size="36" fill="#737373">${escape(approxRange(event.windowStart, event.windowEnd))}</text>
${out.svg}${inn.svg}
<text x="${right}" y="${pillTop + 60}" text-anchor="end" font-family="Inter" font-weight="400" font-size="28" fill="#737373">${escape(host)}</text>
</svg>`;
}

const cache = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();
const cacheSize = 100;

export function previewPng(
  event: PreviewEvent,
  host: string,
): Promise<Uint8Array<ArrayBuffer>> {
  // Everything drawn.
  const key = JSON.stringify([
    event.id,
    event.title,
    event.windowStart,
    event.windowEnd,
    host,
  ]);
  let png = cache.get(key);
  if (!png) {
    png = Promise.resolve().then(
      () =>
        new Uint8Array(
          new Resvg(previewSvg(event, host), {
            fitTo: { mode: "width", value: width },
            font: {
              fontFiles,
              loadSystemFonts: false,
              defaultFontFamily: "Inter",
            },
          })
            .render()
            .asPng(),
        ),
    );
    if (cache.size >= cacheSize) cache.delete(cache.keys().next().value!);
    cache.set(key, png);
  }
  return png;
}
