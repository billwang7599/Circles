import { Chip } from "./ui";
import type { SavedOutcome } from "./savedPlan";

const formatRange = (start: string, end: string, timeZone?: string) => {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  const s = new Date(start);
  const e = new Date(end);
  return day.format(s) === day.format(e)
    ? `${day.format(s)}, ${time.format(s)} to ${time.format(e)}`
    : `${day.format(s)} ${time.format(s)} to ${day.format(e)} ${time.format(e)}`;
};

type CheckKind = "met" | "unmet" | "unverified";
const kindOf = (check: string): CheckKind =>
  check.includes("not met")
    ? "unmet"
    : check.includes("unverified")
      ? "unverified"
      : "met";

const ICON: Record<CheckKind, { glyph: string; style: string }> = {
  met: { glyph: "✓", style: "bg-ok-tint text-ok" },
  unmet: { glyph: "!", style: "bg-warn-tint text-warn" },
  unverified: { glyph: "?", style: "bg-paper text-ink-faint" },
};

/** A met rule is solid. A missed preference is dashed. Unknown data is quiet. */
function CheckRow({ text }: { text: string }) {
  const kind = kindOf(text);
  const soft = text.includes("(preferred)");
  const { glyph, style } = ICON[kind];
  return (
    <li
      className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
        kind === "unmet"
          ? "border border-dashed border-warn/60 bg-warn-tint/40 text-warn"
          : soft
            ? "border border-dashed border-line text-ink-soft"
            : "text-ink-soft"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-px inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${style}`}
      >
        {glyph}
      </span>
      <span>{text.replace(" (preferred)", "").replace(", not met", "")}</span>
    </li>
  );
}

export function PlanOutcome({
  outcome,
  timezone,
}: {
  outcome: SavedOutcome;
  timezone?: string;
}) {
  if (outcome.status === "pending") {
    return (
      <p className="text-sm text-ink-soft" role="status">
        Planning in the background
        {outcome.stage ? `, now ${outcome.stage}` : ""}.
      </p>
    );
  }
  if (outcome.status === "error") {
    return (
      <p
        className="rounded-lg bg-bad-tint px-3 py-2 text-sm text-bad"
        role="alert"
      >
        {outcome.message}
      </p>
    );
  }
  if (outcome.status === "no_matches") {
    return (
      <p className="rounded-lg bg-warn-tint px-3 py-2 text-sm text-warn">
        {outcome.message} Try switching a filter to Prefer, or widening the
        radius.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {outcome.notice && (
        <p className="rounded-lg border border-dashed border-warn/60 bg-warn-tint/40 px-3 py-2 text-sm text-warn">
          {outcome.notice}
        </p>
      )}
      <OptionList options={outcome.options} timezone={timezone} />
    </div>
  );
}

function OptionList({
  options,
  timezone,
}: {
  options: Extract<SavedOutcome, { status: "ok" }>["options"];
  timezone?: string;
}) {
  return (
    <ul className="space-y-3">
      {options.map((o) => (
        <li
          key={o.candidateId}
          className="rounded-xl border border-line bg-surface p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h4 className="font-display text-lg font-bold leading-tight">
              {o.name}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {o.distanceKm !== undefined && (
                <Chip>{o.distanceKm} km away</Chip>
              )}
              {o.rating !== undefined && <Chip>Rated {o.rating}</Chip>}
              {o.priceLevel !== undefined && (
                <Chip>{"$".repeat(Math.max(1, o.priceLevel))}</Chip>
              )}
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {o.rationale}
          </p>

          {(o.availableTimes ?? []).length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-ink">
                When everyone is free and it's open
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {(o.availableTimes ?? []).map((t) => (
                  <li key={t.start}>
                    <Chip tone="brand">
                      {formatRange(t.start, t.end, timezone)}
                    </Chip>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="mt-3 space-y-1">
            {o.constraintChecks.map((c) => (
              <CheckRow key={c} text={c} />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
