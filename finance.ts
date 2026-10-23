import {
  adjustmentSchema,
  caps,
  adjustable,
  emptyAdjustments,
  defaultPreferences,
  type Adjustments,
  type Goal,
  type Preferences,
  type Scenario,
  type Category,
  type Projection,
} from "./model";
import {
  asOf,
  balance,
  currentTotals,
  currentTransactions,
  ledger,
} from "./fixtures";
export const money = (value: number, cents = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(value);
export const dateLabel = (value: string) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
export function addMonths(months: number) {
  const date = new Date(`${asOf}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}
export function project(goal: Goal, adjustments: Adjustments): Projection {
  adjustmentSchema.parse(adjustments);
  const extra =
    Math.round(Object.values(adjustments).reduce((a, b) => a + b, 0) * 100) /
    100;
  const monthly = goal.base + extra;
  const projected =
    Math.round((goal.saved + monthly * goal.months) * 100) / 100;
  const monthsToGoal =
    monthly > 0
      ? Math.max(0, Math.ceil((goal.target - goal.saved) / monthly))
      : null;
  return {
    extra,
    monthly,
    projected,
    gap: Math.max(0, goal.target - projected),
    surplus: Math.max(0, projected - goal.target),
    needed: Math.max(
      0,
      Math.ceil((goal.target - goal.saved) / goal.months - goal.base),
    ),
    progress: Math.min(100, (projected / goal.target) * 100),
    monthsToGoal,
    goalDate: monthsToGoal !== null ? addMonths(monthsToGoal) : null,
    targetDate: addMonths(goal.months),
    baseline: goal.saved + goal.base * goal.months,
  };
}
export function spendingAnalysis() {
  const comparisonDay = Number(asOf.slice(-2));
  const prior = [7, 8, 9].map((m) =>
    ledger.filter(
      (t) =>
        t.category === "Dining" &&
        t.date.startsWith(`2026-0${m}`) &&
        Number(t.date.slice(-2)) <= comparisonDay,
    ),
  );
  const typical =
    prior.reduce(
      (sum, rows) => sum + rows.reduce((n, t) => n + t.amount, 0),
      0,
    ) / prior.length;
  const typicalCount =
    prior.reduce((sum, rows) => sum + rows.length, 0) / prior.length;
  const current = currentTransactions.filter((t) => t.category === "Dining");
  return {
    current: currentTotals.Dining,
    typical,
    difference: currentTotals.Dining - typical,
    currentCount: current.length,
    typicalCount,
    extraCount: current.length - typicalCount,
    contributing: current.filter((t) => t.contributing),
    period: "Oct 1–23",
    baselinePeriod: "Jul–Sep, days 1–23",
    method: "Equivalent date ranges",
  };
}
export function validateScenario(
  adjustments: Adjustments,
  preferences: Preferences,
) {
  adjustmentSchema.parse(adjustments);
  for (const category of adjustable) {
    if (
      preferences.protectedCategories.includes(category) &&
      adjustments[category] !== 0
    )
      throw new Error(`${category} is protected`);
    if (adjustments[category] > currentTotals[category])
      throw new Error("Reduction exceeds observed spending");
  }
  if (balance < preferences.checkingBuffer)
    throw new Error("Checking balance is below the requested buffer");
  return adjustments;
}
export function makeScenario(
  goal: Goal,
  adjustments: Adjustments,
  preferences: Preferences,
  title = "Your next move",
  source: "calculated" | "ai" = "calculated",
  rationale?: string,
  tradeoffs?: string[],
): Scenario {
  validateScenario(adjustments, preferences);
  const categories = adjustable.filter((c) => adjustments[c] > 0);
  return {
    id: `${source}-${Object.values(adjustments).join("-")}`,
    title,
    adjustments,
    source,
    rationale:
      rationale ||
      (categories.length
        ? `Make room in ${categories.map((c) => c.toLowerCase()).join(" and ")} while keeping your protected spending unchanged.`
        : "Your scheduled savings continue with no spending changes."),
    tradeoffs: tradeoffs || [
      "Requires saving the difference consistently; spending targets do not move money.",
    ],
    evidence: [
      "October 1–23 transactions",
      "July–September, days 1–23 baseline",
      "Vacation Fund",
      "Your stated preferences",
    ],
    projection: project(goal, adjustments),
  };
}
export function calculateSuggestion(
  goal: Goal,
  preferences: Preferences = defaultPreferences(),
  kind: "small" | "dining" | "cushion" | "lighter" = "small",
): Scenario {
  const protectedCategories =
    kind === "dining"
      ? [...new Set<Category>([...preferences.protectedCategories, "Dining"])]
      : preferences.protectedCategories;
  const p = { ...preferences, protectedCategories };
  const needed = project(goal, emptyAdjustments()).needed;
  let remaining =
    preferences.requestedExtra ??
    (kind === "cushion" ? needed + 30 : kind === "lighter" ? 30 : needed);
  const amounts = emptyAdjustments();
  const order =
    kind === "dining"
      ? (["Entertainment", "Subscriptions", "Shopping", "Dining"] as const)
      : adjustable;
  for (const category of order) {
    if (p.protectedCategories.includes(category)) continue;
    const amount = Math.min(
      caps[category],
      Math.max(0, Math.ceil(remaining / 5) * 5),
    );
    amounts[category] = amount;
    remaining -= amount;
  }
  return makeScenario(
    goal,
    amounts,
    p,
    kind === "dining"
      ? "Keep dining unchanged"
      : kind === "cushion"
        ? "A little breathing room"
        : kind === "lighter"
          ? "A smaller first step"
          : "The smallest change",
  );
}
export function parseExamplePreferences(
  request: string,
  initial: Preferences,
): Preferences {
  const protectedSet = new Set<Category>([
    ...initial.protectedCategories,
    "Groceries",
    "Bills",
  ]);
  if (
    /(?:keep|protect|as.is|don.t|without|friends|eat out|dinners)/i.test(
      request,
    ) &&
    /(?:dining|dinner|eat out|restaurants|friends)/i.test(request)
  )
    protectedSet.add("Dining");
  if (
    /(?:no|don.t|protect|keep)/i.test(request) &&
    /subscription/i.test(request)
  )
    protectedSet.add("Subscriptions");
  if (/(?:no|don.t|protect|keep)/i.test(request) && /shopping/i.test(request))
    protectedSet.add("Shopping");
  const amount = request.match(/(?:save|extra|just|only)\s*\$?(\d+)/i);
  const buffer = request.match(/\$?(\d+)\s*(?:checking\s*)?buffer/i);
  return {
    ...initial,
    protectedCategories: [...protectedSet],
    requestedExtra: amount
      ? Math.min(1000, Number(amount[1]))
      : initial.requestedExtra,
    checkingBuffer: buffer ? Number(buffer[1]) : initial.checkingBuffer,
  };
}
