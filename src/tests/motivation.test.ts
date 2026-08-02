import assert from "node:assert/strict";
import {
  buildContentFingerprint,
  buildManagerLeaderboard,
  calculateAverageItemsPerOrder,
  calculateReviewLeadRatio,
  calculateRuleProgress,
  canEditPeriod,
  compareReviewContestCandidates,
  countApprovedReviews,
  countUniqueLineItems,
  determineReviewWinner,
  itemsNeededToReachAverage,
  qualifiesForReviewContest,
  rewardForNumericTarget
} from "@/lib/motivation/calculator";
import type {
  ManagerMotivationProfile,
  ManagerPeriodMetrics,
  MotivationRule,
  PaidOrderInput,
  ReviewSubmission
} from "@/types/motivation";

const near = (actual: number, expected: number, tolerance = 0.01) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
};

const baseRuleAvg: MotivationRule = {
  id: "r1",
  periodId: "p1",
  title: "Avg items",
  description: "",
  ruleType: "numeric_target",
  rewardType: "fixed",
  rewardAmount: 100,
  currency: "EUR",
  targetValue: 2.5,
  minimumValue: null,
  calculationConfig: {
    uniqueLineItems: true,
    targetAverageItems: 2.5,
    metricKey: "average_items_per_order"
  },
  dataSource: "manual",
  isActive: true,
  displayOrder: 1,
  createdAt: "",
  updatedAt: ""
};

const baseRuleReviews: MotivationRule = {
  ...baseRuleAvg,
  id: "r2",
  title: "Reviews",
  ruleType: "team_best",
  rewardAmount: 50,
  targetValue: null,
  calculationConfig: {
    minLeads: 50,
    minReviews: 3,
    metricKey: "review_lead_ratio"
  }
};

// Unique line items: magazine + song + digital + 2 copies of same magazine = 3 names
assert.equal(
  countUniqueLineItems([
    { productId: "1", productName: "Журнал", quantity: 2 },
    { productId: "2", productName: "Песня", quantity: 1 },
    { productId: "3", productName: "Цифровая версия", quantity: 1 }
  ]),
  3
);

const mixedOrders: PaidOrderInput[] = [
  {
    id: "a",
    managerId: "m1",
    status: "paid",
    products: [
      { productId: "1", productName: "A", quantity: 2 },
      { productId: "2", productName: "B", quantity: 1 }
    ]
  },
  {
    id: "b",
    managerId: "m1",
    status: "unpaid",
    products: [{ productId: "1", productName: "A", quantity: 10 }]
  },
  {
    id: "c",
    managerId: "m1",
    status: "cancelled",
    products: [{ productId: "1", productName: "A", quantity: 10 }]
  },
  {
    id: "d",
    managerId: "m1",
    status: "test",
    products: [{ productId: "1", productName: "A", quantity: 10 }]
  },
  {
    id: "e",
    managerId: "m1",
    status: "duplicate",
    products: [{ productId: "1", productName: "A", quantity: 10 }]
  },
  {
    id: "f",
    managerId: "m1",
    status: "paid",
    products: [
      { productId: "1", productName: "A", quantity: 1 },
      { productId: "3", productName: "C", quantity: 1 },
      { productId: "4", productName: "D", quantity: 1 }
    ]
  }
];

const avg = calculateAverageItemsPerOrder(mixedOrders, { uniqueLineItems: true });
assert.equal(avg.paidOrdersCount, 2);
assert.equal(avg.totalUniqueLineItems, 5);
near(avg.average, 2.5);

// Spec example: 108 / 40 = 2.7
near(108 / 40, 2.7);

assert.equal(rewardForNumericTarget(2.5, 2.5, 100), 100);
assert.equal(rewardForNumericTarget(2.49, 2.5, 100), 0);
assert.equal(rewardForNumericTarget(2.7, 2.5, 100), 100);

const progressExact = calculateRuleProgress({
  rule: baseRuleAvg,
  metrics: {
    managerId: "m1",
    periodId: "p1",
    salesPlan: null,
    salesAmount: 0,
    leadsCount: 0,
    paidOrdersCount: 40,
    totalUniqueLineItems: 100,
    conversionToPaid: 0,
    averageItemsPerOrder: 2.5,
    source: "manual",
    updatedAt: ""
  },
  approvedReviews: 0
});
assert.equal(progressExact.rewardAmount, 100);
assert.equal(progressExact.status, "completed");

const progressBelow = calculateRuleProgress({
  rule: baseRuleAvg,
  metrics: {
    managerId: "m1",
    periodId: "p1",
    salesPlan: null,
    salesAmount: 0,
    leadsCount: 0,
    paidOrdersCount: 40,
    totalUniqueLineItems: 99,
    conversionToPaid: 0,
    averageItemsPerOrder: 2.49,
    source: "manual",
    updatedAt: ""
  },
  approvedReviews: 0
});
assert.equal(progressBelow.rewardAmount, 0);
assert.equal(progressBelow.status, "in_progress");
assert.equal(itemsNeededToReachAverage(99, 40, 2.5), 1);

near(calculateReviewLeadRatio(10, 200), 5);
near(calculateReviewLeadRatio(0, 0), 0);

assert.equal(qualifiesForReviewContest(49, 3, { minLeads: 50, minReviews: 3 }), false);
assert.equal(qualifiesForReviewContest(50, 2, { minLeads: 50, minReviews: 3 }), false);
assert.equal(qualifiesForReviewContest(50, 3, { minLeads: 50, minReviews: 3 }), true);

const reviews: ReviewSubmission[] = [
  {
    id: "1",
    periodId: "p1",
    managerId: "m1",
    customerName: "A",
    orderId: "1",
    orderUrl: "",
    reviewDate: "",
    reviewText: "ok",
    screenshotUrl: "s1",
    chatMessageUrl: "",
    managerComment: "",
    status: "approved",
    rejectionReason: null,
    reviewedBy: null,
    reviewedAt: null,
    externalChatSource: null,
    externalChatMessageId: null,
    contentFingerprint: "fp1",
    createdAt: "",
    updatedAt: ""
  },
  {
    id: "2",
    periodId: "p1",
    managerId: "m1",
    customerName: "A",
    orderId: "1",
    orderUrl: "",
    reviewDate: "",
    reviewText: "ok",
    screenshotUrl: "s1",
    chatMessageUrl: "",
    managerComment: "",
    status: "approved",
    rejectionReason: null,
    reviewedBy: null,
    reviewedAt: null,
    externalChatSource: null,
    externalChatMessageId: null,
    contentFingerprint: "fp1",
    createdAt: "",
    updatedAt: ""
  },
  {
    id: "3",
    periodId: "p1",
    managerId: "m1",
    customerName: "B",
    orderId: "2",
    orderUrl: "",
    reviewDate: "",
    reviewText: "pending",
    screenshotUrl: "",
    chatMessageUrl: "",
    managerComment: "",
    status: "pending",
    rejectionReason: null,
    reviewedBy: null,
    reviewedAt: null,
    externalChatSource: null,
    externalChatMessageId: null,
    contentFingerprint: "fp2",
    createdAt: "",
    updatedAt: ""
  }
];

assert.equal(countApprovedReviews(reviews, "m1", "p1"), 1);

const a = {
  managerId: "m1",
  approvedReviews: 5,
  leadsCount: 100,
  conversionToPaid: 0.2,
  paidAmount: 1000,
  ratio: 5
};
const b = {
  managerId: "m2",
  approvedReviews: 6,
  leadsCount: 120,
  conversionToPaid: 0.18,
  paidAmount: 900,
  ratio: 5
};
assert.ok(compareReviewContestCandidates(a, b) > 0);
assert.equal(determineReviewWinner([a, b]), "m2");

const managers: ManagerMotivationProfile[] = [
  { id: "m1", name: "Анна", photoUrl: null, linkedAuthUserId: null, bitrixUserId: null, active: true },
  { id: "m2", name: "Мария", photoUrl: null, linkedAuthUserId: null, bitrixUserId: null, active: true }
];
const metrics: ManagerPeriodMetrics[] = [
  {
    managerId: "m1",
    periodId: "p1",
    salesPlan: null,
    salesAmount: 1000,
    leadsCount: 100,
    paidOrdersCount: 20,
    totalUniqueLineItems: 50,
    conversionToPaid: 0.2,
    averageItemsPerOrder: 2.5,
    source: "manual",
    updatedAt: ""
  },
  {
    managerId: "m2",
    periodId: "p1",
    salesPlan: null,
    salesAmount: 800,
    leadsCount: 100,
    paidOrdersCount: 16,
    totalUniqueLineItems: 32,
    conversionToPaid: 0.16,
    averageItemsPerOrder: 2,
    source: "manual",
    updatedAt: ""
  }
];

const board = buildManagerLeaderboard({
  managers,
  metrics,
  reviews: [
    ...Array.from({ length: 5 }).map((_, i) => ({
      ...reviews[0]!,
      id: `a${i}`,
      managerId: "m1",
      contentFingerprint: `a${i}`,
      status: "approved" as const
    })),
    ...Array.from({ length: 3 }).map((_, i) => ({
      ...reviews[0]!,
      id: `b${i}`,
      managerId: "m2",
      contentFingerprint: `b${i}`,
      status: "approved" as const
    }))
  ],
  periodId: "p1",
  reviewRule: baseRuleReviews,
  resultsByManager: new Map([
    ["m1", [{ rewardAmount: 100 } as never]],
    ["m2", [{ rewardAmount: 0 } as never]]
  ]),
  currentManagerId: "m2",
  hideFinanceForOthers: true
});

assert.equal(board[0]?.managerId, "m1");
assert.equal(board.find((r) => r.managerId === "m2")?.isCurrentUser, true);

assert.equal(canEditPeriod("active", "mop"), false);
assert.equal(canEditPeriod("active", "rop"), true);
assert.equal(canEditPeriod("closed", "rop"), false);
assert.equal(canEditPeriod("closed", "admin"), true);
assert.equal(canEditPeriod("archive", "admin"), true);

const fp1 = buildContentFingerprint({
  customerName: "Client",
  orderId: "1",
  reviewText: "Great",
  screenshotUrl: "http://x"
});
const fp2 = buildContentFingerprint({
  customerName: "client",
  orderId: "1",
  reviewText: "Great",
  screenshotUrl: "http://x"
});
assert.equal(fp1, fp2);

const reviewProgress = calculateRuleProgress({
  rule: baseRuleReviews,
  metrics: metrics[0]!,
  approvedReviews: 5,
  isWinner: true
});
assert.equal(reviewProgress.rewardAmount, 50);
assert.equal(reviewProgress.status, "pending_confirmation");

const notEligible = calculateRuleProgress({
  rule: baseRuleReviews,
  metrics: { ...metrics[0]!, leadsCount: 10 },
  approvedReviews: 1,
  isWinner: false
});
assert.equal(notEligible.rewardAmount, 0);
assert.ok(notEligible.hint);

console.log("motivation tests passed");
