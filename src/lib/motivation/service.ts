import type { AccessLevel, SessionUser } from "@/types/auth";
import type {
  FocusProduct,
  ManagerBonusCard,
  ManagerMotivationProfile,
  ManagerMotivationResult,
  ManagerMotivationSummary,
  ManagerPeriodMetrics,
  MetricAdjustment,
  MonthlyUpdate,
  MotivationBoardPayload,
  MotivationCatalog,
  MotivationPagePayload,
  MotivationPeriod,
  MotivationRule,
  ReviewSubmission,
  SalesResource
} from "@/types/motivation";
import { createMotivationCatalogSeed } from "@/data/motivation-seed";
import {
  buildContentFingerprint,
  buildManagerLeaderboard,
  calculateManagerRewards,
  calculateRuleProgress,
  calculateReviewLeadRatio,
  canEditPeriod,
  countApprovedReviews,
  determineReviewWinner,
  qualifiesForReviewContest,
  recalculateAverageFromCounts
} from "@/lib/motivation/calculator";
import { canManageMotivation, canSeeFullLeaderboard } from "@/lib/motivation/access";
import { monthTitle } from "@/lib/motivation/labels";
import { newMotivationId, readMotivationCatalog, updateMotivationCatalog } from "@/lib/motivation/store";

function sortPeriods(periods: MotivationPeriod[]): MotivationPeriod[] {
  return [...periods].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

export function pickDefaultPeriod(catalog: MotivationCatalog): MotivationPeriod | null {
  const sorted = sortPeriods(catalog.periods);
  const active = sorted.find((p) => p.status === "active" || p.status === "calculating");
  if (active) return active;
  const now = new Date();
  const current = sorted.find((p) => p.year === now.getFullYear() && p.month === now.getMonth() + 1);
  return current ?? sorted[0] ?? null;
}

export function resolveManagerForUser(
  catalog: MotivationCatalog,
  session: SessionUser
): ManagerMotivationProfile | null {
  const linked = catalog.managers.find((m) => m.linkedAuthUserId === session.id && m.active);
  if (linked) return linked;

  if (session.accessLevel === "mop") {
    const byName = catalog.managers.find(
      (m) => m.active && m.name.trim().toLowerCase() === session.name.trim().toLowerCase()
    );
    if (byName) return byName;
    // Demo fallback: first active manager so mop can preview the screen.
    return catalog.managers.find((m) => m.active) ?? null;
  }

  return null;
}

function emptyMetrics(managerId: string, periodId: string): ManagerPeriodMetrics {
  return {
    managerId,
    periodId,
    salesPlan: null,
    salesAmount: 0,
    leadsCount: 0,
    paidOrdersCount: 0,
    totalUniqueLineItems: 0,
    conversionToPaid: 0,
    averageItemsPerOrder: 0,
    source: "manual",
    updatedAt: new Date().toISOString()
  };
}

export function recalculateMotivationPeriod(catalog: MotivationCatalog, periodId: string): MotivationCatalog {
  const period = catalog.periods.find((p) => p.id === periodId);
  if (!period) return catalog;

  const rules = catalog.rules.filter((r) => r.periodId === periodId && r.isActive);
  const reviewRule = rules.find((r) => r.calculationConfig.metricKey === "review_lead_ratio") ?? null;
  const managers = catalog.managers.filter((m) => m.active);
  const now = new Date().toISOString();

  const candidates = managers.map((manager) => {
    const metrics =
      catalog.metrics.find((m) => m.managerId === manager.id && m.periodId === periodId) ??
      emptyMetrics(manager.id, periodId);
    const approved = countApprovedReviews(catalog.reviews, manager.id, periodId);
    return {
      managerId: manager.id,
      approvedReviews: approved,
      leadsCount: metrics.leadsCount,
      conversionToPaid: metrics.conversionToPaid,
      paidAmount: metrics.salesAmount,
      ratio: calculateReviewLeadRatio(approved, metrics.leadsCount)
    };
  });

  const eligible = candidates.filter((c) =>
    reviewRule
      ? qualifiesForReviewContest(c.leadsCount, c.approvedReviews, reviewRule.calculationConfig)
      : false
  );
  const autoWinner = determineReviewWinner(eligible);
  const manualWinner = reviewRule
    ? catalog.winners.find((w) => w.periodId === periodId && w.ruleId === reviewRule.id)?.managerId
    : null;
  const winnerId = manualWinner ?? autoWinner;

  const nextResults: ManagerMotivationResult[] = [];

  for (const manager of managers) {
    const metrics =
      catalog.metrics.find((m) => m.managerId === manager.id && m.periodId === periodId) ??
      emptyMetrics(manager.id, periodId);
    const approved = countApprovedReviews(catalog.reviews, manager.id, periodId);

    for (const rule of rules) {
      const previous = catalog.results.find(
        (r) => r.periodId === periodId && r.ruleId === rule.id && r.managerId === manager.id
      );
      const progress = calculateRuleProgress({
        rule,
        metrics,
        approvedReviews: approved,
        isWinner: rule.id === reviewRule?.id && manager.id === winnerId,
        rewarded: previous?.status === "rewarded"
      });

      let status = progress.status;
      if (period.status === "closed" || period.status === "archive") {
        if (progress.rewardAmount > 0) status = "rewarded";
        else if (status === "in_progress" || status === "not_started") status = "failed";
      }

      nextResults.push({
        id: previous?.id ?? newMotivationId("result"),
        periodId,
        ruleId: rule.id,
        managerId: manager.id,
        currentValue: progress.currentValue,
        targetValue: progress.targetValue,
        progressPercent: progress.progressPercent,
        rewardAmount: progress.rewardAmount,
        status,
        calculatedAt: now,
        confirmedBy: previous?.confirmedBy ?? null,
        confirmedAt: previous?.confirmedAt ?? null,
        comment: previous?.comment ?? progress.hint,
        rank: null,
        hint: progress.hint
      });
    }
  }

  // Assign review ranks
  if (reviewRule) {
    const ranked = [...eligible].sort((a, b) => b.ratio - a.ratio || b.approvedReviews - a.approvedReviews);
    ranked.forEach((c, index) => {
      const row = nextResults.find((r) => r.ruleId === reviewRule.id && r.managerId === c.managerId);
      if (row) row.rank = index + 1;
    });
  }

  const keptOther = catalog.results.filter((r) => r.periodId !== periodId);
  return {
    ...catalog,
    results: [...keptOther, ...nextResults],
    updatedAt: now
  };
}

function buildSummary(
  catalog: MotivationCatalog,
  period: MotivationPeriod,
  manager: ManagerMotivationProfile
): ManagerMotivationSummary {
  const metrics =
    catalog.metrics.find((m) => m.managerId === manager.id && m.periodId === period.id) ??
    emptyMetrics(manager.id, period.id);
  const approvedReviews = countApprovedReviews(catalog.reviews, manager.id, period.id);
  const results = catalog.results.filter((r) => r.periodId === period.id && r.managerId === manager.id);
  const { preliminary } = calculateManagerRewards(results);

  const activeRules = catalog.rules.filter((r) => r.periodId === period.id && r.isActive);
  const maxPossible = activeRules.reduce((sum, r) => sum + r.rewardAmount, 0);
  const potentialBonus = Math.max(0, maxPossible - preliminary);

  const reviewRule = activeRules.find((r) => r.calculationConfig.metricKey === "review_lead_ratio");
  const reviewResult = reviewRule
    ? results.find((r) => r.ruleId === reviewRule.id)
    : null;

  const leaderboard = buildManagerLeaderboard({
    managers: catalog.managers,
    metrics: catalog.metrics,
    reviews: catalog.reviews,
    periodId: period.id,
    reviewRule: reviewRule ?? null,
    resultsByManager: new Map(
      catalog.managers.map((m) => [
        m.id,
        catalog.results.filter((r) => r.periodId === period.id && r.managerId === m.id)
      ])
    ),
    currentManagerId: manager.id,
    hideFinanceForOthers: false
  });
  const myRow = leaderboard.find((r) => r.managerId === manager.id);

  let reviewsToNextBonus: number | null = null;
  if (reviewRule && reviewResult) {
    const minReviews = reviewRule.calculationConfig.minReviews ?? 3;
    if (approvedReviews < minReviews) reviewsToNextBonus = minReviews - approvedReviews;
  }

  return {
    manager,
    metrics,
    approvedReviews,
    preliminaryBonus: preliminary,
    potentialBonus,
    reviewRank: reviewResult?.rank ?? null,
    reviewsToNextBonus,
    placeInTeam: myRow?.place ?? null
  };
}

function buildBonusCards(
  catalog: MotivationCatalog,
  period: MotivationPeriod,
  manager: ManagerMotivationProfile | null
): ManagerBonusCard[] {
  const rules = catalog.rules
    .filter((r) => r.periodId === period.id && r.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const reviewRule = rules.find((r) => r.calculationConfig.metricKey === "review_lead_ratio");
  let leaderValue: number | null = null;
  let leaderName: string | null = null;

  if (reviewRule) {
    const board = buildManagerLeaderboard({
      managers: catalog.managers,
      metrics: catalog.metrics,
      reviews: catalog.reviews,
      periodId: period.id,
      reviewRule,
      resultsByManager: new Map(),
      currentManagerId: manager?.id ?? null,
      hideFinanceForOthers: false
    });
    const leader = board.find((r) => r.qualifiesForReviewContest);
    if (leader) {
      leaderValue = leader.reviewLeadRatio;
      leaderName = leader.managerName;
    }
  }

  return rules.map((rule) => {
    const result = manager
      ? catalog.results.find(
          (r) => r.periodId === period.id && r.ruleId === rule.id && r.managerId === manager.id
        ) ?? null
      : null;

    let gapToLeader: number | null = null;
    if (
      rule.calculationConfig.metricKey === "review_lead_ratio" &&
      result &&
      leaderValue != null
    ) {
      gapToLeader = Math.max(0, Math.round((leaderValue - result.currentValue) * 100) / 100);
    }

    return {
      rule,
      result,
      leaderValue: rule.calculationConfig.metricKey === "review_lead_ratio" ? leaderValue : null,
      leaderName: rule.calculationConfig.metricKey === "review_lead_ratio" ? leaderName : null,
      gapToLeader
    };
  });
}

function bonusCondition(rule: MotivationRule): string {
  if (rule.calculationConfig.metricKey === "average_items_per_order") {
    const target = rule.targetValue ?? rule.calculationConfig.targetAverageItems ?? 2.5;
    return `Среднее число наименований в оплаченных заказах ≥ ${String(target).replace(".", ",")}`;
  }
  if (rule.calculationConfig.metricKey === "average_check") {
    const target = rule.targetValue ?? 80;
    return `Средний чек оплаченных заказов ≥ ${target} € · комиссия 20% · выплата +111 €`;
  }
  if (rule.calculationConfig.metricKey === "review_lead_ratio") {
    const minLeads = rule.calculationConfig.minLeads ?? 50;
    const minReviews = rule.calculationConfig.minReviews ?? 3;
    return `Лучшее соотношение отзывов к лидам. Минимум: ${minLeads} лидов и ${minReviews} подтверждённых отзыва`;
  }
  if (rule.targetValue != null) {
    return `Цель: ${rule.targetValue}`;
  }
  return rule.description;
}

/** Simple board for managers: month bonuses + products to push now. */
export async function getMotivationBoard(): Promise<MotivationBoardPayload> {
  const catalog = await readMotivationCatalog();
  const period = pickDefaultPeriod(catalog);
  const seedFocus = createMotivationCatalogSeed().focusProducts;

  if (!period) {
    return {
      periodTitle: "Мотивация месяца",
      periodStatus: "draft",
      intro: "Условия мотивации на этот месяц пока не опубликованы.",
      bonuses: [],
      focusProducts: seedFocus
    };
  }

  const seedRules = createMotivationCatalogSeed().rules;
  const sourceRules =
    catalog.isDemo
      ? seedRules.filter((rule) => rule.periodId === period.id && rule.isActive)
      : catalog.rules.filter((rule) => rule.periodId === period.id && rule.isActive);

  const bonuses = sourceRules
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((rule) => ({
      id: rule.id,
      title: rule.title,
      description: rule.description,
      rewardAmount: rule.rewardAmount,
      condition: bonusCondition(rule)
    }));

  // Demo catalog always follows seed so focus products stay editable in code.
  const focusProducts: FocusProduct[] = (
    catalog.isDemo || catalog.focusProducts.length === 0 ? seedFocus : catalog.focusProducts
  )
    .map((product) => ({
      ...product,
      imageUrls: Array.isArray(product.imageUrls) ? product.imageUrls : []
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return {
    periodTitle: period.title,
    periodStatus: period.status,
    intro: "Дополнительные бонусы месяца — просто зафиксируйте условия и опирайтесь на них в работе.",
    bonuses,
    focusProducts
  };
}

export async function getMotivationPagePayload(input: {
  session: SessionUser;
  periodId?: string | null;
  viewAsManagerId?: string | null;
}): Promise<MotivationPagePayload> {
  let catalog = await readMotivationCatalog();
  const period =
    (input.periodId ? catalog.periods.find((p) => p.id === input.periodId) : null) ??
    pickDefaultPeriod(catalog);

  if (period) {
    const recalculated = recalculateMotivationPeriod(catalog, period.id);
    const changed = JSON.stringify(recalculated.results) !== JSON.stringify(catalog.results);
    catalog = recalculated;
    if (changed) {
      await updateMotivationCatalog(() => recalculated);
    }
  }

  const canEdit = canManageMotivation(input.session.accessLevel);
  const fullBoard = canSeeFullLeaderboard(input.session.accessLevel);

  let focusManager: ManagerMotivationProfile | null = null;
  if (canEdit && input.viewAsManagerId) {
    focusManager = catalog.managers.find((m) => m.id === input.viewAsManagerId) ?? null;
  }
  if (!focusManager) {
    focusManager = resolveManagerForUser(catalog, input.session);
  }
  if (!focusManager && canEdit) {
    focusManager = catalog.managers.find((m) => m.active) ?? null;
  }

  if (!period) {
    return {
      period: null,
      periods: [],
      canEdit,
      canSeeFullLeaderboard: fullBoard,
      isClosedForEditing: true,
      summary: null,
      bonusCards: [],
      leaderboard: [],
      updates: [],
      resources: catalog.resources.filter((r) => r.status === "active" || r.status === "testing"),
      myReviews: [],
      pendingReviews: [],
      notifications: [],
      history: [],
      adjustments: [],
      managers: catalog.managers,
      rules: []
    };
  }

  const resultsByManager = new Map(
    catalog.managers.map((m) => [
      m.id,
      catalog.results.filter((r) => r.periodId === period.id && r.managerId === m.id)
    ])
  );
  const reviewRule =
    catalog.rules.find(
      (r) => r.periodId === period.id && r.calculationConfig.metricKey === "review_lead_ratio"
    ) ?? null;

  let leaderboard = buildManagerLeaderboard({
    managers: catalog.managers,
    metrics: catalog.metrics,
    reviews: catalog.reviews,
    periodId: period.id,
    reviewRule,
    resultsByManager,
    currentManagerId: focusManager?.id ?? null,
    hideFinanceForOthers: !fullBoard
  });

  if (!fullBoard) {
    leaderboard = leaderboard.map((row) => ({
      ...row,
      leadsCount: row.isCurrentUser ? row.leadsCount : 0,
      conversionToPaid: row.isCurrentUser ? row.conversionToPaid : 0,
      earnedBonuses: row.isCurrentUser ? row.earnedBonuses : 0
    }));
  }

  const updates = catalog.updates
    .filter((u) => u.periodId === period.id && (u.status === "published" || canEdit))
    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.priority - a.priority);

  const resources = [...catalog.resources]
    .filter((r) => r.status !== "archive" || canEdit)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const myReviews = focusManager
    ? catalog.reviews
        .filter((r) => r.periodId === period.id && r.managerId === focusManager.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  const pendingReviews = canEdit
    ? catalog.reviews
        .filter((r) => r.periodId === period.id && (r.status === "pending" || r.status === "needs_clarification"))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];

  const notifications = catalog.notifications
    .filter(
      (n) =>
        n.userId === "*" ||
        n.userId === input.session.id ||
        (focusManager && n.userId === focusManager.id)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);

  const history = sortPeriods(catalog.periods)
    .filter((p) => p.id !== period.id)
    .slice(0, 6)
    .map((p) => {
      const histCatalog = recalculateMotivationPeriod(catalog, p.id);
      return {
        period: p,
        summary: focusManager ? buildSummary(histCatalog, p, focusManager) : null,
        results: focusManager
          ? histCatalog.results.filter((r) => r.periodId === p.id && r.managerId === focusManager.id)
          : histCatalog.results.filter((r) => r.periodId === p.id)
      };
    });

  return {
    period,
    periods: sortPeriods(catalog.periods).map((p) => ({
      id: p.id,
      title: p.title,
      month: p.month,
      year: p.year,
      status: p.status
    })),
    canEdit,
    canSeeFullLeaderboard: fullBoard,
    isClosedForEditing: !canEditPeriod(period.status, input.session.accessLevel),
    summary: focusManager ? buildSummary(catalog, period, focusManager) : null,
    bonusCards: buildBonusCards(catalog, period, focusManager),
    leaderboard,
    updates,
    resources,
    myReviews,
    pendingReviews,
    notifications,
    history,
    adjustments: canEdit
      ? catalog.adjustments.filter((a) => a.periodId === period.id).slice(-50).reverse()
      : [],
    managers: catalog.managers,
    rules: catalog.rules.filter((r) => r.periodId === period.id)
  };
}

export async function submitReview(input: {
  session: SessionUser;
  periodId: string;
  customerName: string;
  orderId: string;
  orderUrl?: string;
  reviewDate: string;
  reviewText: string;
  screenshotUrl?: string;
  chatMessageUrl?: string;
  managerComment?: string;
}): Promise<ReviewSubmission> {
  const catalog = await readMotivationCatalog();
  const manager = resolveManagerForUser(catalog, input.session);
  if (!manager && !canManageMotivation(input.session.accessLevel)) {
    throw new Error("Профиль менеджера не найден. Попросите РОП связать аккаунт.");
  }
  const managerId = manager?.id ?? input.session.id;
  const fingerprint = buildContentFingerprint({
    customerName: input.customerName,
    orderId: input.orderId,
    reviewText: input.reviewText,
    screenshotUrl: input.screenshotUrl ?? ""
  });

  const duplicate = catalog.reviews.find(
    (r) =>
      r.periodId === input.periodId &&
      r.contentFingerprint === fingerprint &&
      r.status !== "rejected"
  );
  if (duplicate) {
    throw new Error("Похожий отзыв уже отправлен. Повторные скриншоты не учитываются.");
  }

  const now = new Date().toISOString();
  const review: ReviewSubmission = {
    id: newMotivationId("review"),
    periodId: input.periodId,
    managerId,
    customerName: input.customerName.trim(),
    orderId: input.orderId.trim(),
    orderUrl: input.orderUrl?.trim() ?? "",
    reviewDate: input.reviewDate,
    reviewText: input.reviewText.trim(),
    screenshotUrl: input.screenshotUrl?.trim() ?? "",
    chatMessageUrl: input.chatMessageUrl?.trim() ?? "",
    managerComment: input.managerComment?.trim() ?? "",
    status: "pending",
    rejectionReason: null,
    reviewedBy: null,
    reviewedAt: null,
    externalChatSource: null,
    externalChatMessageId: null,
    contentFingerprint: fingerprint,
    createdAt: now,
    updatedAt: now
  };

  await updateMotivationCatalog((current) => {
    const next = {
      ...current,
      reviews: [...current.reviews, review],
      notifications: [
        ...current.notifications,
        {
          id: newMotivationId("notif"),
          userId: "*",
          type: "new_rule" as const,
          title: "Новый отзыв на проверку",
          message: `${manager?.name ?? input.session.name} отправил отзыв клиента на проверку.`,
          periodId: input.periodId,
          readAt: null,
          createdAt: now
        }
      ]
    };
    return recalculateMotivationPeriod(next, input.periodId);
  });

  return review;
}

export async function moderateReview(input: {
  session: SessionUser;
  reviewId: string;
  action: "approve" | "reject" | "clarify";
  reason?: string;
}): Promise<ReviewSubmission> {
  if (!canManageMotivation(input.session.accessLevel)) {
    throw new Error("Недостаточно прав");
  }
  if (input.action === "reject" && !input.reason?.trim()) {
    throw new Error("Укажите причину отклонения");
  }

  let updated: ReviewSubmission | null = null;
  await updateMotivationCatalog((current) => {
    const period = current.periods.find((p) =>
      current.reviews.some((r) => r.id === input.reviewId && r.periodId === p.id)
    );
    if (period && !canEditPeriod(period.status, input.session.accessLevel)) {
      throw new Error("Период закрыт. Изменения доступны только администратору.");
    }

    const now = new Date().toISOString();
    const reviews = current.reviews.map((review) => {
      if (review.id !== input.reviewId) return review;
      const nextStatus =
        input.action === "approve"
          ? "approved"
          : input.action === "reject"
            ? "rejected"
            : "needs_clarification";
      updated = {
        ...review,
        status: nextStatus,
        rejectionReason: input.action === "reject" ? input.reason!.trim() : null,
        reviewedBy: input.session.id,
        reviewedAt: now,
        updatedAt: now
      };
      return updated;
    });

    if (!updated) throw new Error("Отзыв не найден");

    const notifType =
      input.action === "approve"
        ? ("review_approved" as const)
        : input.action === "reject"
          ? ("review_rejected" as const)
          : ("review_rejected" as const);

    const next: MotivationCatalog = {
      ...current,
      reviews,
      notifications: [
        ...current.notifications,
        {
          id: newMotivationId("notif"),
          userId: updated.managerId,
          type: notifType,
          title:
            input.action === "approve"
              ? "Отзыв подтверждён"
              : input.action === "reject"
                ? "Отзыв отклонён"
                : "Нужно уточнение по отзыву",
          message:
            input.action === "approve"
              ? "Руководитель подтвердил хороший отзыв клиента. Он учтён в рейтинге."
              : input.action === "reject"
                ? `Отзыв отклонён: ${input.reason}`
                : "Руководитель запросил уточнение по отзыву.",
          periodId: updated.periodId,
          readAt: null,
          createdAt: now
        }
      ]
    };
    return recalculateMotivationPeriod(next, updated.periodId);
  });

  if (!updated) throw new Error("Отзыв не найден");
  return updated;
}

export async function applyMetricAdjustment(input: {
  session: SessionUser;
  periodId: string;
  managerId: string;
  metricName: keyof ManagerPeriodMetrics | string;
  newValue: number;
  reason: string;
}): Promise<MetricAdjustment> {
  if (!canManageMotivation(input.session.accessLevel)) {
    throw new Error("Недостаточно прав");
  }
  if (!input.reason.trim()) throw new Error("Укажите причину корректировки");

  let adjustment: MetricAdjustment | null = null;
  await updateMotivationCatalog((current) => {
    const period = current.periods.find((p) => p.id === input.periodId);
    if (!period) throw new Error("Период не найден");
    if (!canEditPeriod(period.status, input.session.accessLevel)) {
      throw new Error("Период закрыт. Изменения доступны только администратору.");
    }

    const existing =
      current.metrics.find((m) => m.managerId === input.managerId && m.periodId === input.periodId) ??
      emptyMetrics(input.managerId, input.periodId);

    const metricKey = input.metricName as keyof ManagerPeriodMetrics;
    const oldRaw = existing[metricKey];
    const oldValue = typeof oldRaw === "number" || typeof oldRaw === "string" ? oldRaw : String(oldRaw ?? "");
    const nextMetrics: ManagerPeriodMetrics = {
      ...existing,
      source: "manual",
      updatedAt: new Date().toISOString()
    };

    if (metricKey === "salesPlan") nextMetrics.salesPlan = input.newValue;
    else if (metricKey === "salesAmount") nextMetrics.salesAmount = input.newValue;
    else if (metricKey === "leadsCount") nextMetrics.leadsCount = input.newValue;
    else if (metricKey === "paidOrdersCount") nextMetrics.paidOrdersCount = input.newValue;
    else if (metricKey === "totalUniqueLineItems") nextMetrics.totalUniqueLineItems = input.newValue;
    else if (metricKey === "conversionToPaid") nextMetrics.conversionToPaid = input.newValue;
    else if (metricKey === "averageItemsPerOrder") nextMetrics.averageItemsPerOrder = input.newValue;
    else throw new Error("Неизвестный показатель для корректировки");

    if (metricKey === "totalUniqueLineItems" || metricKey === "paidOrdersCount") {
      nextMetrics.averageItemsPerOrder = recalculateAverageFromCounts(
        nextMetrics.totalUniqueLineItems,
        nextMetrics.paidOrdersCount
      );
    }

    adjustment = {
      id: newMotivationId("adj"),
      periodId: input.periodId,
      managerId: input.managerId,
      metricName: String(input.metricName),
      oldValue,
      newValue: input.newValue,
      reason: input.reason.trim(),
      changedBy: input.session.id,
      createdAt: new Date().toISOString()
    };

    const metrics = [
      ...current.metrics.filter(
        (m) => !(m.managerId === input.managerId && m.periodId === input.periodId)
      ),
      nextMetrics
    ];

    return recalculateMotivationPeriod(
      {
        ...current,
        metrics,
        adjustments: [...current.adjustments, adjustment]
      },
      input.periodId
    );
  });

  if (!adjustment) throw new Error("Не удалось сохранить корректировку");
  return adjustment;
}

export async function upsertRule(input: {
  session: SessionUser;
  rule: Partial<MotivationRule> & { periodId: string; title: string };
}): Promise<MotivationRule> {
  if (!canManageMotivation(input.session.accessLevel)) throw new Error("Недостаточно прав");

  let saved: MotivationRule | null = null;
  await updateMotivationCatalog((current) => {
    const period = current.periods.find((p) => p.id === input.rule.periodId);
    if (!period) throw new Error("Период не найден");
    if (!canEditPeriod(period.status, input.session.accessLevel)) {
      throw new Error("Период закрыт. Изменения доступны только администратору.");
    }

    const now = new Date().toISOString();
    if (input.rule.id) {
      const rules = current.rules.map((rule) => {
        if (rule.id !== input.rule.id) return rule;
        saved = {
          ...rule,
          ...input.rule,
          currency: "EUR",
          updatedAt: now
        } as MotivationRule;
        return saved;
      });
      if (!saved) throw new Error("Правило не найдено");
      return recalculateMotivationPeriod({ ...current, rules }, input.rule.periodId);
    }

    saved = {
      id: newMotivationId("rule"),
      periodId: input.rule.periodId,
      title: input.rule.title,
      description: input.rule.description ?? "",
      ruleType: input.rule.ruleType ?? "numeric_target",
      rewardType: input.rule.rewardType ?? "fixed",
      rewardAmount: input.rule.rewardAmount ?? 0,
      currency: "EUR",
      targetValue: input.rule.targetValue ?? null,
      minimumValue: input.rule.minimumValue ?? null,
      calculationConfig: input.rule.calculationConfig ?? {},
      dataSource: input.rule.dataSource ?? "manual",
      isActive: input.rule.isActive ?? true,
      displayOrder: input.rule.displayOrder ?? current.rules.length + 1,
      createdAt: now,
      updatedAt: now
    };
    return recalculateMotivationPeriod(
      { ...current, rules: [...current.rules, saved] },
      input.rule.periodId
    );
  });

  if (!saved) throw new Error("Не удалось сохранить правило");
  return saved;
}

export async function upsertUpdate(input: {
  session: SessionUser;
  update: Partial<MonthlyUpdate> & { periodId: string; title: string; category: MonthlyUpdate["category"] };
}): Promise<MonthlyUpdate> {
  if (!canManageMotivation(input.session.accessLevel)) throw new Error("Недостаточно прав");

  let saved: MonthlyUpdate | null = null;
  await updateMotivationCatalog((current) => {
    const now = new Date().toISOString();
    if (input.update.id) {
      const updates = current.updates.map((row) => {
        if (row.id !== input.update.id) return row;
        saved = {
          ...row,
          ...input.update,
          updatedAt: now
        } as MonthlyUpdate;
        return saved;
      });
      if (!saved) throw new Error("Обновление не найдено");
      return { ...current, updates };
    }

    saved = {
      id: newMotivationId("upd"),
      periodId: input.update.periodId,
      category: input.update.category,
      title: input.update.title,
      shortDescription: input.update.shortDescription ?? "",
      fullDescription: input.update.fullDescription ?? "",
      imageUrl: input.update.imageUrl ?? "",
      buttonLabel: input.update.buttonLabel ?? "Открыть",
      buttonUrl: input.update.buttonUrl ?? "",
      secondaryButtonLabel: input.update.secondaryButtonLabel ?? "",
      secondaryButtonUrl: input.update.secondaryButtonUrl ?? "",
      priority: input.update.priority ?? 50,
      isPinned: input.update.isPinned ?? false,
      status: input.update.status ?? "published",
      publishedAt: input.update.status === "draft" ? null : now,
      createdBy: input.session.id,
      createdAt: now,
      updatedAt: now
    };
    return {
      ...current,
      updates: [...current.updates, saved],
      notifications: [
        ...current.notifications,
        {
          id: newMotivationId("notif"),
          userId: "*",
          type: "new_resource",
          title: "Что нового в этом месяце",
          message: saved.title,
          periodId: saved.periodId,
          readAt: null,
          createdAt: now
        }
      ]
    };
  });

  if (!saved) throw new Error("Не удалось сохранить обновление");
  return saved;
}

export async function upsertResource(input: {
  session: SessionUser;
  resource: Partial<SalesResource> & { title: string; type: SalesResource["type"]; url: string };
}): Promise<SalesResource> {
  if (!canManageMotivation(input.session.accessLevel)) throw new Error("Недостаточно прав");

  let saved: SalesResource | null = null;
  await updateMotivationCatalog((current) => {
    const now = new Date().toISOString();
    if (input.resource.id) {
      const resources = current.resources.map((row) => {
        if (row.id !== input.resource.id) return row;
        saved = { ...row, ...input.resource, updatedAt: now } as SalesResource;
        return saved;
      });
      if (!saved) throw new Error("Инструмент не найден");
      return { ...current, resources };
    }

    saved = {
      id: newMotivationId("res"),
      title: input.resource.title,
      type: input.resource.type,
      description: input.resource.description ?? "",
      usageInstructions: input.resource.usageInstructions ?? "",
      salesStage: input.resource.salesStage ?? "",
      url: input.resource.url,
      status: input.resource.status ?? "active",
      owner: input.resource.owner ?? input.session.name,
      updatedAt: now,
      displayOrder: input.resource.displayOrder ?? current.resources.length + 1,
      createdAt: now
    };
    return { ...current, resources: [...current.resources, saved] };
  });

  if (!saved) throw new Error("Не удалось сохранить инструмент");
  return saved;
}

export async function createPeriodFromPrevious(input: {
  session: SessionUser;
  month: number;
  year: number;
  copyFromPeriodId?: string;
}): Promise<MotivationPeriod> {
  if (!canManageMotivation(input.session.accessLevel)) throw new Error("Недостаточно прав");

  let created: MotivationPeriod | null = null;
  await updateMotivationCatalog((current) => {
    const exists = current.periods.find((p) => p.month === input.month && p.year === input.year);
    if (exists) throw new Error("Такой месяц уже существует");

    const now = new Date().toISOString();
    const startDate = `${input.year}-${String(input.month).padStart(2, "0")}-01`;
    const endDay = new Date(input.year, input.month, 0).getDate();
    const endDate = `${input.year}-${String(input.month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    created = {
      id: newMotivationId("period"),
      title: monthTitle(input.month, input.year).replace(/^./, (c) => c.toUpperCase()),
      month: input.month,
      year: input.year,
      startDate,
      endDate,
      status: "draft",
      publishedAt: null,
      closedAt: null,
      createdBy: input.session.id,
      createdAt: now,
      updatedAt: now
    };

    let rules = current.rules;
    if (input.copyFromPeriodId) {
      const sourceRules = current.rules.filter((r) => r.periodId === input.copyFromPeriodId);
      const copied = sourceRules.map((rule, index) => ({
        ...rule,
        id: newMotivationId("rule"),
        periodId: created!.id,
        createdAt: now,
        updatedAt: now,
        displayOrder: index + 1
      }));
      rules = [...current.rules, ...copied];
    }

    return { ...current, periods: [...current.periods, created], rules };
  });

  if (!created) throw new Error("Не удалось создать период");
  return created;
}

export async function setPeriodStatus(input: {
  session: SessionUser;
  periodId: string;
  status: MotivationPeriod["status"];
}): Promise<MotivationPeriod> {
  if (!canManageMotivation(input.session.accessLevel)) throw new Error("Недостаточно прав");

  let period: MotivationPeriod | null = null;
  await updateMotivationCatalog((current) => {
    const now = new Date().toISOString();
    const periods = current.periods.map((row) => {
      if (row.id !== input.periodId) return row;
      if ((row.status === "closed" || row.status === "archive") && input.session.accessLevel !== "admin") {
        throw new Error("Закрытый период может менять только администратор");
      }
      period = {
        ...row,
        status: input.status,
        publishedAt: input.status === "active" && !row.publishedAt ? now : row.publishedAt,
        closedAt: input.status === "closed" || input.status === "archive" ? now : row.closedAt,
        updatedAt: now
      };
      return period;
    });
    if (!period) throw new Error("Период не найден");
    let next = { ...current, periods };
    next = recalculateMotivationPeriod(next, input.periodId);
    if (input.status === "closed" || input.status === "archive") {
      next = {
        ...next,
        notifications: [
          ...next.notifications,
          {
            id: newMotivationId("notif"),
            userId: "*",
            type: "period_closed",
            title: "Результаты месяца зафиксированы",
            message: `Период «${period.title}» закрыт. Предварительные бонусы сохранены в истории.`,
            periodId: period.id,
            readAt: null,
            createdAt: now
          }
        ]
      };
    }
    return next;
  });

  if (!period) throw new Error("Период не найден");
  return period;
}

export async function confirmReviewWinner(input: {
  session: SessionUser;
  periodId: string;
  ruleId: string;
  managerId: string;
}): Promise<void> {
  if (!canManageMotivation(input.session.accessLevel)) throw new Error("Недостаточно прав");

  await updateMotivationCatalog((current) => {
    const period = current.periods.find((p) => p.id === input.periodId);
    if (!period) throw new Error("Период не найден");
    if (!canEditPeriod(period.status, input.session.accessLevel)) {
      throw new Error("Период закрыт. Изменения доступны только администратору.");
    }
    const now = new Date().toISOString();
    const winners = [
      ...current.winners.filter((w) => !(w.periodId === input.periodId && w.ruleId === input.ruleId)),
      {
        periodId: input.periodId,
        ruleId: input.ruleId,
        managerId: input.managerId,
        confirmedBy: input.session.id,
        confirmedAt: now
      }
    ];
    return recalculateMotivationPeriod({ ...current, winners }, input.periodId);
  });
}

export async function forceRecalculate(periodId: string, accessLevel: AccessLevel): Promise<void> {
  if (!canManageMotivation(accessLevel)) throw new Error("Недостаточно прав");
  await updateMotivationCatalog((current) => recalculateMotivationPeriod(current, periodId));
}

export async function linkManagerAuthUser(input: {
  session: SessionUser;
  managerId: string;
  authUserId: string | null;
}): Promise<ManagerMotivationProfile> {
  if (!canManageMotivation(input.session.accessLevel)) throw new Error("Недостаточно прав");
  let saved: ManagerMotivationProfile | null = null;
  await updateMotivationCatalog((current) => {
    const managers = current.managers.map((m) => {
      if (m.id !== input.managerId) {
        if (input.authUserId && m.linkedAuthUserId === input.authUserId) {
          return { ...m, linkedAuthUserId: null };
        }
        return m;
      }
      saved = { ...m, linkedAuthUserId: input.authUserId };
      return saved;
    });
    if (!saved) throw new Error("Менеджер не найден");
    return { ...current, managers };
  });
  if (!saved) throw new Error("Менеджер не найден");
  return saved;
}
