import { areaById, planActions, type OptionView } from "@circles/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  isRefusal,
  useDeletePlan,
  useGenerateOptions,
  useLock,
  usePlan,
  useSaveRegistration,
  useUnlock,
  useVote,
} from "../../../../../api";
import { confirmAction } from "../../../../../confirm";
import {
  formatInterval,
  formatStart,
  formatWindow,
  useNow,
} from "../../../../../dates";
import {
  Options,
  upcomingTimes,
  type TimeSlot,
} from "../../../../../plan/Options";
import { Pulse } from "../../../../../plan/Pulse";
import { Avatar } from "../../../../../ui/Avatar";
import { Button } from "../../../../../ui/Button";
import { Card } from "../../../../../ui/Card";
import { ErrorState } from "../../../../../ui/ErrorState";
import { IconButton } from "../../../../../ui/IconButton";
import { ListRow } from "../../../../../ui/ListRow";
import { Screen } from "../../../../../ui/Screen";
import { MetaItem, ScreenTitle } from "../../../../../ui/ScreenTitle";
import { Section } from "../../../../../ui/Section";
import { StatusBadge } from "../../../../../ui/StatusBadge";
import { Text } from "../../../../../ui/Text";
import { space } from "../../../../../ui/theme";

// The chosen slot; otherwise the first upcoming time of the option with the
// most votes, best rank first.
function selectedSlot(options: OptionView[], now: number, selected?: TimeSlot) {
  const upcoming = options.filter((o) => upcomingTimes(o, now).length > 0);
  const leader = [...upcoming].sort((a, b) => b.votes - a.votes)[0];
  const option = upcoming.find((o) => o.id === selected?.optionId) ?? leader;
  const times = option ? upcomingTimes(option, now) : [];
  const time = times.find((t) => t.start === selected?.start) ?? times[0];
  return option && time ? { option, time } : undefined;
}

export default function Plan() {
  const { circleId, planId } = useLocalSearchParams<{
    circleId: string;
    planId: string;
  }>();
  const plan = usePlan(circleId, planId);
  const generate = useGenerateOptions(circleId, planId);
  const vote = useVote(circleId, planId);
  const lock = useLock(circleId, planId);
  const unlock = useUnlock(circleId, planId);
  const save = useSaveRegistration(circleId, planId);
  const remove = useDeletePlan(circleId, planId);
  const [selected, setSelected] = useState<TimeSlot>();
  const now = useNow();
  const view = plan.data;
  const registration = view?.me.registration;

  const options = view ? [...view.options].sort((a, b) => a.rank - b.rank) : [];
  const actions = view && planActions(view);
  const phase = view?.plan.phase;
  const locked = phase?.kind === "locked" || phase?.kind === "past";
  const generateTitle =
    actions?.getOptions === "first"
      ? "Get options"
      : actions?.getOptions === "new"
        ? "Get new options"
        : false;
  const slot = selectedSlot(options, now, selected);
  const timezone = view ? areaById(view.plan.area.id).timezone : undefined;
  const chosen = options.find((o) => o.id === view?.plan.locked?.optionId);

  function lockIn() {
    if (!slot || !timezone) return;
    confirmAction(
      "Lock it in",
      `${slot.option.place.name}\n${formatInterval(slot.time, timezone)}`,
      "Lock in",
      () => lock.mutate({ optionId: slot.option.id, start: slot.time.start }),
    );
  }

  function unlockPlan() {
    if (unlock.isPending) return;
    confirmAction(
      "Unlock",
      "Votes stay. Anyone can change their budget and times again.",
      "Unlock",
      () => unlock.mutate(),
    );
  }

  function deletePlan() {
    if (!view) return;
    confirmAction(
      "Delete plan",
      `This removes it for everyone in ${view.plan.circle.name}.`,
      "Delete",
      () =>
        remove.mutate(undefined, {
          onSuccess: () => router.dismissTo(`/circles/${circleId}`),
        }),
      true,
    );
  }

  function getOptions() {
    // A fresh set makes an earlier lock or vote refusal moot.
    const run = () =>
      generate.mutate(undefined, {
        onSuccess: () => {
          lock.reset();
          vote.reset();
        },
      });
    if (options.some((o) => o.votes > 0)) {
      confirmAction(
        "Get new options",
        "Current votes will be cleared.",
        "Get new options",
        run,
      );
      return;
    }
    run();
  }

  function toInputs() {
    router.push(`/circles/${circleId}/plans/${planId}/register`);
  }

  function decline() {
    if (!view) return;
    // Keep what was entered, in case they change their mind.
    const run = () =>
      save.mutate({
        attending: false,
        budgetCents: registration?.budgetCents,
        busy: registration?.busy ?? [],
        preferences: registration?.preferences ?? view.me.defaults.preferences,
      });
    // Only someone who was in changes the options by stepping out.
    if (registration?.attending && options.length > 0)
      confirmAction(
        "Can't make it",
        "Current options will need a refresh, which clears votes.",
        "Can't make it",
        run,
      );
    else run();
  }

  const actionError = generate.error?.message ?? lock.error?.message;
  const footer =
    generateTitle || actions?.lock ? (
      <View style={styles.footer}>
        {actionError ? <Text color="danger">{actionError}</Text> : null}
        {generateTitle ? (
          <Button
            title={generate.isPending ? "Finding options" : generateTitle}
            variant={actions?.lock && !actions.stale ? "secondary" : "primary"}
            icon="zap"
            onPress={getOptions}
            loading={generate.isPending}
          />
        ) : null}
        {actions?.lock ? (
          <Button
            title={
              slot && timezone
                ? `Lock in ${slot.option.place.name} on ${formatStart(slot.time.start, timezone)}`
                : "Lock it in"
            }
            icon="lock"
            onPress={lockIn}
            loading={lock.isPending}
            disabled={!slot || actions.stale}
          />
        ) : null}
      </View>
    ) : undefined;

  if (!plan.data || isRefusal(plan.error))
    return (
      <Screen>
        {plan.isError ? (
          <ErrorState
            message={plan.error.message}
            onRetry={() => plan.refetch()}
          />
        ) : (
          <ActivityIndicator />
        )}
      </Screen>
    );

  const whoIsIn = (
    <Section title="Who's in">
      <Card list>
        {plan.data.members.map((member) => (
          <ListRow
            key={member.id}
            accessibilityLabel={`${member.name}${
              member.id === plan.data.me.id ? " (you)" : ""
            }, ${
              !member.registered
                ? "not answered"
                : member.attending
                  ? "in"
                  : "can't make it"
            }`}
            subtitle={
              member.registered && !member.attending
                ? "Can't make it"
                : undefined
            }
            lead={
              <Avatar
                name={member.name}
                color={member.color}
                outlined={!member.registered}
              />
            }
            title={member.name}
            trailing={member.id === plan.data.me.id ? "You" : undefined}
          />
        ))}
      </Card>
    </Section>
  );
  const optionsSection = (
    <Options
      view={plan.data}
      options={options}
      selection={
        actions?.lock && !actions.stale && slot
          ? { optionId: slot.option.id, start: slot.time.start }
          : undefined
      }
      onSelectTime={actions?.lock && !actions.stale ? setSelected : undefined}
      onVote={
        actions?.vote ? (optionId) => vote.mutate({ optionId }) : undefined
      }
      votingId={vote.isPending ? vote.variables.optionId : undefined}
      generating={generate.isPending}
      error={vote.error?.message ?? unlock.error?.message}
    />
  );
  return (
    <Screen footer={footer} onRefresh={plan.refetch}>
      <ScreenTitle
        title={plan.data.plan.title}
        action={
          actions?.edit ? (
            <IconButton
              icon="pencil"
              label="Edit plan"
              onPress={() =>
                router.push(`/circles/${circleId}/plans/${planId}/edit`)
              }
            />
          ) : actions?.unlock ? (
            <IconButton icon="lock-open" label="Unlock" onPress={unlockPlan} />
          ) : undefined
        }
      >
        {chosen && plan.data.plan.locked && timezone ? (
          <>
            <MetaItem icon="map-pin" text={chosen.place.name} />
            <MetaItem
              icon="clock"
              text={formatStart(plan.data.plan.locked.start, timezone)}
            />
          </>
        ) : (
          <>
            <MetaItem icon="map-pin" text={plan.data.plan.area.name} />
            {!locked ? (
              <MetaItem
                icon="calendar"
                text={formatWindow(
                  plan.data.plan.windowStart,
                  plan.data.plan.windowEnd,
                )}
              />
            ) : null}
          </>
        )}
        <StatusBadge phase={plan.data.plan.phase} />
      </ScreenTitle>
      <Pulse view={plan.data} />
      {actions?.open ? (
        <View style={styles.block}>
          <View style={styles.actions}>
            {registration?.attending ? (
              <Button
                title="Budget and times"
                variant="secondary"
                onPress={toInputs}
                style={styles.action}
              />
            ) : (
              <Button title="I'm in" onPress={toInputs} style={styles.action} />
            )}
            {actions.decline ? (
              <Button
                title="Can't make it"
                variant="secondary"
                onPress={decline}
                loading={save.isPending}
                style={styles.action}
              />
            ) : null}
          </View>
          {save.error ? <Text color="danger">{save.error.message}</Text> : null}
        </View>
      ) : null}
      {/* Once locked, the answer comes before the roster. */}
      {locked ? optionsSection : whoIsIn}
      {locked ? whoIsIn : optionsSection}
      {actions?.initiator ? (
        <View style={styles.block}>
          <Button
            title="Delete plan"
            variant="destructive"
            onPress={deletePlan}
            loading={remove.isPending}
          />
          {remove.error ? (
            <Text color="danger">{remove.error.message}</Text>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  actions: { flexDirection: "row", gap: space.sm },
  action: { flex: 1 },
  footer: { flex: 1, gap: space.sm },
});
