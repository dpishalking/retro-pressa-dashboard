export type Status = "green" | "orange" | "red";

export type PeriodKey = "may-2026" | "june-2026" | "july-2026";

export type MonthlyMetrics = {
  month: PeriodKey;
  paidLeads: number;
  organicLeads: number;
  qualifiedLeads: number;
  invoicesCount: number;
  invoicesAmount: number;
  cancelledInvoicesCount: number;
  cancelledInvoicesAmount: number;
  salesCount: number;
  revenue: number;
  adSpend: number;
  paidSalesCount: number | null;
  workingDays: number;
  calendarDays: number;
};

export type CountryInvoiceMetrics = {
  country: string;
  invoicesCount: number;
  invoicesAmount: number;
  salesCount: number;
  revenue: number;
};

export type DialogueQualityMetrics = {
  month: PeriodKey;
  targetDialogs: number;
  meaningfulDialogs: number;
  medianResponseMinutes: number;
  responseUnder5MinutesPct: number;
  responseOver60MinutesPct: number;
  recipientQualificationPct: number;
  deliveryDeadlineQualificationPct: number;
  personalRecommendationPct: number;
  visualContentPct: number;
  shippingPriceMentionPct: number;
  fullFinalPricePct: number;
  directClosingQuestionPct: number;
  extendedOfferPct: number;
  checkoutMarkerPct: number;
  paymentMarkerPct: number;
};

export type MarketMetrics = {
  period: PeriodKey;
  market: string;
  paidLeads: number;
  organicLeads: number;
  sales: number;
  revenue: number;
  adSpend: number;
  invoicesCount: number;
  invoicesAmount: number;
  averagePaidCheck: number;
  targetRevenue: number;
  targetCpl: number;
  targetConversion: number;
  targetAverageCheck: number;
};

export type ManagerMetrics = {
  period: PeriodKey;
  managerId: string;
  manager: string;
  newLeads: number;
  recentClientsLast10Days: number;
  lastClientAt: string | null;
  meaningfulDialogs: number;
  invoicesCount: number;
  sales: number;
  revenue: number;
  medianResponseMinutes: number;
  responseUnder5MinutesPct: number;
  recipientQualificationPct: number;
  personalRecommendationPct: number;
  visualContentPct: number;
  fullFinalPricePct: number;
  directClosingQuestionPct: number;
};

export type DailyMetrics = {
  date: string;
  paidLeads: number;
  organicLeads: number;
  qualifiedLeads: number;
  paidQualifiedLeads: number;
  organicQualifiedLeads: number;
  invoicesCount: number;
  invoicesAmount: number;
  salesCount: number;
  revenue: number;
  adSpend: number;
  averagePaidCheck: number;
  activeManagers: number;
};

export type TargetScenario = {
  targetRevenue: number;
  calendarDays: number;
  totalLeads: number;
  paidLeads: number;
  organicLeads: number;
  salesConversion: number;
  salesCount: number;
  averagePaidCheck: number;
  monthlyAdSpendMin: number;
  monthlyAdSpendMax: number;
  maxPaidCpl: number;
};

export type ConversationIntent =
  | "price_question"
  | "delivery_question"
  | "timing_question"
  | "doubt"
  | "objection"
  | "ready_to_buy"
  | "gift_recommendation_request"
  | "lost_interest"
  | "payment_transition";

export type DialogueStage =
  | "first_touch"
  | "qualification"
  | "recommendation"
  | "pricing"
  | "delivery"
  | "closing"
  | "payment"
  | "follow_up"
  | "lost";

export type DialogueOutcome = "order" | "invoice" | "lost" | "in_progress" | "unknown";

export type ConversationMessage = {
  date: string | null;
  channel: string;
  dialogId: string;
  sender: string;
  senderRole: "client" | "manager" | "system" | "unknown";
  text: string;
  manager: string | null;
  stage: DialogueStage;
  outcome: DialogueOutcome;
  orderAmount: number | null;
  intents: ConversationIntent[];
};

export type DialogSummary = {
  dialogId: string;
  channel: string;
  manager: string | null;
  messageCount: number;
  startedAt: string | null;
  lastMessageAt: string | null;
  outcome: DialogueOutcome;
  orderAmount: number;
  occasion: string | null;
  averageResponseMinutes: number | null;
  hadRecommendation: boolean;
  hadConcreteGiftOffer: boolean;
  hadPriceMention: boolean;
  hadDeliveryMention: boolean;
  hadFullCalculation: boolean;
  hadDeadlineConstraint: boolean;
  hadFollowUp: boolean;
  deliveryQuestionWithoutFullAnswer: boolean;
  objections: string[];
  lossReasons: string[];
  stages: DialogueStage[];
  intents: ConversationIntent[];
};

export type ConversationFactorAnalysis = {
  factor: string;
  segment: string;
  dialogs: number;
  conversion: number;
  baselineConversion: number;
  influencePp: number;
  estimatedRevenueImpact: number;
};

export type ConversationDashboardMetrics = {
  totalDialogs: number;
  sampleReliability: "demo" | "small" | "directional" | "reliable";
  minimumReliableDialogs: number;
  orderConversion: number;
  conversionByChannel: Array<{ channel: string; dialogs: number; orders: number; conversion: number }>;
  topObjections: Array<{ name: string; count: number }>;
  topLossReasons: Array<{ name: string; count: number }>;
  bestSalesScenarios: Array<{ name: string; dialogs: number; conversion: number; averageOrder: number }>;
  worstDialoguePoints: Array<{ name: string; count: number; lostRevenue: number }>;
  potentialLostRevenue: number;
  recommendationMissingShare: number;
  deliveryRiskShare: number;
  qualityScore: number;
  factors: ConversationFactorAnalysis[];
};

export type ConversationImportFileDiagnostic = {
  filename: string;
  messages: number;
  dialogs: number;
  status: "ok" | "error";
  note: string;
};

export type GeminiDialogueAnalysis = {
  dialogId: string;
  qualityScore: number;
  outcome: DialogueOutcome;
  summary: string;
  managerStrengths: string[];
  missedOpportunities: string[];
  lossReason: string | null;
  recommendedNextAction: string;
  needsHumanReview: boolean;
};

export type GeminiConversationSummary = {
  model: string;
  requestedDialogs: number;
  analyzedDialogs: number;
  cachedDialogs: number;
  newDialogs: number;
  averageQualityScore: number;
  needsHumanReview: number;
  topMissedOpportunities: Array<{ name: string; count: number }>;
  topLossReasons: Array<{ name: string; count: number }>;
  sample: GeminiDialogueAnalysis[];
};
