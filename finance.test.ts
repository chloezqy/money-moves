import test from "node:test";
import assert from "node:assert/strict";
import {
  spendingAnalysis,
  project,
  calculateSuggestion,
  makeScenario,
} from "./finance";
import { initialGoal, ledger } from "./fixtures";
import { defaultPreferences, emptyAdjustments } from "./model";
test("synthetic ledger supports the visible insight across five months", () => {
  const a = spendingAnalysis();
  assert.ok(
    ledger.every((t) => Number.isFinite(Date.parse(t.date + "T12:00:00Z"))),
  );
  assert.equal(a.current, 320);
  assert.equal(a.typical, 200);
  assert.equal(a.difference, 120);
  assert.equal(a.currentCount, 15);
  assert.equal(a.typicalCount, 10);
  assert.equal(a.extraCount, 5);
  assert.equal(
    a.contributing.reduce((sum, t) => sum + t.amount, 0),
    120,
  );
  assert.equal(new Set(ledger.map((t) => t.category)).size, 7);
  assert.equal(new Set(ledger.map((t) => t.date.slice(0, 7))).size, 5);
});
test("goal arithmetic uses scheduled saving plus scenario reductions", () => {
  const base = project(initialGoal, emptyAdjustments());
  assert.equal(base.projected, 700);
  assert.equal(base.gap, 300);
  assert.equal(base.needed, 60);
  const full = project(initialGoal, { ...emptyAdjustments(), Dining: 60 });
  assert.equal(full.projected, 1000);
  assert.equal(full.gap, 0);
  assert.equal(full.goalDate, "2027-03-23");
  const lower = project(initialGoal, {
    ...emptyAdjustments(),
    Entertainment: 55,
  });
  assert.equal(lower.projected, 975);
  assert.equal(lower.gap, 25);
  assert.equal(lower.monthsToGoal, 6);
});
test("constraints are enforced independently of model prose", () => {
  const prefs = {
    ...defaultPreferences(),
    protectedCategories: [
      ...defaultPreferences().protectedCategories,
      "Dining" as const,
    ],
  };
  assert.throws(() =>
    makeScenario(initialGoal, { ...emptyAdjustments(), Dining: 10 }, prefs),
  );
  assert.throws(() =>
    makeScenario(
      initialGoal,
      { ...emptyAdjustments(), Dining: 125 },
      defaultPreferences(),
    ),
  );
  assert.throws(() =>
    makeScenario(
      initialGoal,
      { ...emptyAdjustments(), Dining: -1 },
      defaultPreferences(),
    ),
  );
  assert.throws(() =>
    makeScenario(initialGoal, emptyAdjustments(), {
      ...defaultPreferences(),
      checkingBuffer: 9000,
    }),
  );
  const s = calculateSuggestion(initialGoal, prefs, "dining");
  assert.equal(s.adjustments.Dining, 0);
  assert.equal(s.projection.projected, 1000);
});
test("all categories protected returns an honest shortfall", () => {
  const s = calculateSuggestion(initialGoal, {
    ...defaultPreferences(),
    protectedCategories: [
      "Dining",
      "Entertainment",
      "Subscriptions",
      "Shopping",
      "Groceries",
      "Bills",
    ],
  });
  assert.equal(s.projection.extra, 0);
  assert.equal(s.projection.gap, 300);
});
