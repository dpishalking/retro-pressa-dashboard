import { TrainingModuleDetail } from "@/components/training/training-module-detail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TrainingCrmModulePage({ params }: PageProps) {
  const { id } = await params;
  return <TrainingModuleDetail stageId="crm" moduleId={id} />;
}
