import type { LifeState } from "./life";
import { z } from "zod";
export const categorySchema = z.enum([
  "Dining",
  "Groceries",
  "Transport",
  "Entertainment",
  "Subscriptions",
  "Shopping",
  "Bills",
]);
export type Category = z.infer<typeof categorySchema>;
export const adjustable = [
  "Dining",
  "Entertainment",
  "Subscriptions",
  "Shopping",
] as const;
export type AdjustableCategory = (typeof adjustable)[number];
export const caps: Record<AdjustableCategory, number> = {
  Dining: 120,
  Entertainment: 60,
  Subscriptions: 30,
  Shopping: 80,
};
export const adjustmentSchema = z
  .object({
    Dining: z.number().min(0).max(120),
    Entertainment: z.number().min(0).max(60),
    Subscriptions: z.number().min(0).max(30),
    Shopping: z.number().min(0).max(80),
  })
  .strict();
export type Adjustments = z.infer<typeof adjustmentSchema>;
export const emptyAdjustments = (): Adjustments => ({
  Dining: 0,
  Entertainment: 0,
  Subscriptions: 0,
  Shopping: 0,
});
export const goalSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    saved: z.number().min(0),
    target: z.number().positive().max(100000),
    months: z.number().int().min(1).max(60),
    base: z.number().nonnegative().max(10000),
  })
  .strict()
  .refine((g) => g.target > g.saved, "Target must exceed saved amount");
export type Goal = z.infer<typeof goalSchema>;
export const preferenceSchema = z
  .object({
    protectedCategories: z.array(categorySchema).max(7),
    checkingBuffer: z.number().min(0).max(100000),
    requestedExtra: z.number().min(0).max(1000).nullable(),
  })
  .strict();
export type Preferences = z.infer<typeof preferenceSchema>;
export const defaultPreferences = (): Preferences => ({
  protectedCategories: ["Groceries", "Bills"],
  checkingBuffer: 500,
  requestedExtra: null,
});
export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  category: Category;
  amount: number;
  contributing?: boolean;
}
export interface Projection {
  extra: number;
  monthly: number;
  projected: number;
  gap: number;
  surplus: number;
  needed: number;
  progress: number;
  monthsToGoal: number | null;
  goalDate: string | null;
  targetDate: string;
  baseline: number;
}
export interface Scenario {
  life?: LifeState;
  months?: number;
  points?: number[];
  feasible?: boolean;
  id: string;
  title: string;
  adjustments: Adjustments;
  rationale: string;
  tradeoffs: string[];
  evidence: string[];
  projection: Projection;
  source: "calculated" | "ai";
}
export interface ActivePlan {
  scenario: Scenario;
  preferences: Preferences;
  reminder: boolean;
  day: string;
  status: "active" | "paused";
  activatedAt: string;
}
export const requestSchema = z
  .object({
    request: z.string().trim().min(1).max(1000),
    goal: goalSchema,
    preferences: preferenceSchema,
    context: z.string().max(300).optional(),
  })
  .strict();
export type PlanRequest = z.infer<typeof requestSchema>;
export const agentResponseSchema = z
  .object({
    summary: z.string().max(500),
    constraints: z.array(z.string().max(150)).max(12),
    scenarios: z
      .array(
        z
          .object({
            title: z.string().min(1).max(80),
            adjustments: adjustmentSchema,
            rationale: z.string().max(500),
            tradeoffs: z.array(z.string().max(200)).max(6),
          })
          .strict(),
      )
      .min(1)
      .max(2),
    protectedCategories: z.array(categorySchema).max(7),
    checkingBuffer: z.number().min(0).max(100000),
    limitations: z.array(z.string().max(200)).max(8),
  })
  .strict();
export interface PlanningResponse {
  source: "live" | "example" | "fallback";
  summary: string;
  constraints: string[];
  preferences: Preferences;
  scenarios: Scenario[];
  limitations: string[];
  toolActivity: string[];
  reason?: string;
}
