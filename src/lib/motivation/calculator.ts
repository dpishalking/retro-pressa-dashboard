import type {
  LeaderboardRow,
  ManagerMotivationProfile,
  ManagerMotivationResult,
  ManagerPeriodMetrics,
  MotivationCalculationConfig,
  MotivationResultStatus,
  MotivationRule,
  PaidOrderInput,
  ReviewSubmission
} from "@/types/motivation";

export function countUniqueLineItems(
  products: Array<{ productId: string; productName: string; quantity: number }>,
  uniqueLineItems = true
): number {
  if (!uniqueLineItems) {
    return products.reduce((sum, row) => sum + Math.max(0, row.quantity || 0), 0);
  }

  const keys = new Set<string>();
  for (const row of products) {
    const key = (row.productId || row.productName || "").trim().toLowerCase();
    if (key) keys.add(key);
  }
  return keys.size;
}

export function isEligiblePaidOrder(order: PaidOrderInput): boolean {
  return order.status === "paid";
}

export function calculateAverageItemsPerOrder(
  orders: PaidOrderInput[],
  config: MotivationCalculationConfig = {}
): { average: number; paidOrdersCount: number; totalUniqueLineItems: number } {
  const uniqueLineItems = config.uniqueLineItems !== false;
  const paid = orders.filter(isEligiblePaidOrder);
  const totalUniqueLineItems = paid.reduce(
    (sum, order) => sum + countUniqueLineItems(order.products, uniqueLineItems),
    0
  );
  const paidOrdersCount = paid.length;
  const average = paidOrdersCount > 0 ? totalUniqueLineItems / paidOrdersCount : 0;
  return { average, paidOrdersCount, totalUniqueLineItems };
}

export function itemsNeededToReachAverage(
  currentTotalItems: number,
  currentOrders: number,
  targetAverage: number
): number {
  if (currentOrders <= 0) return 0;
  if (targetAverage <= 0) return 0;
  const neededTotal = Math.ceil(targetAverage * currentOrders - 1e-9);
  return Math.max(0, neededTotal - currentTotalItems);
}

export function calculateReviewLeadRatio(approvedReviews: number, leadsCount: number): number {
  if (leadsCount <= 0) return 0;
  return (approvedReviews / leadsCount) * 100;
}

export function qualifiesForReviewContest(
  leadsCount: number,
  approvedReviews: number,
  config: MotivationCalculationConfig
): boolean {
  const minLeads = config.minLeads ?? 50;
  const minReviews = config.minReviews ?? 3;
  return leadsCount >= minLeads && approvedReviews >= minReviews;
}

export type ReviewContestCandidate = {
  managerId: string;
  approvedReviews: number;
  leadsCount: number;
  conversionToPaid: number;
  paidAmount: number;
  ratio: number;
};

export function compareReviewContestCandidates(a: ReviewContestCandidate, b: ReviewContestCandidate): number {
  if (b.ratio !== a.ratio) return b.ratio - a.ratio;
  if (b.approvedReviews !== a.approvedReviews) return b.approvedReviews - a.approvedReviews;
  if (b.conversionToPaid !== a.conversionToPaid) return b.conversionToPaid - a.conversionToPaid;
  if (b.paidAmount !== a.paidAmount) return b.paidAmount - a.paidAmount;
  return a.managerId.localeCompare(b.managerId);
}

export function determineReviewWinner(candidates: ReviewContestCandidate[]): string | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort(compareReviewContestCandidates);
  return sorted[0]?.managerId ?? null;
}

export function progressPercent(current: number, target: number | null): number {
  if (target == null || target <= 0) return current > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, (current / target) * 100));
}

export function numericTargetStatus(
  current: number,
  target: number,
  rewarded: boolean
): MotivationResultStatus {
  if (rewarded) return "rewarded";
  if (current <= 0) return "not_started";
  if (current + 1e-9 >= target) return "completed";
  return "in_progress";
}

export function rewardForNumericTarget(
  current: number,
  target: number,
  rewardAmount: number
): number {
  return current + 1e-9 >= target ? rewardAmount : 0;
}

export function buildContentFingerprint(input: {
  customerName: string;
  orderId: string;
  reviewText: string;
  screenshotUrl: string;
}): string {
  const normalized = [
    input.customerName.trim().toLowerCase(),
    input.orderId.trim().toLowerCase(),
    input.reviewText.trim().toLowerCase().replace(/\s+/g, " "),
    input.screenshotUrl.trim().toLowerCase()
  ].join("|");
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return `fp_${hash.toString(16)}`;
}

export function countApprovedReviews(
  reviews: ReviewSubmission[],
  managerId: string,
  periodId: string
): number {
  const seen = new Set<string>();
  let count = 0;
  for (const review of reviews) {
    if (review.managerId !== managerId || review.periodId !== periodId) continue;
    if (review.status !== "approved") continue;
    if (seen.has(review.contentFingerprint)) continue;
    seen.add(review.contentFingerprint);
    count += 1;
  }
  return count;
}

export function calculateRuleProgress(input: {
  rule: MotivationRule;
  metrics: ManagerPeriodMetrics;
  approvedReviews: number;
  isWinner?: boolean;
  rewarded?: boolean;
}): {
  currentValue: number;
  targetValue: number | null;
  progressPercent: number;
  rewardAmount: number;
  status: MotivationResultStatus;
  hint: string | null;
  rank: number | null;
} {
  const { rule, metrics, approvedReviews } = input;

  if (rule.ruleType === "numeric_target" && rule.calculationConfig.metricKey === "average_items_per_order") {
    const target = rule.targetValue ?? rule.calculationConfig.targetAverageItems ?? 2.5;
    const current = metrics.averageItemsPerOrder;
    const needed = itemsNeededToReachAverage(
      metrics.totalUniqueLineItems,
      metrics.paidOrdersCount,
      target
    );
    const reward = rewardForNumericTarget(current, target, rule.rewardAmount);
    const status = numericTargetStatus(current, target, Boolean(input.rewarded));
    return {
      currentValue: round2(current),
      targetValue: target,
      progressPercent: progressPercent(current, target),
      rewardAmount: reward,
      status,
      hint:
        reward > 0
          ? null
          : needed > 0
            ? `Чтобы достичь цели при текущем количестве заказов, нужно добавить ещё ${needed} товарных позиций.`
            : "Добавьте оплаченные заказы, чтобы появился прогресс.",
      rank: null
    };
  }

  if (rule.ruleType === "team_best" && rule.calculationConfig.metricKey === "review_lead_ratio") {
    const ratio = calculateReviewLeadRatio(approvedReviews, metrics.leadsCount);
    const eligible = qualifiesForReviewContest(
      metrics.leadsCount,
      approvedReviews,
      rule.calculationConfig
    );
    const isWinner = Boolean(input.isWinner);
    const reward = isWinner && eligible ? rule.rewardAmount : 0;
    let status: MotivationResultStatus = "not_started";
    if (!eligible) status = metrics.leadsCount > 0 || approvedReviews > 0 ? "in_progress" : "not_started";
    else if (isWinner) status = input.rewarded ? "rewarded" : "pending_confirmation";
    else status = "in_progress";

    return {
      currentValue: round2(ratio),
      targetValue: null,
      progressPercent: eligible ? Math.min(100, ratio * 10) : progressPercent(approvedReviews, rule.calculationConfig.minReviews ?? 3),
      rewardAmount: reward,
      status,
      hint: eligible
        ? null
        : `Для участия нужно ≥${rule.calculationConfig.minLeads ?? 50} лидов и ≥${rule.calculationConfig.minReviews ?? 3} подтверждённых отзывов.`,
      rank: null
    };
  }

  return {
    currentValue: 0,
    targetValue: rule.targetValue,
    progressPercent: 0,
    rewardAmount: 0,
    status: "not_started",
    hint: "Правило ещё не подключено к автоматическому расчёту.",
    rank: null
  };
}

export function calculateManagerRewards(results: ManagerMotivationResult[]): {
  preliminary: number;
  potential: number;
} {
  const preliminary = results.reduce((sum, row) => sum + (row.rewardAmount > 0 ? row.rewardAmount : 0), 0);
  return { preliminary, potential: preliminary };
}

export function buildManagerLeaderboard(input: {
  managers: ManagerMotivationProfile[];
  metrics: ManagerPeriodMetrics[];
  reviews: ReviewSubmission[];
  periodId: string;
  reviewRule: MotivationRule | null;
  resultsByManager: Map<string, ManagerMotivationResult[]>;
  currentManagerId: string | null;
  hideFinanceForOthers: boolean;
}): LeaderboardRow[] {
  const { managers, metrics, reviews, periodId, reviewRule, resultsByManager, currentManagerId } = input;

  const candidates: ReviewContestCandidate[] = managers
    .filter((m) => m.active)
    .map((manager) => {
      const row = metrics.find((m) => m.managerId === manager.id && m.periodId === periodId);
      const approved = countApprovedReviews(reviews, manager.id, periodId);
      const leads = row?.leadsCount ?? 0;
      return {
        managerId: manager.id,
        approvedReviews: approved,
        leadsCount: leads,
        conversionToPaid: row?.conversionToPaid ?? 0,
        paidAmount: row?.salesAmount ?? 0,
        ratio: calculateReviewLeadRatio(approved, leads)
      };
    });

  const eligible = candidates.filter((c) =>
    reviewRule
      ? qualifiesForReviewContest(c.leadsCount, c.approvedReviews, reviewRule.calculationConfig)
      : false
  );
  const rankedEligible = [...eligible].sort(compareReviewContestCandidates);
  const placeByManager = new Map<string, number>();
  rankedEligible.forEach((c, index) => placeByManager.set(c.managerId, index + 1));

  const rows: LeaderboardRow[] = managers
    .filter((m) => m.active)
    .map((manager) => {
      const row = metrics.find((m) => m.managerId === manager.id && m.periodId === periodId);
      const approved = countApprovedReviews(reviews, manager.id, periodId);
      const leads = row?.leadsCount ?? 0;
      const ratio = calculateReviewLeadRatio(approved, leads);
      const qualifies = reviewRule
        ? qualifiesForReviewContest(leads, approved, reviewRule.calculationConfig)
        : false;
      const results = resultsByManager.get(manager.id) ?? [];
      const earned = results.reduce((sum, r) => sum + r.rewardAmount, 0);
      const place = placeByManager.get(manager.id) ?? rankedEligible.length + 1000;
      const status: LeaderboardRow["status"] = qualifies
        ? place === 1
          ? "pending_confirmation"
          : "eligible"
        : "not_eligible";

      return {
        place: qualifies ? place : 0,
        managerId: manager.id,
        managerName: manager.name,
        photoUrl: manager.photoUrl,
        leadsCount: leads,
        approvedReviews: approved,
        reviewLeadRatio: round2(ratio),
        conversionToPaid: row?.conversionToPaid ?? 0,
        averageItemsPerOrder: row?.averageItemsPerOrder ?? 0,
        earnedBonuses: earned,
        status,
        isCurrentUser: currentManagerId === manager.id,
        qualifiesForReviewContest: qualifies
      };
    })
    .sort((a, b) => {
      if (a.qualifiesForReviewContest !== b.qualifiesForReviewContest) {
        return a.qualifiesForReviewContest ? -1 : 1;
      }
      if (a.place !== b.place) return a.place - b.place;
      return b.reviewLeadRatio - a.reviewLeadRatio;
    })
    .map((row, index) => ({
      ...row,
      place: row.qualifiesForReviewContest ? row.place || index + 1 : index + 1
    }));

  // Re-number display places for full table (eligible first, then others).
  return rows.map((row, index) => ({ ...row, place: index + 1 }));
}

export function recalculateAverageFromCounts(totalItems: number, orders: number): number {
  if (orders <= 0) return 0;
  return round2(totalItems / orders);
}

export function canEditPeriod(
  status: string,
  accessLevel: "admin" | "rop" | "mop"
): boolean {
  if (accessLevel === "mop") return false;
  if (status === "closed" || status === "archive") return accessLevel === "admin";
  return accessLevel === "admin" || accessLevel === "rop";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
