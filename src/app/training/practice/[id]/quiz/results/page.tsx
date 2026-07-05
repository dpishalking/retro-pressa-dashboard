import { TrackQuizResults } from "@/components/training/track-quiz-results";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attemptId?: string }>;
};

export default async function TrainingPracticeQuizResultsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { attemptId = "" } = await searchParams;
  return <TrackQuizResults stageId="practice" moduleId={id} attemptId={attemptId} />;
}
