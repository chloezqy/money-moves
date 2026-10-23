import test from "node:test";
import assert from "node:assert/strict";
import { runGoalAgent } from "./agent";
import { initialGoal } from "./fixtures";
import { defaultPreferences, emptyAdjustments } from "./model";
import { makeServer } from "./server";
const request = {
  request: "Keep dining unchanged. Find another way.",
  goal: initialGoal,
  preferences: defaultPreferences(),
};
const amounts = { ...emptyAdjustments(), Entertainment: 60 };
const result = {
  summary: "Dining stays unchanged.",
  constraints: ["Dining protected"],
  scenarios: [
    {
      title: "Keep your meals out",
      adjustments: amounts,
      rationale: "Make room in entertainment.",
      tradeoffs: ["Fewer entertainment purchases."],
    },
  ],
  protectedCategories: ["Groceries", "Bills", "Dining"],
  checkingBuffer: 500,
  limitations: ["Future cash flow is not modeled."],
};
function mockAgent(final: unknown = result, simulation = amounts) {
  let step = 0;
  const payloads: Record<string, unknown>[] = [];
  return {
    payloads,
    transport: async (payload: Record<string, unknown>) => {
      payloads.push(structuredClone(payload));
      const name = [
        "analyze_spending",
        "find_adjustable_categories",
        "get_goal_projection",
        "simulate_scenario",
      ][step++];
      return name
        ? {
            output: [
              {
                type: "function_call",
                name,
                call_id: `call-${step}`,
                arguments: JSON.stringify(
                  name === "simulate_scenario"
                    ? {
                        adjustments: simulation,
                        protectedCategories: ["Dining"],
                        checkingBuffer: 500,
                      }
                    : {},
                ),
              },
            ],
          }
        : {
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: JSON.stringify(final) }],
              },
            ],
          };
    },
  };
}
test("real agent loop executes tools and returns a recalculated structured scenario", async () => {
  const mock = mockAgent();
  const response = await runGoalAgent(request, mock.transport);
  assert.equal(response.source, "live");
  assert.equal(response.scenarios[0].projection.projected, 1000);
  assert.equal(response.scenarios[0].adjustments.Dining, 0);
  assert.equal(mock.payloads.length, 5);
  assert.equal(response.toolActivity.length, 4);
  assert.ok(JSON.stringify(mock.payloads[4]).includes("function_call_output"));
});
test("malformed output, API error, and unsimulated output fall back safely", async () => {
  const malformed = await runGoalAgent(
    request,
    mockAgent({ summary: "bad" }).transport,
  );
  assert.equal(malformed.source, "fallback");
  const unavailable = await runGoalAgent(request, async () => {
    throw new Error("503");
  });
  assert.equal(unavailable.source, "fallback");
  const changed = structuredClone(result);
  changed.scenarios[0].adjustments.Entertainment = 55;
  const unsimulated = await runGoalAgent(request, mockAgent(changed).transport);
  assert.equal(unsimulated.source, "fallback");
  assert.equal(unsimulated.scenarios[0].adjustments.Dining, 0);
});
test("protected-category violations cannot become live recommendations", async () => {
  const changed = structuredClone(result);
  changed.scenarios[0].adjustments = { ...emptyAdjustments(), Dining: 60 };
  const response = await runGoalAgent(
    request,
    mockAgent(changed, changed.scenarios[0].adjustments).transport,
  );
  assert.equal(response.source, "fallback");
  assert.equal(response.scenarios[0].adjustments.Dining, 0);
});
test("no key uses an explicitly labeled deterministic example", async () => {
  const response = await runGoalAgent({
    ...request,
    request: "No subscription changes. Save $55 a month.",
  });
  assert.equal(response.source, "example");
  assert.equal(response.scenarios[0].projection.extra, 55);
  assert.ok(response.preferences.protectedCategories.includes("Subscriptions"));
  const noPlan = await runGoalAgent({
    ...request,
    request: "Keep a $9000 checking buffer",
  });
  assert.equal(noPlan.scenarios.length, 0);
  await assert.rejects(() =>
    runGoalAgent({ ...request, goal: { ...initialGoal, months: 0 } }),
  );
});
test("HTTP boundary keeps configuration secret and rejects invalid requests", async () => {
  const server = makeServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address() as { port: number };
  const root = `http://127.0.0.1:${address.port}`;
  try {
    const config = await fetch(root + "/api/config").then((r) => r.json());
    assert.deepEqual(Object.keys(config), ["mode"]);
    const bad = await fetch(root + "/api/plan", { method: "POST", body: "{}" });
    assert.equal(bad.status, 400);
    const origin = await fetch(root + "/api/plan", {
      method: "POST",
      headers: { Origin: "https://untrusted.example" },
      body: JSON.stringify(request),
    });
    assert.equal(origin.status, 403);
  } finally {
    await new Promise<void>((r, e) =>
      server.close((err) => (err ? e(err) : r())),
    );
  }
});
