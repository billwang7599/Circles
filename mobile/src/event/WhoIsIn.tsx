import {
  AVATAR_COLORS,
  type Question,
  type ResponseView,
} from "@circles/shared";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { IconButton } from "../ui/IconButton";
import { Section } from "../ui/Section";
import { Text } from "../ui/Text";
import { size, space } from "../ui/theme";

// A response carries no account colour, so the name picks one.
export function colorFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

const statusOf = (response: ResponseView) =>
  !response.attending
    ? "Can't make it"
    : response.answered
      ? "In"
      : "Hasn't answered";

// What the footer offers the person looking: their own answers page.
export const answersTitle = (me: ResponseView) =>
  me.attending && !me.answered ? "Add my answers" : "Change my answers";

// A date range stays on one line, so a list of them wraps at its commas:
// the spaces inside each "Dec 11 – 14" become no-break spaces.
const range = /^[A-Z][a-z]{2} \d{1,2}( – ([A-Z][a-z]{2} )?\d{1,2})?$/;
const keepRanges = (text: string) =>
  text
    .split(", ")
    .map((piece) => (range.test(piece) ? piece.replace(/ /g, " ") : piece))
    .join(", ");

// Past this many characters an answer takes the whole line.
const shortAnswer = 18;

// Whoever is looking first, then the people who are in with their answers,
// then those still to answer, then those who can't make it.
const rank = (response: ResponseView) =>
  response.you ? 0 : !response.attending ? 3 : response.answered ? 1 : 2;

type Props = {
  responses: ResponseView[];
  // The event's questions, to know which answer is the dates.
  questions: Question[];
  // The organizer's own answers live in their row; a respondent's are the
  // screen's footer. Neither once the event has ended.
  isOrganizer: boolean;
  onAnswers?: () => void;
  answersPending: boolean;
  // The organizer takes someone else off the list; not once the event has
  // ended.
  onRemove?: (response: ResponseView) => void;
  error?: string;
};

export function WhoIsIn({
  responses,
  questions,
  isOrganizer,
  onAnswers,
  answersPending,
  onRemove,
  error,
}: Props) {
  const sorted = [...responses].sort((a, b) => rank(a) - rank(b));
  // A closed row shows one answer, the dates when there are any: the fact
  // worth comparing down the list. A tap opens the rest.
  const datesTitle = questions.find((q) => q.kind === "dates")?.title;
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <Section title="Who's in">
      <Card list>
        {sorted.map((response) => {
          const out = !response.attending;
          const mine = response.you && isOrganizer;
          // A filled avatar in the list already says "in"; the line speaks
          // only for who can't come or hasn't answered, and the organizer's
          // own pill says where they stand.
          const status = out
            ? statusOf(response)
            : !mine && !response.answered
              ? statusOf(response)
              : undefined;
          const remove =
            onRemove && !response.you ? () => onRemove(response) : undefined;
          // Someone who is out keeps only their status; stale answers from
          // before they backed out are not shown.
          const answers = out ? [] : response.answers;
          const lead =
            answers.find((line) => line.title === datesTitle) ?? answers[0];
          const expandable = answers.length > 1;
          const open = expandable && opened.has(response.id);
          return (
            <Pressable
              key={response.id}
              style={styles.row}
              onPress={expandable ? () => toggle(response.id) : undefined}
              // The row is a container: its name, status and answers read on
              // their own, and the chevron and the X are the row's buttons.
              accessible={false}
            >
              <Avatar
                name={response.name}
                color={colorFor(response.name)}
                outlined={out}
                size={size.small}
              />
              <View style={styles.text}>
                <View style={styles.nameRow}>
                  <Text
                    variant="headline"
                    color={out ? "textMuted" : "foreground"}
                    numberOfLines={2}
                    style={styles.grow}
                  >
                    {response.name}
                  </Text>
                  {mine && onAnswers ? (
                    <Button
                      title={answersTitle(response)}
                      variant="secondary"
                      size="small"
                      onPress={onAnswers}
                      loading={answersPending}
                    />
                  ) : response.you ? (
                    <Text color="textMuted">You</Text>
                  ) : null}
                  {expandable ? (
                    <View style={[styles.glyph, !remove && styles.last]}>
                      <IconButton
                        icon={open ? "chevron-up" : "chevron-down"}
                        label={open ? "Show fewer answers" : "Show all answers"}
                        onPress={() => toggle(response.id)}
                      />
                    </View>
                  ) : null}
                  {remove ? (
                    <View style={[styles.glyph, styles.last]}>
                      <IconButton
                        icon="xmark"
                        label={`Remove ${response.name}`}
                        onPress={remove}
                      />
                    </View>
                  ) : null}
                </View>
                {status ? <Text color="textMuted">{status}</Text> : null}
                {lead && !open ? (
                  <View style={styles.lead}>
                    {lead.title === datesTitle ? null : (
                      <Text variant="caption" color="textMuted">
                        {lead.title}
                      </Text>
                    )}
                    <Text
                      color={
                        lead.title === datesTitle ? "textMuted" : undefined
                      }
                      numberOfLines={expandable ? 1 : undefined}
                    >
                      {keepRanges(lead.text)}
                    </Text>
                  </View>
                ) : null}
                {open ? (
                  <View style={styles.answers}>
                    {answers.map((line, index) => (
                      <View
                        key={index}
                        style={[
                          styles.answer,
                          line.text.length > shortAnswer && styles.wide,
                        ]}
                      >
                        <Text variant="caption" color="textMuted">
                          {line.title}
                        </Text>
                        <Text>{keepRanges(line.text)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </Card>
      {error ? <Text color="danger">{error}</Text> : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  text: { flex: 1, gap: space.xs },
  // As tall as the avatar, so a lone name sits level with it.
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: size.small,
  },
  grow: { flex: 1 },
  // 44 pt targets that keep the row at the avatar's height; the last one's
  // glyph lands where the row's padding would put it.
  glyph: { marginVertical: -space.xs },
  // The last glyph sits where the row's padding would put it.
  last: { marginRight: -(space.lg - space.xs) },
  lead: { gap: 2 },
  // Each answer is its question's title over what they said: short ones two
  // to a line, like the items on an option card's days; a long or lone one
  // takes the line.
  answers: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: space.lg,
    rowGap: space.sm,
    paddingTop: space.xs,
  },
  answer: { flexBasis: "45%", flexGrow: 1, minWidth: 120 },
  wide: { flexBasis: "100%" },
});
