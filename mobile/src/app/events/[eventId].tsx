import {
  approxRange,
  daysBetween,
  EventTitle,
  hasEnded,
  maxQuestions,
  type Detail,
  type Question,
  type QuestionKind,
  type ResponseView,
} from "@circles/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  isRefusal,
  useAnswersLink,
  useDeleteEvent,
  useEditEvent,
  useEvent,
  useMakeItineraries,
  useRemoveResponse,
} from "../../api";
import { Itineraries } from "../../event/Itineraries";
import { QuestionEditor } from "../../event/QuestionEditor";
import { moveItem, QuestionList } from "../../event/QuestionList";
import { answersTitle, colorFor, WhoIsIn } from "../../event/WhoIsIn";
import { copyText } from "../../share";
import { AvatarStack } from "../../ui/AvatarStack";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { ErrorState } from "../../ui/ErrorState";
import { Field } from "../../ui/Field";
import { RoundButton } from "../../ui/RoundButton";
import { Screen } from "../../ui/Screen";
import { Section } from "../../ui/Section";
import { Stat } from "../../ui/Stat";
import { Text } from "../../ui/Text";
import { eventTone, radius, space } from "../../ui/theme";

const allKinds: QuestionKind[] = ["dates", "budget", "choice", "text"];

// Alert has no web implementation; the browser's confirm stands in.
function confirmDestructive(
  title: string,
  message: string,
  action: string,
  onConfirm: () => void,
) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: action, style: "destructive", onPress: onConfirm },
  ]);
}

export default function Event() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const edit = useEditEvent(eventId);
  const remove = useDeleteEvent(eventId);
  const removal = useRemoveResponse(eventId);
  const make = useMakeItineraries(eventId);
  const answers = useAnswersLink(eventId);
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<Detail>("parts");
  // Closed, or open for a new question or for one to change.
  const [editor, setEditor] = useState<{ question?: Question }>();
  const [titleDraft, setTitleDraft] = useState<string>();
  const [titleError, setTitleError] = useState<string>();
  const [copied, setCopied] = useState<"copied" | "failed">();
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  const [dragging, setDragging] = useState(false);

  const view = event.data;
  const isOrganizer = view?.isOrganizer ?? false;
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const headerStyle = [styles.header, { marginTop: insets.top - space.sm }];

  if (!view || isRefusal(event.error))
    return (
      <Screen onRefresh={event.refetch}>
        <View style={headerStyle}>
          <RoundButton icon="arrow-left" label="Back" onPress={back} />
        </View>
        {event.isError ? (
          <ErrorState
            message={event.error.message}
            onRetry={() => event.refetch()}
          />
        ) : (
          <ActivityIndicator />
        )}
      </Screen>
    );

  // An edit shows at once; the server's answer replaces it.
  const pending = edit.isPending ? edit.variables : undefined;
  const title = pending?.title ?? view.event.title;
  const questions = pending?.questions ?? view.event.questions;
  const { windowStart, windowEnd } = view.event;
  const ended = hasEnded(windowEnd);
  const editingTitle = titleDraft !== undefined;
  const inPeople = view.responses.filter((r) => r.attending);
  const answered = inPeople.filter((r) => r.answered).length;
  const days = daysBetween(windowStart, windowEnd) + 1;
  const me = view.responses.find((r) => r.you);
  const tone = eventTone(view.event.id);
  const url = view.event.url;
  // Options need two people in and a window still open.
  const canMake = isOrganizer && inPeople.length >= 2 && !ended;
  const hasOptions = view.itineraries.length > 0;
  const kinds = allKinds.filter(
    (kind) =>
      (kind !== "dates" && kind !== "budget") ||
      !questions.some((q) => q.kind === kind),
  );

  function save(next: { title?: string; questions?: Question[] }) {
    edit.mutate({
      title: next.title ?? title,
      questions: next.questions ?? questions,
    });
  }

  function saveTitle() {
    const parsed = EventTitle.safeParse(titleDraft);
    setTitleError(parsed.success ? undefined : parsed.error.issues[0]?.message);
    if (!parsed.success) return;
    setTitleDraft(undefined);
    if (parsed.data !== title) save({ title: parsed.data });
  }

  function cancelTitle() {
    setTitleDraft(undefined);
    setTitleError(undefined);
  }

  async function copy() {
    setCopied(await copyText(url));
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(undefined), 2500);
  }

  function openAnswers() {
    answers.mutate(undefined, {
      onSuccess: ({ url }) => void Linking.openURL(url),
    });
  }

  function deleteEvent() {
    confirmDestructive(
      "Delete event",
      "This removes it for everyone.",
      "Delete",
      () =>
        remove.mutate(undefined, { onSuccess: () => router.dismissTo("/") }),
    );
  }

  function removePerson(response: ResponseView) {
    if (removal.isPending) return;
    confirmDestructive(
      `Remove ${response.name}`,
      "Their answers go too. They can answer again from the link.",
      "Remove",
      () => removal.mutate(response.id),
    );
  }

  function removeQuestion(question: Question) {
    confirmDestructive(
      "Remove question",
      "Answers to it go too.",
      "Remove",
      () => save({ questions: questions.filter((q) => q.id !== question.id) }),
    );
  }

  function menu() {
    if (Platform.OS !== "ios") return deleteEvent();
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["Cancel", "Delete event"],
        cancelButtonIndex: 0,
        destructiveButtonIndex: 1,
      },
      (index) => {
        if (index === 1) deleteEvent();
      },
    );
  }

  // What the copy pill says: the link is on the clipboard, or it is not.
  const copyTitle =
    copied === "copied"
      ? "Copied"
      : copied === "failed"
        ? "Couldn't copy"
        : "Copy invite link";

  // The one thing to do next, for whoever is looking: nothing once the
  // window has passed, and nothing while the title is being edited, so Save
  // is the screen's one primary. Options read "Update" once answers have
  // changed under them, and "Make new" when they are current.
  const footerButton =
    ended || editingTitle ? null : isOrganizer ? (
      canMake ? (
        <Button
          title={
            !hasOptions
              ? "Make itinerary options"
              : view.stale
                ? "Update options"
                : "Make new options"
          }
          onPress={() => make.mutate({ detail })}
          loading={make.isPending}
        />
      ) : (
        <Button
          title={copyTitle}
          icon={copied === "copied" ? "check" : "link"}
          onPress={() => void copy()}
        />
      )
    ) : me && (questions.length > 0 || !me.attending) ? (
      <Button
        title={answersTitle(me)}
        onPress={openAnswers}
        loading={answers.isPending}
      />
    ) : null;
  const footerError = isOrganizer
    ? make.error?.message
    : answers.error?.message;
  // The footer carries Copy invite link until options can be made; the
  // panel offers it only once the footer has moved on, or is away.
  const copyInFooter = isOrganizer && !canMake && !ended && !editingTitle;
  // Answers to give or change: not once the window has passed, and not
  // when there is nothing to ask.
  const askable = !ended && questions.length > 0;

  return (
    <Screen
      onRefresh={event.refetch}
      scrollEnabled={!dragging}
      footer={
        footerButton ? (
          <View style={styles.footer}>
            {footerError ? <Text color="danger">{footerError}</Text> : null}
            {footerButton}
          </View>
        ) : undefined
      }
    >
      <View style={headerStyle}>
        <RoundButton icon="arrow-left" label="Back" onPress={back} />
        {isOrganizer && !editingTitle ? (
          <View style={styles.row}>
            {ended ? null : (
              <RoundButton
                icon="pencil"
                label="Edit title"
                onPress={() => setTitleDraft(title)}
              />
            )}
            <RoundButton icon="ellipsis" label="More" onPress={menu} />
          </View>
        ) : null}
      </View>

      <View style={styles.hero}>
        <View style={styles.titleBlock}>
          <View style={styles.kicker}>
            <View style={[styles.kickerDot, { backgroundColor: tone.fill }]} />
            <Text color="textMuted" variant="section" style={styles.grow}>
              {approxRange(windowStart, windowEnd, true)}
            </Text>
            {ended ? (
              <Text color="textMuted" variant="section">
                Ended
              </Text>
            ) : null}
          </View>
          {editingTitle ? (
            <View style={styles.titleEdit}>
              <Field
                accessibilityLabel="Title"
                value={titleDraft}
                onChangeText={setTitleDraft}
                error={titleError}
                autoFocus
                multiline
                submitBehavior="submit"
                maxLength={60}
                returnKeyType="done"
                onSubmitEditing={saveTitle}
              />
              <View style={styles.row}>
                <Button title="Save" size="small" onPress={saveTitle} />
                <Button
                  title="Cancel"
                  size="small"
                  variant="ghost"
                  onPress={cancelTitle}
                />
              </View>
            </View>
          ) : (
            <Text
              variant="display"
              accessibilityRole="header"
              numberOfLines={3}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {title}
            </Text>
          )}
        </View>
        <View style={styles.facts}>
          <View style={styles.heroMeta}>
            <Stat value={inPeople.length} label="in" />
            <Stat value={answered} label="answered" />
            <Stat value={days} label={days === 1 ? "day" : "days"} />
            <View style={styles.grow} />
            {inPeople.length ? (
              <AvatarStack
                members={inPeople.map((r) => ({
                  id: r.id,
                  name: r.name,
                  color: colorFor(r.name),
                }))}
                size={30}
                max={4}
              />
            ) : null}
          </View>
          <Text color="textMuted">
            {isOrganizer
              ? "You're organizing"
              : `${view.organizer.name} is organizing`}
          </Text>
          {remove.error ? (
            <Text color="danger">{remove.error.message}</Text>
          ) : null}
          {edit.error ? <Text color="danger">{edit.error.message}</Text> : null}
        </View>
      </View>

      {ended ? null : (
        <Section title="Invite">
          <Card panel style={styles.invite}>
            <Text numberOfLines={1} ellipsizeMode="middle" style={styles.grow}>
              {url.replace(/^https?:\/\//, "")}
            </Text>
            {copyInFooter ? null : (
              <Button
                title={copyTitle}
                icon={copied === "copied" ? "check" : undefined}
                variant="secondary"
                size="small"
                onPress={() => void copy()}
              />
            )}
          </Card>
        </Section>
      )}

      {isOrganizer && !ended ? (
        <Section title="Questions">
          <QuestionList
            questions={questions}
            onEdit={(question) => setEditor({ question })}
            onRemove={removeQuestion}
            onMove={(from, to) =>
              save({ questions: moveItem(questions, from, to) })
            }
            onDragging={setDragging}
            onAdd={
              questions.length < maxQuestions ? () => setEditor({}) : undefined
            }
          />
        </Section>
      ) : null}

      <WhoIsIn
        responses={view.responses}
        questions={view.event.questions}
        isOrganizer={isOrganizer}
        onAnswers={askable ? openAnswers : undefined}
        answersPending={answers.isPending}
        onRemove={isOrganizer && !ended ? removePerson : undefined}
        error={
          isOrganizer
            ? (answers.error?.message ?? removal.error?.message)
            : undefined
        }
      />

      {hasOptions || canMake || !isOrganizer ? (
        <Itineraries
          itineraries={view.itineraries}
          detail={canMake ? { value: detail, onChange: setDetail } : undefined}
          tone={tone}
        />
      ) : null}

      {editor ? (
        <QuestionEditor
          question={editor.question}
          kinds={kinds}
          onClose={() => setEditor(undefined)}
          onSave={(question) => {
            setEditor(undefined);
            save({
              questions: editor.question
                ? questions.map((q) => (q.id === question.id ? question : q))
                : [...questions, question],
            });
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hero: { gap: space.xl },
  // The kicker keeps its own gap from the title.
  titleBlock: { gap: space.md },
  kicker: { flexDirection: "row", alignItems: "center", gap: space.sm },
  kickerDot: { width: 12, height: 12, borderRadius: radius.full },
  titleEdit: { gap: space.sm },
  row: { flexDirection: "row", gap: space.sm },
  facts: { gap: space.md },
  heroMeta: { flexDirection: "row", alignItems: "flex-end", gap: space.xl },
  grow: { flex: 1 },
  invite: { flexDirection: "row", alignItems: "center", gap: space.md },
  footer: { flex: 1, gap: space.sm },
});
