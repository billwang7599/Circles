import type { EditPlan } from "@circles/shared";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator } from "react-native";
import { isRefusal, useEditPlan, usePlan } from "../../../../../api";
import { confirmAction } from "../../../../../confirm";
import { PlanForm } from "../../../../../plan/PlanForm";
import { ErrorState } from "../../../../../ui/ErrorState";
import { Screen } from "../../../../../ui/Screen";

export default function Edit() {
  const { circleId, planId } = useLocalSearchParams<{
    circleId: string;
    planId: string;
  }>();
  const plan = usePlan(circleId, planId);
  const edit = useEditPlan(circleId, planId);

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

  const { title, area, windowStart, windowEnd, parts } = plan.data.plan;
  const hasOptions = plan.data.options.length > 0;

  function save(values: EditPlan) {
    const moved =
      values.areaId !== area.id ||
      values.windowStart !== windowStart ||
      values.windowEnd !== windowEnd ||
      values.parts.join() !== parts.join();
    if (!moved && values.title === title) {
      router.back();
      return;
    }
    const run = () => edit.mutate(values, { onSuccess: () => router.back() });
    if (hasOptions)
      confirmAction(
        "Save changes",
        moved
          ? "Current options and votes will be cleared."
          : "Current options will need a refresh, which clears votes.",
        "Save",
        run,
      );
    else run();
  }

  return (
    <PlanForm
      heading="Edit plan"
      initial={{ title, areaId: area.id, windowStart, windowEnd, parts }}
      submitTitle="Save"
      pending={edit.isPending}
      error={edit.error?.message}
      onSubmit={save}
    />
  );
}
