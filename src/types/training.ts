export type UserRole = "manager" | "admin";

export type TrainingStatus = "not_started" | "in_progress" | "completed";

export type TrainingStageId = "products" | "crm" | "practice";

export type TrackStageId = Exclude<TrainingStageId, "products">;

export type MaterialType = "image" | "video" | "document" | "link" | "text";

export type ProductSectionKey =
  | "description"
  | "targetAudience"
  | "clientProblems"
  | "emotions"
  | "purchaseReasons"
  | "objections"
  | "presentationGuide";

export type QuestionType = "single" | "multiple" | "text";

export type ProductMaterial = {
  id: string;
  type: MaterialType;
  title: string;
  url?: string;
  embedUrl?: string;
  content?: string;
  sectionKey?: ProductSectionKey;
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

export type TrainingTrackSection = {
  id: string;
  title: string;
  content: string;
  sortOrder: number;
};

export type TrainingTrackVideo = {
  id: string;
  title: string;
  goal: string;
  embedUrl?: string;
  sortOrder: number;
};

/** CRM или практика — отдельный модуль внутри этапа обучения */
export type TrainingTrackModule = {
  id: string;
  stageId: TrackStageId;
  title: string;
  shortDescription: string;
  passingScore: number;
  sortOrder: number;
  sections: TrainingTrackSection[];
  videos?: TrainingTrackVideo[];
  questions: QuizQuestion[];
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
  presentationUrl?: string;
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
  userId: string;
  productId?: string;
  moduleId?: string;
  stageId?: TrackStageId;
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

export type TrackModuleProgress = {
  moduleId: string;
  stageId: TrackStageId;
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
  modules: TrackModuleProgress[];
  attempts: UserQuizAttempt[];
};

export type TrainingUser = {
  id: string;
  name: string;
  role: UserRole;
};

export type QuizSubmission = {
  userId: string;
  productId?: string;
  moduleId?: string;
  stageId?: TrackStageId;
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

export type TrainingStageOverview = {
  id: TrainingStageId;
  title: string;
  description: string;
  href: string;
  totalModules: number;
  completedModules: number;
  inProgressModules: number;
  percent: number;
  status: TrainingStatus;
};

export type TrainingOverview = {
  totalProducts: number;
  completedProducts: number;
  inProgressProducts: number;
  notStartedProducts: number;
  overallPercent: number;
  passedTests: number;
  remainingProductIds: string[];
  stages: TrainingStageOverview[];
  totalStagesPercent: number;
};
