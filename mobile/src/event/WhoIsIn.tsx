import { AVATAR_COLORS, type ResponseView } from "@circles/shared";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Empty } from "../ui/Empty";
import { Section } from "../ui/Section";
import { Text } from "../ui/Text";
import { space } from "../ui/theme";

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

// A date range stays on one line, so a list of them wraps at its commas.
const range = /^[A-Z][a-z]{2} \d{1,2}( – ([A-Z][a-z]{2} )?\d{1,2})?$/;
const keepRanges = (text: string) =>
  text
    .split(", ")
    .map((piece) => (range.test(piece) ? piece.replace(/ /g, " ") : piece))
    .join(", ");

// Past this many characters an answer takes the whole line.
const shortAnswer = 18;
// Past this many it shows three lines until tapped.
const longAnswer = 160;

// Whoever is looking first, then the people who are in with their answers,
// then those still to answer, then those who can't make it.
const rank = (response: ResponseView) =>
  response.you ? 0 : !response.attending ? 3 : response.answered ? 1 : 2;

type Props = {
  responses: ResponseView[];
  // The organizer's own answers live in their row; a respondent's are the
  // screen's footer. Neither once the event has ended.
  isOrganizer: boolean;
  onAnswers?: () => void;
  answersPending: boolean;
  answersError?: string;
};

export function WhoIsIn({
  responses,
  isOrganizer,
  onAnswers,
  answersPending,
  answersError,
}: Props) {
  const sorted = [...responses].sort((a, b) => rank(a) - rank(b));
  // The long answers opened in full, by response and position.
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  return (
    <Section title="Who's in">
      {responses.length === 0 ? (
        <Empty text="No one yet" />
      ) : (
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
            return (
              <View
                key={response.id}
                style={styles.row}
                accessible={!mine}
                accessibilityLabel={`${response.name}, ${statusOf(response)}${response.answers
                  .map((line) => `. ${line.title}: ${line.text}`)
                  .join("")}`}
              >
                <Avatar
                  name={response.name}
                  color={colorFor(response.name)}
                  outlined={out}
                  size={36}
                />
                <View style={styles.text}>
                  <View style={styles.nameRow}>
                    <Text
                      variant="headline"
                      color={out ? "textMuted" : "foreground"}
                      numberOfLines={1}
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
                  </View>
                  {status ? <Text color="textMuted">{status}</Text> : null}
                  {response.answers.length ? (
                    <View style={styles.answers}>
                      {response.answers.map((line, index) => {
                        const key = `${response.id}:${index}`;
                        const long = line.text.length > longAnswer;
                        const open = opened.has(key);
                        return (
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
                            {long ? (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={
                                  open ? "Show less" : "Show the whole answer"
                                }
                                onPress={() => toggle(key)}
                              >
                                <Text numberOfLines={open ? undefined : 3}>
                                  {line.text}
                                </Text>
                              </Pressable>
                            ) : (
                              <Text>{keepRanges(line.text)}</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </Card>
      )}
      {answersError ? <Text color="danger">{answersError}</Text> : null}
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
    gap: space.sm,
    minHeight: 36,
  },
  grow: { flex: 1 },
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
