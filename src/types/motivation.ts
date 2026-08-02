export type MotivationPeriodStatus =
  | "draft"
  | "active"
  | "calculating"
  | "closed"
  | "archive";

export type MotivationRuleType =
  | "numeric_target"
  | "team_best"
  | "personal_plan"
  | "action_series"
  | "manual_confirm"
  | "fixed_bonus"
  | "percent_bonus";

export type MotivationRewardType = "fixed" | "percent" | "manual";

export type MotivationResultStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "pending_confirmation"
  | "rewarded"
  | "failed";

export type ReviewSubmissionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "needs_clarification";

export type MonthlyUpdateCategory =
  | "new_tool"
  | "new_landing"
  | "new_product"
  | "price_change"
  | "new_script"
  | "new_promo"
  | "process_update"
  | "training"
  | "important";

export type MonthlyUpdateStatus = "draft" | "published" | "archive";

export type SalesResourceType =
  | "landing"
  | "quiz"
  | "script"
  | "presentation"
  | "calculator"
  | "training"
  | "other";

export type SalesResourceStatus = "active" | "testing" | "paused" | "archive";

export type MotivationNotificationType =
  | "new_rule"
  | "new_resource"
  | "review_approved"
  | "review_rejected"
  | "rule_completed"
  | "period_closed"
  | "became_leader";

export type MotivationPeriod = {
  id: string;
  title: string;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  status: MotivationPeriodStatus;
  publishedAt: string | null;
  closedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type MotivationCalculationConfig = {
  /** Count unique product names (SKUs) per order, not physical quantity. */
  uniqueLineItems?: boolean;
  minLeads?: number;
  minReviews?: number;
  targetAverageItems?: number;
  metricKey?: string;
  dataSource?: "manual" | "bitrix" | "hybrid";
  notes?: string;
};

export type MotivationRule = {
  id: string;
  periodId: string;
  title: string;
  description: string;
  ruleType: MotivationRuleType;
  rewardType: MotivationRewardType;
  rewardAmount: number;
  currency: "EUR";
  targetValue: number | null;
  minimumValue: number | null;
  calculationConfig: MotivationCalculationConfig;
  dataSource: "manual" | "bitrix" | "hybrid";
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ManagerMotivationProfile = {
  id: string;
  name: string;
  photoUrl: string | null;
  linkedAuthUserId: string | null;
  bitrixUserId: string | null;
  active: boolean;
};

/** Manual / synced metrics for a manager in a period. */
export type ManagerPeriodMetrics = {
  managerId: string;
  periodId: string;
  salesPlan: number | null;
  salesAmount: number;
  leadsCount: number;
  paidOrdersCount: number;
  /** Sum of unique line-item counts across paid orders (or adjusted total). */
  totalUniqueLineItems: number;
  conversionToPaid: number;
  averageItemsPerOrder: number;
  source: "manual" | "bitrix" | "hybrid";
  updatedAt: string;
};

export type ManagerMotivationResult = {
  id: string;
  periodId: string;
  ruleId: string;
  managerId: string;
  currentValue: number;
  targetValue: number | null;
  progressPercent: number;
  rewardAmount: number;
  status: MotivationResultStatus;
  calculatedAt: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
  comment: string | null;
  rank: number | null;
  hint: string | null;
};

export type ReviewSubmission = {
  id: string;
  periodId: string;
  managerId: string;
  customerName: string;
  orderId: string;
  orderUrl: string;
  reviewDate: string;
  reviewText: string;
  screenshotUrl: string;
  chatMessageUrl: string;
  managerComment: string;
  status: ReviewSubmissionStatus;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  /** Optional future Telegram / internal chat bridge. */
  externalChatSource: string | null;
  externalChatMessageId: string | null;
  contentFingerprint: string;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyUpdate = {
  id: string;
  periodId: string;
  category: MonthlyUpdateCategory;
  title: string;
  shortDescription: string;
  fullDescription: string;
  imageUrl: string;
  buttonLabel: string;
  buttonUrl: string;
  secondaryButtonLabel: string;
  secondaryButtonUrl: string;
  priority: number;
  isPinned: boolean;
  status: MonthlyUpdateStatus;
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type SalesResource = {
  id: string;
  title: string;
  type: SalesResourceType;
  description: string;
  usageInstructions: string;
  salesStage: string;
  url: string;
  status: SalesResourceStatus;
  owner: string;
  updatedAt: string;
  displayOrder: number;
  createdAt: string;
};

export type MetricAdjustment = {
  id: string;
  periodId: string;
  managerId: string;
  metricName: string;
  oldValue: number | string;
  newValue: number | string;
  reason: string;
  changedBy: string;
  createdAt: string;
};

export type MotivationNotification = {
  id: string;
  userId: string;
  type: MotivationNotificationType;
  title: string;
  message: string;
  periodId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type FocusProduct = {
  id: string;
  title: string;
  summary: string;
  whyNow: string;
  tip: string;
  linkLabel: string;
  linkUrl: string;
  displayOrder: number;
};

export type MotivationCatalog = {
  version: 1;
  isDemo: boolean;
  periods: MotivationPeriod[];
  rules: MotivationRule[];
  managers: ManagerMotivationProfile[];
  metrics: ManagerPeriodMetrics[];
  results: ManagerMotivationResult[];
  reviews: ReviewSubmission[];
  updates: MonthlyUpdate[];
  resources: SalesResource[];
  focusProducts: FocusProduct[];
  adjustments: MetricAdjustment[];
  notifications: MotivationNotification[];
  winners: Array<{
    periodId: string;
    ruleId: string;
    managerId: string;
    confirmedBy: string;
    confirmedAt: string;
  }>;
  updatedAt: string;
};

/** Simplified board for managers: month bonuses + focus products. */
export type MotivationBoardPayload = {
  periodTitle: string;
  periodStatus: MotivationPeriodStatus;
  intro: string;
  bonuses: Array<{
    id: string;
    title: string;
    description: string;
    rewardAmount: number;
    condition: string;
  }>;
  focusProducts: FocusProduct[];
};

export type PaidOrderInput = {
  id: string;
  managerId: string;
  status: "paid" | "unpaid" | "cancelled" | "test" | "duplicate";
  /** Product line rows; quantity is ignored when uniqueLineItems is true. */
  products: Array<{ productId: string; productName: string; quantity: number }>;
};

export type LeaderboardRow = {
  place: number;
  managerId: string;
  managerName: string;
  photoUrl: string | null;
  leadsCount: number;
  approvedReviews: number;
  reviewLeadRatio: number;
  conversionToPaid: number;
  averageItemsPerOrder: number;
  earnedBonuses: number;
  status: MotivationResultStatus | "eligible" | "not_eligible";
  isCurrentUser: boolean;
  qualifiesForReviewContest: boolean;
};

export type ManagerBonusCard = {
  rule: MotivationRule;
  result: ManagerMotivationResult | null;
  leaderValue: number | null;
  leaderName: string | null;
  gapToLeader: number | null;
};

export type ManagerMotivationSummary = {
  manager: ManagerMotivationProfile;
  metrics: ManagerPeriodMetrics;
  approvedReviews: number;
  preliminaryBonus: number;
  potentialBonus: number;
  reviewRank: number | null;
  reviewsToNextBonus: number | null;
  placeInTeam: number | null;
};

export type MotivationPagePayload = {
  period: MotivationPeriod | null;
  periods: Array<Pick<MotivationPeriod, "id" | "title" | "month" | "year" | "status">>;
  canEdit: boolean;
  canSeeFullLeaderboard: boolean;
  isClosedForEditing: boolean;
  summary: ManagerMotivationSummary | null;
  bonusCards: ManagerBonusCard[];
  leaderboard: LeaderboardRow[];
  updates: MonthlyUpdate[];
  resources: SalesResource[];
  myReviews: ReviewSubmission[];
  pendingReviews: ReviewSubmission[];
  notifications: MotivationNotification[];
  history: Array<{
    period: MotivationPeriod;
    summary: ManagerMotivationSummary | null;
    results: ManagerMotivationResult[];
  }>;
  adjustments: MetricAdjustment[];
  managers: ManagerMotivationProfile[];
  rules: MotivationRule[];
};
