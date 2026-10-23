import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { runLifeAgent } from "./life-agent";
import { openAITransport } from "./agent";
import { initialGoal } from "./fixtures";
import { defaultPreferences } from "./model";
import { initialLifeState } from "./life";
if (existsSync(".env")) process.loadEnvFile(".env");
const key = process.env.OPENAI_API_KEY;
test(
  "live OpenAI: A–F and multi-turn context (no fallback accepted)",
  { skip: !key, timeout: 180000 },
  async (t) => {
    const transport = openAITransport(
      key!,
      process.env.OPENAI_MODEL || "gpt-4.1-mini",
    );
    const input = {
      goal: initialGoal,
      preferences: defaultPreferences(),
      state: initialLifeState(),
      request: "",
    };
    let eventState = initialLifeState();
    await t.test("A: protected dining", async () => {
      const r = await runLifeAgent(
        { ...input, request: "Keep dining unchanged. Find another way." },
        transport,
      );
      assert.equal(r.source, "live");
      assert.ok(r.state.protectedCategories.includes("Dining"));
      assert.ok(r.scenarios.length);
      assert.ok(r.scenarios.every((p) => p.adjustments.Dining === 0));
    });
    await t.test("B: wedding with visible funding assumption", async () => {
      const r = await runLifeAgent(
        { ...input, request: "I have a $200 wedding expense next month." },
        transport,
      );
      assert.equal(r.source, "live");
      assert.equal(r.state.event?.amount, 200);
      assert.equal(r.state.event?.month, 1);
      assert.ok(r.state.event?.funding || r.clarification);
      eventState = r.state;
    });
    await t.test("C: protected essentials and fixed deadline", async () => {
      const r = await runLifeAgent(
        {
          ...input,
          request:
            "Don't touch groceries or dining. I want to keep my vacation date.",
        },
        transport,
      );
      assert.equal(r.source, "live");
      assert.ok(r.state.protectedCategories.includes("Groceries"));
      assert.ok(r.state.protectedCategories.includes("Dining"));
      assert.ok(r.state.deadlineHard);
      assert.ok(r.scenarios.length);
      assert.ok(
        r.scenarios.every((p) => p.months === 5 && p.adjustments.Dining === 0),
      );
    });
    await t.test(
      "D: December correction updates previous wedding",
      async () => {
        assert.ok(eventState.event);
        const r = await runLifeAgent(
          {
            ...input,
            state: eventState,
            request: "Actually, the wedding is in December.",
          },
          transport,
        );
        assert.equal(r.source, "live");
        assert.equal(r.state.event?.month, 2);
        assert.equal(r.state.event?.amount, 200);
      },
    );
    await t.test("E: contradiction requests clarification", async () => {
      const r = await runLifeAgent(
        { ...input, request: "Never reduce dining. Cut dining by $100." },
        transport,
      );
      assert.equal(r.source, "live");
      assert.ok(r.clarification);
      assert.equal(r.scenarios.length, 0);
    });
    await t.test("F: impossible target is infeasible", async () => {
      const r = await runLifeAgent(
        {
          ...input,
          request:
            "I want to save $10,000 by tomorrow without changing anything.",
        },
        transport,
      );
      assert.equal(r.source, "live");
      assert.equal(r.scenarios.length, 0);
      assert.equal(r.clarification, null);
    });
    await t.test(
      "G: flagship and shopping follow-up preserve the same event",
      async () => {
        const first = await runLifeAgent(
          {
            ...input,
            request:
              "I have a wedding next month and need an extra $200. I don't want to cut dining because that's how I spend time with friends. Can I still reach my vacation goal?",
          },
          transport,
        );
        assert.equal(first.source, "live");
        assert.equal(first.state.event?.amount, 200);
        assert.ok(first.state.protectedCategories.includes("Dining"));
        assert.ok(first.scenarios.length >= 2);
        const followup = await runLifeAgent(
          {
            ...input,
            state: first.state,
            request:
              "Actually, I could reduce shopping by $30, but I don't want to change my vacation date.",
          },
          transport,
        );
        assert.equal(followup.source, "live");
        assert.deepEqual(followup.state.event, first.state.event);
        assert.equal(followup.state.shoppingReduction, 30);
        assert.ok(followup.state.deadlineHard);
        assert.ok(followup.state.protectedCategories.includes("Dining"));
        assert.ok(followup.scenarios.length);
        assert.ok(
          followup.scenarios.every(
            (p) =>
              p.adjustments.Dining === 0 &&
              p.adjustments.Shopping === 30 &&
              p.months === 5,
          ),
        );
      },
    );
  },
);
