import { TrainingModuleVideo } from "@/components/training/training-module-video";

type PageProps = {
  params: Promise<{ id: string; videoId: string }>;
};

export default async function TrainingCrmVideoPage({ params }: PageProps) {
  const { id, videoId } = await params;
  return <TrainingModuleVideo stageId="crm" moduleId={id} videoId={videoId} />;
}
