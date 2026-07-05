import { QuizForm } from "@/components/training/quiz-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TrainingQuizPage({ params }: PageProps) {
  const { id } = await params;
  return <QuizForm productId={id} />;
}
