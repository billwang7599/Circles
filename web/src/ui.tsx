import type { ReactNode } from "react";

/** Shared class strings, so every control reads as part of one system. */
export const field =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint";

const button =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const btn = {
  primary: `${button} bg-brand text-white enabled:hover:bg-brand-deep`,
  secondary: `${button} border border-line bg-surface text-ink enabled:hover:bg-paper`,
  quiet: `${button} px-2 text-ink-soft enabled:hover:text-ink`,
  danger: `${button} px-2 text-bad enabled:hover:bg-bad-tint`,
};

const AVATAR_COLOURS = [
  "#3b4bdb",
  "#1f8a70",
  "#7c3aed",
  "#0891b2",
  "#be185d",
  "#4d7c0f",
  "#b45309",
  "#1d4ed8",
];

const colourFor = (name: string) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length]!;
};

/** A person as a circle. The product is about circles of people, so this is the motif. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white ring-2 ring-paper"
      style={{
        width: size,
        height: size,
        background: colourFor(name),
        fontSize: size * 0.42,
      }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Overlapping circles, one per person. */
export function AvatarStack({ names }: { names: string[] }) {
  const shown = names.slice(0, 6);
  return (
    <span
      className="inline-flex items-center"
      aria-label={`${names.length} people`}
    >
      {shown.map((n, i) => (
        <span key={`${n}-${i}`} className={i === 0 ? "" : "-ml-2"}>
          <Avatar name={n} size={32} />
        </span>
      ))}
      {names.length > shown.length && (
        <span className="-ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-line text-xs font-medium text-ink-soft ring-2 ring-paper">
          +{names.length - shown.length}
        </span>
      )}
    </span>
  );
}

/** The wordmark: two overlapping circles and the name. */
export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden="true">
        <circle cx="11" cy="11" r="10" fill="#3b4bdb" />
        <circle cx="19" cy="11" r="10" fill="#1f8a70" fillOpacity="0.85" />
      </svg>
      <span className="font-display text-2xl font-bold tracking-tight">
        Circles
      </span>
    </span>
  );
}

export function Chip({
  children,
  tone = "plain",
}: {
  children: ReactNode;
  tone?: "plain" | "ok" | "warn" | "brand";
}) {
  const tones = {
    plain: "bg-paper text-ink-soft",
    ok: "bg-ok-tint text-ok",
    warn: "bg-warn-tint text-warn",
    brand: "bg-brand-tint text-brand-deep",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * A two-way switch. The solid pill is a rule, the dashed pill is a preference, and the
 * same line style marks soft constraints everywhere in the app.
 */
export function ModeSwitch({
  value,
  onChange,
  label,
}: {
  value: "hard" | "prefer";
  onChange: (v: "hard" | "prefer") => void;
  label: string;
}) {
  const option = (v: "hard" | "prefer", text: string) => {
    const on = value === v;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => onChange(v)}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          on
            ? v === "hard"
              ? "border border-brand bg-brand text-white"
              : "border border-dashed border-brand bg-brand-tint text-brand-deep"
            : "border border-transparent text-ink-soft hover:text-ink"
        }`}
      >
        {text}
      </button>
    );
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex shrink-0 gap-1 rounded-full border border-line bg-paper p-0.5"
    >
      {option("hard", "Must have")}
      {option("prefer", "Prefer")}
    </div>
  );
}
