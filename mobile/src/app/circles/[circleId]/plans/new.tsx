import { AREAS } from "@circles/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useCreatePlan } from "../../../../api";
import { PlanForm } from "../../../../plan/PlanForm";
import { Screen } from "../../../../ui/Screen";

export default function NewPlan() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const create = useCreatePlan(circleId);
  return (
    <Screen>
      <PlanForm
        initial={{ title: "", areaId: AREAS[0].id, when: "week" }}
        submitTitle="Start plan"
        pending={create.isPending}
        error={create.error?.message}
        onSubmit={(values) =>
          create.mutate(
            { ...values, when: values.when ?? "week" },
            {
              onSuccess: ({ plan }) =>
                router.replace(
                  `/circles/${circleId}/plans/${plan.id}/register`,
                ),
            },
          )
        }
      />
    </Screen>
  );
}
