import { AREAS, Part, presetWindow } from "@circles/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useCreatePlan } from "../../../../api";
import { PlanForm } from "../../../../plan/PlanForm";

export default function NewPlan() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const create = useCreatePlan(circleId);
  const [initial] = useState(() => ({
    title: "",
    areaId: AREAS[0].id,
    ...presetWindow("week", AREAS[0].timezone, new Date()),
    parts: Part.options,
  }));
  return (
    <PlanForm
      heading="New plan"
      initial={initial}
      submitTitle="Start plan"
      pending={create.isPending}
      error={create.error?.message}
      onSubmit={(values) =>
        create.mutate(values, {
          onSuccess: ({ plan }) =>
            router.replace(`/circles/${circleId}/plans/${plan.id}/register`),
        })
      }
    />
  );
}
