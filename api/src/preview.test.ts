import { expect, test } from "vitest";
import { fitTitle, previewPng } from "./preview.ts";

const event = {
  id: "e1",
  title: "Ski trip",
  windowStart: "2026-12-01",
  windowEnd: "2027-01-31",
};

const size = (png: Uint8Array) => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

test("renders a 1200 by 630 PNG", async () => {
  const png = await previewPng(event, "circles.app");
  expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  expect(size(png)).toEqual({ width: 1200, height: 630 });
  expect(png.byteLength).toBeGreaterThan(5000);
});

test("caches per event and what is drawn", async () => {
  const a = await previewPng(event, "circles.app");
  expect(await previewPng(event, "circles.app")).toBe(a);
  expect(await previewPng({ ...event, id: "e2" }, "circles.app")).not.toBe(a);
  const renamed = await previewPng(
    { ...event, title: "Ski weekend" },
    "circles.app",
  );
  expect(renamed).not.toBe(a);
  expect(renamed).not.toEqual(a);
  expect(
    await previewPng({ ...event, windowEnd: "2026-12-31" }, "circles.app"),
  ).not.toBe(a);
});

test("takes any title and short window", async () => {
  const png = await previewPng(
    {
      id: "e3",
      title: `Ben & Chloe's <weekend> "ski" trip with everyone who'd come`,
      windowStart: "2026-12-11",
      windowEnd: "2026-12-14",
    },
    "localhost:3001",
  );
  expect(size(png)).toEqual({ width: 1200, height: 630 });
  const wide = await previewPng(
    {
      id: "e4",
      title: "WWWWWWWWWW MMMMMMMMMM WWWWWWWWWW MMMMMMMMMM WWWWWWWWWW MMMMMMMM",
      windowStart: "2026-12-01",
      windowEnd: "2026-12-01",
    },
    "circles.app",
  );
  expect(size(wide)).toEqual({ width: 1200, height: 630 });
});

test("Han, Hangul, kana and emoji are drawn, not boxes", async () => {
  const titled = (id: string, title: string) =>
    previewPng(
      { id, title, windowStart: "2026-12-11", windowEnd: "2026-12-14" },
      "circles.app",
    );
  // Glyphs a font lacks all come out as the same box.
  expect(await titled("h1", "滑雪")).not.toEqual(await titled("h2", "山海"));
  expect(await titled("k1", "스키")).not.toEqual(await titled("k2", "바다"));
  expect(await titled("j1", "スキー")).not.toEqual(
    await titled("j2", "やまだ"),
  );
  expect(await titled("m1", "🎿")).not.toEqual(await titled("m2", "🏂"));
});

test("a title with no spaces breaks between characters, never inside one", () => {
  const width = 984;
  const unbroken = "Skiweekendwitheveryonewhocanmakeitthisyearandnextyeartoo";
  const { lines } = fitTitle(unbroken, width);
  expect(lines).toHaveLength(2);
  expect(lines.join("")).toBe(unbroken);
  const han = fitTitle("滑雪".repeat(30), width);
  expect(han.size).toBe(56);
  expect(han.lines).toHaveLength(2);
  expect(han.lines[0]!.length).toBeGreaterThan(10);
  expect(han.lines[1]!.endsWith("…")).toBe(true);
  const party = fitTitle("🎉".repeat(60), width);
  expect(party.lines.join("")).toMatch(/^(🎉)+…$/u);
});
