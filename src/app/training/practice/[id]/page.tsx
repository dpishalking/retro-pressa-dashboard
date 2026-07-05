import { TrainingModuleDetail } from "@/components/training/training-module-detail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TrainingPracticeModulePage({ params }: PageProps) {
  const { id } = await params;
  return <TrainingModuleDetail stageId="practice" moduleId={id} />;
}
