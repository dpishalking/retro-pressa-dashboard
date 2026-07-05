import { TrackQuizForm } from "@/components/training/track-quiz-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TrainingPracticeQuizPage({ params }: PageProps) {
  const { id } = await params;
  return <TrackQuizForm stageId="practice" moduleId={id} />;
}
