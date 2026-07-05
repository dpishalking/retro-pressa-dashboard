import { TrainingPracticeBotChat } from "@/components/training/training-practice-bot-chat";

type PageProps = {
  params: Promise<{ scenarioId: string }>;
};

export default async function TrainingPracticeBotScenarioPage({ params }: PageProps) {
  const { scenarioId } = await params;
  return <TrainingPracticeBotChat scenarioId={scenarioId} />;
}
