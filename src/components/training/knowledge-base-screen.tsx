"use client";

import { HUB_PATH } from "@/lib/auth/routes";
import { TrainingLayout } from "@/components/training/training-layout";
import { KnowledgeBase } from "@/components/training/knowledge-base";

export function KnowledgeBaseScreen() {
  return (
    <TrainingLayout title="База знаний" backHref={HUB_PATH} backLabel="К рабочему кабинету">
      <KnowledgeBase />
    </TrainingLayout>
  );
}
