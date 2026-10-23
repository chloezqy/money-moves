import { z } from "zod";
import {
  categorySchema,
  adjustable,
  caps,
  emptyAdjustments,
  goalSchema,
  preferenceSchema,
  type Goal,
  type Preferences,
  type Scenario,
  type Adjustments,
} from "./model";
import { addMonths, makeScenario, money, validateScenario } from "./finance";
import { asOf, balance, currentTotals, ledger } from "./fixtures";

export const lifeStateSchema = z
  .object({
    protectedCategories: z.array(categorySchema).max(7),
    event: z
      .object({
        name: z.string().min(1).max(60),
        amount: z.number().positive().max(100000),
        month: z.number().int().min(1).max(60),
        funding: z.enum(["checking", "savings", "vacation"]),
      })
      .strict()
      .nullable(),
    deadlineHard: z.boolean(),
    shoppingReduction: z.number().min(0).max(80).nullable(),
    target: z.number().positive().max(100000).nullable(),
    horizon: z.number().int().min(0).max(60).nullable(),
  })
  .strict();
export type LifeState = z.infer<typeof lifeStateSchema>;
export const initialLifeState = (): LifeState => ({
  protectedCategories: ["Groceries", "Bills"],
  event: null,
  deadlineHard: false,
  shoppingReduction: null,
  target: null,
  horizon: null,
});
export const lifeRequestSchema = z
  .object({
    request: z.string().trim().min(1).max(1000),
    goal: goalSchema,
    preferences: preferenceSchema,
    state: lifeStateSchema,
    example: z.boolean().optional(),
  })
  .strict();
export type LifeRequest = z.infer<typeof lifeRequestSchema>;
export interface FutureScenario extends Scenario {
  life: LifeState;
  months: number;
  points: number[];
  feasible: boolean;
}
export interface LifeResult {
  source: "live" | "example" | "fallback";
  state: LifeState;
  scenarios: FutureScenario[];
  summary: string;
  clarification: string | null;
  tools: string[];
  limitations: string[];
}
export const limitations = [
  "Monthly estimates from synthetic data as of October 23, 2026; not a daily cash-flow forecast.",
  "October spending covers days 1–23, not a full-month baseline. Reductions are illustrative and capped.",
  "No interest, income changes, automatic transfers, or notifications are modeled.",
];
export function financialContext(goal: Goal) {
  return {
    asOf,
    goal,
    checking: balance,
    currentTotals,
    transactions: ledger,
    caps,
    period: "October 1–23; historical June–September",
  };
}
export function adjustableSpending(state: LifeState) {
  return adjustable.map((category) => ({
    category,
    observed: currentTotals[category],
    maximumReduction: state.protectedCategories.includes(category)
      ? 0
      : caps[category],
  }));
}
const cents = (n: number) => Math.round(n * 100);
export function simulateLifeEvent(
  goal: Goal,
  state: LifeState,
  adjustments: Adjustments,
  months: number,
) {
  const monthly = cents(
    goal.base + Object.values(adjustments).reduce((a, b) => a + b, 0),
  );
  const event = state.event;
  let value = cents(goal.saved);
  const points = [goal.saved];
  let fundingValid =
    !event || event.funding !== "checking" || balance >= event.amount;
  for (let m = 1; m <= months; m++) {
    let contribution = monthly;
    if (event?.month === m && event.funding !== "checking") {
      if (event.funding === "savings" && cents(event.amount) > monthly)
        fundingValid = false;
      contribution -= cents(event.amount);
    }
    value += contribution;
    if (value < 0) fundingValid = false;
    points.push(value / 100);
  }
  return {
    points,
    monthly: monthly / 100,
    projected: value / 100,
    fundingValid,
  };
}
export function validateFuture(
  goal: Goal,
  preferences: Preferences,
  state: LifeState,
  adjustments: Adjustments,
  months: number,
) {
  validateScenario(adjustments, {
    ...preferences,
    protectedCategories: [
      ...new Set([
        ...preferences.protectedCategories,
        ...state.protectedCategories,
      ]),
    ],
  });
  if (state.deadlineHard && months !== (state.horizon ?? goal.months))
    throw new Error("Deadline is protected");
  if (
    state.shoppingReduction !== null &&
    adjustments.Shopping !== state.shoppingReduction
  )
    throw new Error("Shopping constraint changed");
  if (
    state.event?.funding === "checking" &&
    balance - state.event.amount < preferences.checkingBuffer
  )
    throw new Error("Checking buffer violated");
  const result = simulateLifeEvent(goal, state, adjustments, months);
  if (!result.fundingValid || result.projected < (state.target ?? goal.target))
    throw new Error("This future is not feasible");
  return result;
}
function allocate(extra: number, state: LifeState): Adjustments | null {
  const result = emptyAdjustments();
  if (state.shoppingReduction !== null) {
    if (
      state.protectedCategories.includes("Shopping") &&
      state.shoppingReduction > 0
    )
      return null;
    result.Shopping = state.shoppingReduction;
  }
  let left = Math.max(0, extra - result.Shopping);
  for (const c of [
    "Shopping",
    "Entertainment",
    "Subscriptions",
    "Dining",
  ] as const) {
    if (
      state.protectedCategories.includes(c) ||
      (c === "Shopping" && state.shoppingReduction !== null)
    )
      continue;
    result[c] = Math.min(caps[c], Math.ceil(left * 100) / 100);
    left = Math.max(0, left - result[c]);
  }
  return left > 0.001 ? null : result;
}
export function generateFeasiblePaths(
  goal: Goal,
  preferences: Preferences,
  raw: LifeState,
): FutureScenario[] {
  const state = lifeStateSchema.parse(raw);
  state.protectedCategories = [
    ...new Set([
      ...state.protectedCategories,
      ...preferences.protectedCategories,
    ]),
  ];
  const horizon = state.horizon ?? goal.months;
  const target = state.target ?? goal.target;
  if (!horizon || target <= goal.saved) return [];
  const p = { ...preferences, protectedCategories: state.protectedCategories };
  const build = (
    months: number,
    extra: number,
    title: string,
  ): FutureScenario | null => {
    const adjustments = allocate(extra, state);
    if (!adjustments) return null;
    try {
      const sim = validateFuture(goal, p, state, adjustments, months);
      const base = makeScenario(
        { ...goal, months, target },
        adjustments,
        p,
        title,
      );
      // Completion must remain valid after the final modeled withdrawal.
      const finalImpactMonth =
        state.event &&
        state.event.funding !== "checking" &&
        state.event.month <= months
          ? state.event.month
          : 0;
      const completionMonth = sim.points.findIndex(
        (value, month) => month >= finalImpactMonth && value >= target,
      );
      const gapAtDate = Math.max(0, target - sim.projected);
      return {
        ...base,
        id: `life-${months}-${Object.values(adjustments).join("-")}`,
        life: state,
        months,
        points: sim.points,
        feasible: true,
        projection: {
          ...base.projection,
          projected: sim.projected,
          progress: Math.min(100, (sim.projected / target) * 100),
          gap: gapAtDate,
          surplus: Math.max(0, sim.projected - target),
          goalDate: addMonths(completionMonth),
          targetDate: addMonths(months),
          monthsToGoal: completionMonth,
          baseline: simulateLifeEvent(goal, state, emptyAdjustments(), months)
            .projected,
        },
        rationale:
          title === "Keep your date"
            ? "Make room in eligible spending to protect your original timeline."
            : title === "Keep your lifestyle"
              ? "Give your goal more time while keeping your spending close to today."
              : "A smaller spending change, with a little more time.",
        tradeoffs: [
          months === horizon
            ? "Original deadline preserved."
            : `${months - horizon} additional months before your planned goal date.`,
          Object.values(adjustments).some((n) => n > 0)
            ? "Spending reductions need to be saved consistently."
            : "No new category reductions.",
          state.event
            ? `${state.event.name}: ${money(state.event.amount)} funded from ${state.event.funding === "checking" ? "checking; goal savings stay intact" : state.event.funding === "savings" ? "that month’s contribution; no fund withdrawal" : "a one-time Vacation Fund withdrawal"}.`
            : "No additional life-event expense.",
        ],
        evidence: adjustable
          .filter((c) => adjustments[c] > 0)
          .map(
            (c) =>
              `${c}: ${money(currentTotals[c])} observed Oct 1–23; ${money(adjustments[c])} proposed monthly reduction (cap ${money(caps[c])}).`,
          ),
      };
    } catch {
      return null;
    }
  };
  const required = (months: number) => {
    const expense =
      state.event &&
      state.event.funding !== "checking" &&
      state.event.month <= months
        ? state.event.amount
        : 0;
    return Math.max(
      0,
      Math.ceil(((target - goal.saved + expense) / months - goal.base) * 100) /
        100,
      state.event?.funding === "savings" && state.event.month <= months
        ? state.event.amount - goal.base
        : 0,
    );
  };
  const paths: FutureScenario[] = [];
  const date = build(horizon, required(horizon), "Keep your date");
  if (date) paths.push(date);
  if (!state.deadlineHard) {
    const lifestyleExtra = state.shoppingReduction ?? 0;
    for (let m = horizon + 1; m <= 60; m++) {
      const candidate = build(m, lifestyleExtra, "Keep your lifestyle");
      if (candidate) {
        paths.push(candidate);
        break;
      }
    }
    if (paths.length < 2 || paths[1].months - horizon > 2) {
      const balanced = build(
        horizon + 1,
        required(horizon + 1),
        "A balanced path",
      );
      if (balanced && !paths.some((p) => p.id === balanced.id))
        paths.splice(1, 0, balanced);
    }
  }
  return paths;
}

// Deliberately limited, labeled parser for demos. Live interpretation is model-driven.
export function interpretExample(input: LifeRequest): {
  state: LifeState;
  clarification: string | null;
} {
  const state = structuredClone(input.state);
  const text = input.request.replaceAll("’", "'");
  const categories = categorySchema.options;
  for (const c of categories) {
    if (
      text
        .split(/[.!?;]|\bbut\b/i)
        .some(
          (clause) =>
            new RegExp(c, "i").test(clause) &&
            /keep|protect|don.t|unchanged|never|friends|touch/i.test(clause),
        )
    )
      state.protectedCategories = [
        ...new Set([...state.protectedCategories, c]),
      ];
  }
  for (const c of state.protectedCategories) {
    if (
      new RegExp(`(?:cut|reduce)\\s+${c}(?:\\s+by)?\\s*\\$?\\d+`, "i").test(
        text,
      )
    )
      return {
        state,
        clarification: `${c} is protected. Should it stay unchanged, or may we reduce it? Remove its protection to allow a reduction.`,
      };
  }
  if (/forget|never mind|remove.*expense/i.test(text)) state.event = null;
  else if (/wedding|expense|unexpected/i.test(text)) {
    const amount = text.match(/\$([\d,]+(?:\.\d{1,2})?)/);
    if (!amount && !state.event)
      return { state, clarification: "How much is the upcoming expense?" };
    state.event = {
      name: /wedding/i.test(text) ? "Wedding" : "Unexpected expense",
      amount: amount
        ? Number(amount[1].replaceAll(",", ""))
        : state.event!.amount,
      month: state.event?.month ?? 1,
      funding: state.event?.funding ?? "checking",
    };
  }
  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const month = monthNames.findIndex((m) => text.toLowerCase().includes(m));
  if (state.event && month >= 0)
    state.event.month = (month - 9 + 12) % 12 || 12;
  if (state.event && /next month/i.test(text)) state.event.month = 1;
  if (state.event && /checking/i.test(text)) state.event.funding = "checking";
  if (
    state.event &&
    /withdraw|vacation fund/i.test(text) &&
    /pay|fund|withdraw/i.test(text)
  )
    state.event.funding = "vacation";
  if (state.event && /reduc.*contribution|available savings/i.test(text))
    state.event.funding = "savings";
  const shopping = text.match(
    /(?:shopping\s*(?:by)?\s*\$|\$(?=[\d.]+.*shopping))([\d.]+)/i,
  );
  if (shopping) state.shoppingReduction = Math.min(80, Number(shopping[1]));
  if (/keep.*(?:vacation|goal).*date|don.t.*change.*date|deadline/i.test(text))
    state.deadlineHard = true;
  if (/push|later|more time|flexible/i.test(text)) state.deadlineHard = false;
  if (/tomorrow/i.test(text)) {
    state.horizon = 0;
    state.deadlineHard = true;
  }
  if (/save\s*\$[\d,]+.*tomorrow/i.test(text))
    state.target = Number(
      text.match(/save\s*\$([\d,]+)/i)![1].replaceAll(",", ""),
    );
  return { state, clarification: null };
}
export function comparePaths(paths: FutureScenario[]) {
  return paths.map((p) => ({
    id: p.id,
    title: p.title,
    date: p.projection.targetDate,
    monthly: p.projection.monthly,
    adjustments: p.adjustments,
    feasible: p.feasible,
    tradeoffs: p.tradeoffs,
  }));
}
