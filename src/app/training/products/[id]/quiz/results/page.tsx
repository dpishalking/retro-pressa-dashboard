import { QuizResults } from "@/components/training/quiz-results";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attemptId?: string }>;
};

export default async function TrainingQuizResultsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { attemptId = "" } = await searchParams;
  return <QuizResults productId={id} attemptId={attemptId} />;
}
