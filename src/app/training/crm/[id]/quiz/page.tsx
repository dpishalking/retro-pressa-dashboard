import { TrackQuizForm } from "@/components/training/track-quiz-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TrainingCrmQuizPage({ params }: PageProps) {
  const { id } = await params;
  return <TrackQuizForm stageId="crm" moduleId={id} />;
}
