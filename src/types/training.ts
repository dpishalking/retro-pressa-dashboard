export type UserRole = "manager" | "admin";

export type TrainingStatus = "not_started" | "in_progress" | "completed";

export type MaterialType = "image" | "video" | "document" | "link" | "text";

export type QuestionType = "single" | "multiple" | "text";

export type ProductMaterial = {
  id: string;
  type: MaterialType;
  title: string;
  url?: string;
  embedUrl?: string;
  content?: string;
  sortOrder: number;
};

export type QuizAnswer = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type QuizQuestion = {
  id: string;
  text: string;
  type: QuestionType;
  answers: QuizAnswer[];
  sortOrder: number;
};

export type ProductTrainingModule = {
  id: string;
  title: string;
  shortDescription: string;
  coverImage: string;
  passingScore: number;
  description: string;
  targetAudience: string;
  clientProblems: string;
  emotions: string;
  purchaseReasons: string;
  objections: string;
  presentationGuide: string;
  materials: ProductMaterial[];
  questions: QuizQuestion[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type QuizAttemptAnswer = {
  questionId: string;
  selectedAnswerIds?: string[];
  textAnswer?: string;
  isCorrect: boolean;
};

export type UserQuizAttempt = {
  id: string;
  productId: string;
  userId: string;
  answers: QuizAttemptAnswer[];
  scorePercent: number;
  passed: boolean;
  attemptedAt: string;
};

export type ProductProgress = {
  productId: string;
  status: TrainingStatus;
  startedAt?: string;
  completedAt?: string;
  lastAttemptAt?: string;
  bestScorePercent?: number;
  attemptCount: number;
};

export type UserTrainingProgress = {
  userId: string;
  userName: string;
  products: ProductProgress[];
  attempts: UserQuizAttempt[];
};

export type TrainingUser = {
  id: string;
  name: string;
  role: UserRole;
};

export type QuizSubmission = {
  productId: string;
  userId: string;
  answers: {
    questionId: string;
    selectedAnswerIds?: string[];
    textAnswer?: string;
  }[];
};

export type QuizResult = {
  attempt: UserQuizAttempt;
  questions: {
    question: QuizQuestion;
    userAnswer: QuizAttemptAnswer;
  }[];
};

export type TrainingOverview = {
  totalProducts: number;
  completedProducts: number;
  inProgressProducts: number;
  notStartedProducts: number;
  overallPercent: number;
  passedTests: number;
  remainingProductIds: string[];
};
