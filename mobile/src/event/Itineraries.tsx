import {
  dayRange,
  daysBetween,
  type Detail,
  type Itinerary,
  type ItineraryDay,
  type ItineraryItem,
} from "@circles/shared";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { formatDay } from "../dates";
import { shareText } from "../share";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Empty } from "../ui/Empty";
import { Icon, type IconName } from "../ui/Icon";
import { Section } from "../ui/Section";
import { Segmented } from "../ui/Segmented";
import { Stat } from "../ui/Stat";
import { Text } from "../ui/Text";
import {
  radius,
  space,
  typeScale,
  useTheme,
  type EventTone,
} from "../ui/theme";

// The mark on a day's rail for each part of the day; hour by hour, the clock
// time says it and the mark is a dot.
const partMarks: Record<string, IconName> = {
  Morning: "sunrise",
  Afternoon: "sun",
  Evening: "sunset",
};

const DETAILS: readonly { id: Detail; label: string }[] = [
  { id: "parts", label: "Times of day" },
  { id: "hours", label: "Hour by hour" },
];

const mapsUrl = (place: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;

// The summary when it adds something: a model that only repeats the dates
// or the picks says nothing the card does not.
function freshSummary(itinerary: Itinerary) {
  const summary = itinerary.summary.trim();
  if (!summary) return undefined;
  const text = summary.toLowerCase();
  const restates =
    text.includes(dayRange(itinerary.start, itinerary.end).toLowerCase()) ||
    itinerary.picks.some((pick) => text.includes(pick.toLowerCase()));
  return restates ? undefined : summary;
}

// The option as a message to paste into the group chat.
function itineraryText(itinerary: Itinerary) {
  const summary = freshSummary(itinerary);
  const lines = [itinerary.title, dayRange(itinerary.start, itinerary.end)];
  if (itinerary.picks.length) lines.push(itinerary.picks.join(", "));
  if (summary) lines.push(summary);
  for (const day of itinerary.days) {
    lines.push("", `${day.title} (${dayRange(day.date, day.date)})`);
    for (const item of day.items)
      lines.push(
        `${item.when}: ${item.text}${item.place ? ` – ${item.place}` : ""}`,
      );
  }
  return lines.join("\n");
}

// The model tends to open a day's title with its date, which the heading
// already says; keep only what it adds, if anything.
const datePrefix =
  /^(?:(?:mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?,?\s+)?(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?|day\s+\d+)\s*(?:[-–—:,]\s*)?/i;
function dayNote(day: ItineraryDay) {
  const note = day.title.replace(datePrefix, "").trim();
  if (!note) return undefined;
  return formatDay(day.date).toLowerCase().includes(note.toLowerCase())
    ? undefined
    : note;
}

// A place worth a map link: a named one, not where someone lives or sleeps,
// not what the line already says, and not the one the line above just gave.
const nowhere = /^(home|hotel|the hotel|airbnb|accommodation|lodging)$/i;
function placeOf(item: ItineraryItem, previous: string | null) {
  const place = item.place?.trim();
  if (!place || nowhere.test(place)) return null;
  if (item.text.toLowerCase().includes(place.toLowerCase())) return null;
  return place === previous?.trim() ? null : place;
}

type Props = {
  itineraries: Itinerary[];
  stale: boolean;
  // The organizer's choice of how full each day is, ahead of making them;
  // left out when they cannot be made yet.
  detail?: { value: Detail; onChange: (detail: Detail) => void };
  // The event's tone, worn by the picks on each option.
  tone: EventTone;
};

export function Itineraries({ itineraries, stale, detail, tone }: Props) {
  const options = [...itineraries].sort((a, b) => a.rank - b.rank);
  return (
    <Section
      title="Itinerary"
      action={
        stale && options.length ? (
          <Text variant="caption" color="textMuted">
            Changed since these were made
          </Text>
        ) : undefined
      }
    >
      {detail ? (
        <View style={styles.detail}>
          <Text variant="label">Detail</Text>
          <Segmented
            options={DETAILS}
            value={detail.value}
            onChange={detail.onChange}
          />
        </View>
      ) : null}
      {options.length === 0 ? (
        <Empty text="No options yet" />
      ) : (
        options.map((itinerary) => (
          <ItineraryCard key={itinerary.id} itinerary={itinerary} tone={tone} />
        ))
      )}
    </Section>
  );
}

function ItineraryCard({
  itinerary,
  tone,
}: {
  itinerary: Itinerary;
  tone: EventTone;
}) {
  const { colors } = useTheme();
  // A mark sits centred on its item's first line at any text size.
  const scale = Math.min(useWindowDimensions().fontScale, 1.5);
  const line = typeScale.body.lineHeight * scale;
  const hours = itinerary.detail === "hours";
  const summary = freshSummary(itinerary);
  const days = daysBetween(itinerary.start, itinerary.end) + 1;
  const everyone = itinerary.free >= itinerary.of;
  return (
    <Card>
      <View style={styles.top}>
        <View style={styles.grow}>
          <Text variant="heading" numberOfLines={2}>
            {itinerary.title}
          </Text>
          <Text color="textMuted">
            {dayRange(itinerary.start, itinerary.end)}
          </Text>
        </View>
        <View style={styles.stat}>
          {everyone ? (
            <Stat value={days} label={days === 1 ? "day" : "days"} />
          ) : (
            <Stat value={`${itinerary.free}/${itinerary.of}`} label="free" />
          )}
        </View>
      </View>
      <View style={[styles.rule, { backgroundColor: colors.border }]} />
      {itinerary.picks.length || itinerary.overBudget ? (
        <View style={styles.chips}>
          {itinerary.picks.map((pick) => (
            <View
              key={pick}
              style={[styles.chip, { backgroundColor: tone.fill }]}
            >
              <Text variant="label" style={{ color: tone.ink }}>
                {pick}
              </Text>
            </View>
          ))}
          {itinerary.overBudget ? (
            <View
              style={[
                styles.chip,
                styles.outlined,
                { borderColor: colors.danger },
              ]}
            >
              <Text variant="label" color="danger">
                {"Over the group's budget"}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {summary ? <Text>{summary}</Text> : null}
      {itinerary.daysPending ? (
        <View style={styles.day}>
          <View style={[styles.rule, { backgroundColor: colors.border }]} />
          <ActivityIndicator
            color={colors.textMuted}
            accessibilityLabel="Writing the days"
            style={styles.writing}
          />
        </View>
      ) : null}
      {itinerary.days.map((day) => {
        const note = dayNote(day);
        return (
          <View key={day.date} style={styles.day}>
            <View style={[styles.rule, { backgroundColor: colors.border }]} />
            <View style={styles.dayHead}>
              <Text variant="label">{formatDay(day.date)}</Text>
              {note ? (
                <Text color="textMuted" numberOfLines={1} style={styles.shrink}>
                  {note}
                </Text>
              ) : null}
            </View>
            {day.items.map((item, index) => {
              const place = placeOf(
                item,
                index > 0 ? day.items[index - 1]!.place : null,
              );
              const last = index === day.items.length - 1;
              return (
                <View key={index} style={styles.item}>
                  {hours ? (
                    <Text
                      color="textMuted"
                      style={[styles.time, { width: 48 * scale }]}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      {item.when}
                    </Text>
                  ) : null}
                  <View style={styles.rail}>
                    <View style={[styles.node, { height: line }]}>
                      {hours ? (
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: colors.foreground },
                          ]}
                        />
                      ) : (
                        <Icon
                          name={partMarks[item.when] ?? "sun"}
                          size={16}
                          color={colors.foreground}
                        />
                      )}
                    </View>
                    {last ? null : (
                      <View
                        style={[
                          styles.connector,
                          { backgroundColor: colors.border },
                        ]}
                      />
                    )}
                  </View>
                  <View style={[styles.grow, last ? null : styles.itemGap]}>
                    <Text accessibilityLabel={`${item.when}. ${item.text}`}>
                      {item.text}
                    </Text>
                    {place ? (
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel={`${place}, open in Maps`}
                        hitSlop={space.xs}
                        onPress={() => void Linking.openURL(mapsUrl(place))}
                        style={({ pressed }) => [
                          styles.place,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <View style={styles.pin}>
                          <Icon
                            name="map-pin"
                            size={14}
                            color={colors.foreground}
                          />
                        </View>
                        <Text style={styles.shrink}>{place}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
      <View style={styles.bottom}>
        <View
          style={styles.people}
          accessible
          accessibilityLabel={`${itinerary.free} of ${itinerary.of} can make it`}
        >
          <Icon name="people" size={16} color={colors.textMuted} />
          <Text color="textMuted">{itinerary.free}</Text>
        </View>
        <View style={styles.grow} />
        <Button
          title="Share"
          variant="secondary"
          size="small"
          icon="share"
          onPress={() => void shareText(itineraryText(itinerary))}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // The organizer's setting for the next options, not a view of these.
  detail: { gap: space.inline },
  top: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  grow: { flex: 1 },
  shrink: { flexShrink: 1 },
  stat: { alignItems: "flex-end" },
  rule: { height: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  outlined: { borderWidth: 1.2, paddingVertical: space.xs - 1.2 },
  day: { gap: space.md },
  // Where the days will go, while the server is still writing them.
  writing: { alignSelf: "flex-start", paddingVertical: space.sm },
  dayHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.sm,
  },
  // Each item hangs off a rail: its mark on the first line, a hairline down
  // to the next item's mark, and the text given the width it needs.
  item: { flexDirection: "row", alignItems: "stretch", gap: space.md },
  itemGap: { paddingBottom: space.lg },
  time: { textAlign: "right", fontVariant: ["tabular-nums"] },
  rail: { width: 24, alignItems: "center" },
  node: { width: 24, alignItems: "center", justifyContent: "center" },
  connector: { flex: 1, width: 1 },
  dot: { width: 6, height: 6, borderRadius: radius.full },
  // The pin is the affordance; the place reads as part of the line, and the
  // pin stays on the first line when the name wraps.
  place: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.inline,
    alignSelf: "flex-start",
    marginTop: space.xs,
  },
  pin: { paddingTop: 3 },
  bottom: { flexDirection: "row", alignItems: "center", gap: space.sm },
  // Who can make it, as the home tiles count people: a glyph and a number.
  people: { flexDirection: "row", alignItems: "center", gap: space.inline },
});
