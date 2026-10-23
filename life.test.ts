import test from "node:test";
import assert from "node:assert/strict";
import { initialGoal, balance } from "./fixtures";
import { defaultPreferences, emptyAdjustments } from "./model";
import {
  initialLifeState,
  generateFeasiblePaths,
  validateFuture,
  simulateLifeEvent,
  interpretExample,
  type LifeRequest,
} from "./life";
import { runLifeAgent } from "./life-agent";
import { makeServer } from "./server";
const base = (): LifeRequest => ({
  request: "Keep dining unchanged. Find another way.",
  goal: initialGoal,
  preferences: defaultPreferences(),
  state: initialLifeState(),
});
const interpret = (request: string, state = initialLifeState()) =>
  interpretExample({ ...base(), request, state });
const flagship =
  "I have a wedding next month and need an extra $200. I don’t want to cut dining because that is how I see friends.";
test("flagship: distinct feasible paths preserve dining and an explicit checking assumption", () => {
  const { state } = interpret(flagship.replace("don’t", "don't"));
  assert.deepEqual(state.event, {
    name: "Wedding",
    amount: 200,
    month: 1,
    funding: "checking",
  });
  assert.ok(state.protectedCategories.includes("Dining"));
  const paths = generateFeasiblePaths(initialGoal, defaultPreferences(), state);
  assert.ok(paths.length >= 2);
  assert.ok(new Set(paths.map((p) => p.months)).size >= 2);
  assert.equal(paths[0].projection.monthly, 120);
  assert.equal(paths.at(-1)!.projection.monthly, 60);
  for (const p of paths) {
    assert.equal(p.adjustments.Dining, 0);
    assert.ok(p.projection.projected >= 1000);
    assert.equal(p.points[0], 400);
    assert.equal(p.points.at(-1), p.projection.projected);
    validateFuture(
      initialGoal,
      defaultPreferences(),
      state,
      p.adjustments,
      p.months,
    );
  }
});
test("funding sources have different outcomes and never silently withdraw", () => {
  const state = interpret(flagship).state;
  const a = { ...emptyAdjustments(), Shopping: 60 };
  const checking = simulateLifeEvent(initialGoal, state, a, 5);
  const savings = simulateLifeEvent(
    initialGoal,
    { ...state, event: { ...state.event!, funding: "savings" } },
    a,
    5,
  );
  const vacation = simulateLifeEvent(
    initialGoal,
    { ...state, event: { ...state.event!, funding: "vacation" } },
    a,
    5,
  );
  assert.equal(checking.projected, 1000);
  assert.equal(savings.projected, 800);
  assert.equal(savings.fundingValid, false);
  assert.equal(vacation.projected, 800);
  assert.equal(vacation.fundingValid, true);
  assert.ok(
    generateFeasiblePaths(initialGoal, defaultPreferences(), {
      ...state,
      event: { ...state.event!, funding: "savings" },
    }).every((p) => p.projection.monthly >= 200),
  );
  assert.equal(
    generateFeasiblePaths(initialGoal, defaultPreferences(), {
      ...state,
      event: { ...state.event!, amount: balance, funding: "checking" },
    }).length,
    0,
  );
});
test("A–F: protections, event, hard deadline, correction, contradiction, impossibility", async () => {
  const a = await runLifeAgent(base());
  assert.ok(a.state.protectedCategories.includes("Dining"));
  assert.ok(a.scenarios.every((p) => p.adjustments.Dining === 0));
  const b = await runLifeAgent({
    ...base(),
    request: "I have a $200 wedding expense next month.",
  });
  assert.equal(b.state.event?.amount, 200);
  assert.equal(b.state.event?.funding, "checking");
  const c = await runLifeAgent({
    ...base(),
    request:
      "Don't touch groceries or dining. I want to keep my vacation date.",
  });
  assert.ok(c.state.deadlineHard);
  assert.ok(
    c.scenarios.every((p) => p.months === 5 && p.adjustments.Dining === 0),
  );
  const d = await runLifeAgent({
    ...base(),
    state: b.state,
    request: "Actually, the wedding is in December.",
  });
  assert.equal(d.state.event?.month, 2);
  assert.equal(d.state.event?.amount, 200);
  const e = await runLifeAgent({
    ...base(),
    request: "Never reduce dining. Cut dining by $100.",
  });
  assert.ok(e.clarification);
  assert.equal(e.scenarios.length, 0);
  const f = await runLifeAgent({
    ...base(),
    request: "I want to save $10,000 by tomorrow without changing anything.",
  });
  assert.equal(f.scenarios.length, 0);
  assert.match(f.summary, /not leave a feasible/);
  const removal = await runLifeAgent({
    ...base(),
    state: d.state,
    request: "Never mind, forget the wedding expense.",
  });
  assert.equal(removal.state.event, null);
});
test("multi-turn shopping correction preserves wedding, dining and exact reduction", () => {
  const state = interpret(flagship).state;
  const correction = interpret(
    "Actually, I could reduce shopping by $30, but I don’t want to change my vacation date.".replace(
      "don’t",
      "don't",
    ),
    state,
  ).state;
  assert.deepEqual(correction.event, state.event);
  assert.equal(correction.shoppingReduction, 30);
  assert.equal(correction.deadlineHard, true);
  const paths = generateFeasiblePaths(
    initialGoal,
    defaultPreferences(),
    correction,
  );
  assert.equal(paths.length, 1);
  assert.equal(paths[0].adjustments.Shopping, 30);
  assert.equal(paths[0].adjustments.Dining, 0);
  assert.equal(paths[0].months, 5);
});
test("financial validation rejects protected categories, negative budgets and impossible projections", () => {
  const state = interpret(flagship).state;
  assert.throws(() =>
    validateFuture(
      initialGoal,
      defaultPreferences(),
      state,
      { ...emptyAdjustments(), Dining: 100 },
      5,
    ),
  );
  assert.throws(() =>
    validateFuture(
      initialGoal,
      defaultPreferences(),
      state,
      { ...emptyAdjustments(), Shopping: -1 },
      5,
    ),
  );
  assert.throws(() =>
    validateFuture(
      initialGoal,
      defaultPreferences(),
      state,
      emptyAdjustments(),
      5,
    ),
  );
  assert.equal(
    generateFeasiblePaths(initialGoal, defaultPreferences(), {
      ...state,
      protectedCategories: [
        "Dining",
        "Groceries",
        "Bills",
        "Entertainment",
        "Shopping",
        "Subscriptions",
      ],
      deadlineHard: true,
    }).length,
    0,
  );
});
function mock(
  state: ReturnType<typeof initialLifeState>,
  clarification: string | null = null,
  skipTools = false,
) {
  let step = 0;
  const names = skipTools
    ? []
    : [
        "get_financial_context",
        "analyze_adjustable_spending",
        "generate_feasible_paths",
      ];
  return async (_payload: Record<string, unknown>) => {
    const name = names[step++];
    return name
      ? {
          output: [
            {
              type: "function_call",
              name,
              call_id: `call-${step}`,
              arguments: JSON.stringify(
                name === "get_financial_context" ? {} : { state },
              ),
            },
          ],
        }
      : {
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    summary: "Your priorities are reflected in these options.",
                    clarification,
                  }),
                },
              ],
            },
          ],
        };
  };
}
test("mocked live tool loop grounds A–D and preserves context", async () => {
  for (const request of [
    base().request,
    "I have a $200 wedding expense next month.",
    "Don't touch groceries or dining. I want to keep my vacation date.",
  ]) {
    const input = { ...base(), request };
    const state = interpretExample(input).state;
    const result = await runLifeAgent(input, mock(state));
    assert.equal(result.source, "live");
    assert.equal(result.tools.length, 3);
    assert.deepEqual(result.state, state);
  }
  const state = interpret(flagship).state;
  const input = {
    ...base(),
    state,
    request: "Actually, the wedding is in December.",
  };
  const result = await runLifeAgent(input, mock(interpretExample(input).state));
  assert.equal(result.source, "live");
  assert.equal(result.state.event?.month, 2);
  assert.equal(result.state.event?.amount, 200);
});
test("mocked E–F, tool bypass, malformed output and service failure are safe", async () => {
  const invented = await runLifeAgent(base(),mock({...initialLifeState(),shoppingReduction:80}));
  assert.equal(invented.source,"fallback");
  assert.equal(invented.state.shoppingReduction,null);
  const contradiction = {
    ...base(),
    request: "Never reduce dining. Cut dining by $100.",
  };
  const e = await runLifeAgent(
    contradiction,
    mock(
      interpretExample(contradiction).state,
      "Should dining stay protected?",
    ),
  );
  assert.equal(e.source, "live");
  assert.ok(e.clarification);
  assert.equal(e.scenarios.length, 0);
  const impossible = {
    ...base(),
    request: "I want to save $10,000 by tomorrow without changing anything.",
  };
  const f = await runLifeAgent(
    impossible,
    mock(interpretExample(impossible).state),
  );
  assert.equal(f.source, "live");
  assert.equal(f.scenarios.length, 0);
  const bypass = await runLifeAgent(
    base(),
    mock(initialLifeState(), null, true),
  );
  assert.equal(bypass.source, "fallback");
  const malformed = await runLifeAgent(base(), async () => ({ output: [] }));
  assert.equal(malformed.source, "fallback");
  const failed = await runLifeAgent(base(), async () => {
    throw new Error("offline");
  });
  assert.equal(failed.source, "fallback");
});
test("life HTTP endpoint validates boundary and returns structured example", async () => {
  const server = makeServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const root = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const invalid = await fetch(root + "/api/life", {
      method: "POST",
      body: "{}",
    });
    assert.equal(invalid.status, 400);
    const response = await fetch(root + "/api/life", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...base(), request: flagship, example: true }),
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.ok(result.scenarios.length >= 2);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("direct constraints respect buffers, exact cents and fund completion after withdrawals", () => {
  const state = interpret(flagship).state;
  const stricter = { ...defaultPreferences(), checkingBuffer: 8300 };
  assert.equal(generateFeasiblePaths(initialGoal, stricter, state).length, 0);
  const fractional = generateFeasiblePaths(
    { ...initialGoal, target: 1000.01 },
    defaultPreferences(),
    state,
  );
  assert.ok(fractional.length >= 2);
  for (const path of fractional) {
    assert.ok(path.projection.projected >= 1000.01);
    assert.equal(path.points.at(-1), path.projection.projected);
  }
  const funded = {
    ...state,
    event: {
      ...state.event!,
      funding: "vacation" as const,
      month: 3,
      amount: 500,
    },
  };
  const paths = generateFeasiblePaths(
    initialGoal,
    defaultPreferences(),
    funded,
  );
  assert.ok(paths.length);
  for (const path of paths) {
    const checkpoint = path.projection.monthsToGoal!;
    assert.ok(checkpoint >= 3);
    assert.ok(path.points[checkpoint] >= 1000);
    assert.equal(path.projection.progress, 100);
  }
});

test("later paths with identical spending changes are not presented as distinct choices", () => {
  const state = { ...initialLifeState(), shoppingReduction: 80 };
  const paths = generateFeasiblePaths(initialGoal, defaultPreferences(), state);
  for (const path of paths)
    assert.ok(
      !paths.some(
        (other) =>
          other.months < path.months &&
          JSON.stringify(other.adjustments) ===
            JSON.stringify(path.adjustments),
      ),
    );
});

test("fractional monetary values retain cents in comparisons", async () => {
  const { money } = await import("./finance");
  assert.equal(money(133.34), "$133.34");
  assert.equal(money(120), "$120");
});
