# Money Moves

A mobile-first spending insight and goal-planning prototype inside fictional **ABC Bank**. Built for a design engineering interview: one coherent journey from a spending change to an explicitly approved plan.

## 1. Problem

Transaction lists and spending charts describe what happened. They often leave people to figure out why it matters and what to do next. Money Moves connects evidence to an existing goal and offers an adjustable next step.

## 2. Product concept

Alex has $400 saved toward a $1,000 Vacation Fund, targeting five months from the sample date. Dining is $320 versus a recent $200 monthly baseline. Five additional small purchases account for the $120 increase. Money Moves helps Alex understand this change and explore a workable savings plan.

## 3. Why AI adds value

A language model is useful when Alex says, “I eat out with friends a lot. Find another way.” The goal-planning agent translates lifestyle constraints into protected categories, consults deterministic tools, and proposes structured alternatives. It does not calculate money, move funds, or replace direct controls. The insight and default plan work without an LLM.

## 4. Design principles

Evidence before trust; progressive disclosure; calm proactivity; estimates instead of certainty; reversible choices; explicit approval for activation. A neutral surface, one blue accent, system typography, restrained borders, and mostly unboxed rows keep the experience close to a banking product. The mobile interface is capped at 440px; `/preview` presents two 390 × 844 views for a laptop demonstration.

## 5. User journey

1. **Home:** balance, goal progress, one dismissible insight, recent transactions.
2. **Insight:** current versus historical dining, contributing transactions, observed facts versus interpretation, and “Not quite?” context correction.
3. **Planner:** adjust dining directly, inspect other monthly reductions, protect categories, compare a dining-preserving preset, or make a natural-language request. Projections update immediately; changes can be undone.
4. **Review:** inspect the exact monthly targets and check-in preference before activation. Clearly states what will be saved and that no money moves.
5. **Active plan:** progress, targets, forecast, saved check-in preference, edit/pause/resume/turn off. Future feedback is explicitly illustrative.

A three-minute demo: Home → See what changed → contributing purchases → Explore → drag dining from $60 to $55 → Keep dining → explain a constraint → Review → Activate → Pause.

## 6. Architecture

| File                               | Responsibility                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| `App.tsx`                          | Screen flow, reversible draft scenarios, approval, browser-local persistence       |
| `components.tsx`                   | Buttons, icons, goal progress, forecast, transaction rows, accessible bottom sheet |
| `styles.css`                       | Typography, spacing/surface/color tokens, mobile layout and restrained motion      |
| `model.ts`                         | TypeScript domain types and Zod validation                                         |
| `fixtures.ts`                      | Five months of synthetic financial activity                                        |
| `finance.ts`                       | Totals, baseline, projections, reduction limits and deterministic examples         |
| `agent.ts`                         | Server-side Responses API tool loop, structured-output validation and fallback     |
| `server.ts`                        | Small local HTTP API, environment loading and optional built static serving        |
| `dev.mjs`                          | Starts API and Vite together; stops both on exit                                   |
| `finance.test.ts`, `agent.test.ts` | Financial invariants, mocked agent tool orchestration and HTTP boundary checks     |

React state is deliberately local to the application; there is no database, authentication, global state framework or orchestration framework. Earlier vanilla-JavaScript files (`app.js`, `data.js`, `plan-engine.js`, `planning.test.js`) remain as an unimported snapshot of the prior prototype. The active application starts at `main.tsx`. React replaces the rendering layer while retaining the mobile navigation, bottom sheets, editable budgets, review flow and plan controls from that baseline.

## 7. Deterministic versus AI-powered

**Deterministic:** observed amounts and transaction counts, historical averages, category limits, checking-buffer check, goal dates, projected savings, charts, presets, validation, persistence and activation.

**AI-powered, when configured:** interpreting open-ended constraints, selecting tools, proposing up to two alternatives, and explaining tradeoffs. All proposed amounts are validated and recalculated before the UI uses them. The home insight's initial interpretation is authored demo content, not a live autonomous monitoring result.

Projection: `saved + (scheduled monthly saving + monthly spending reductions) × months`. Alex's baseline is `400 + 60 × 5 = 700`. A $60 reduction produces `400 + (60 + 60) × 5 = 1,000`. The full reduction must actually be saved; no interest, withdrawals, automatic transfers, or future cash flow are modeled. October 1–23 is compared against complete prior months; this is a deliberately constructed scenario, not a normalized forecasting model.

## 8. Agent and tool flow

The server uses OpenAI's Responses API with strict function schemas and a strict final JSON schema. It exposes:

- `analyze_spending`: observed totals, counts, baseline and contributing purchase evidence.
- `find_adjustable_categories`: current discretionary totals, prototype reduction caps, protected categories and sample balance.
- `get_goal_projection`: goal and deterministic baseline projection.
- `simulate_scenario`: validate constraints and calculate the proposed scenario.

The agent has an eight-step maximum. Every live recommendation must follow successful spending/category/goal tool calls and exactly match a successfully simulated adjustment. Zod validates the output; domain checks preserve protected categories and reduction caps. Final amounts are recalculated in TypeScript, never trusted from model prose. Groceries and bills remain protected. No tool can execute a financial action.

Loading is shown as a brief activity status, not hidden model reasoning. Cancellation preserves the draft. Malformed output, missing tools, invalid amounts and API failures return a clearly marked calculated fallback. A network failure between browser and local server leaves the request intact and offers retry. A requested buffer above today's sample balance produces no new scenario. No API key means labeled **Example mode**, with a small phrase-based preference parser; it is not presented as live AI.

## 9. Synthetic data

All names, balances and transactions are intentionally synthetic. June–October 2026 include dining, groceries, transport, entertainment, subscriptions, shopping and bills. Dining has ten $20 purchases each month. October adds $18, $22, $24, $28 and $28. Other categories support alternative planning. The fixed sample date is October 23, 2026; the initial target date is March 23, 2027.

## 10. Trust and safety decisions

Observed facts and interpretation have separate labels. Corrections add context without altering transaction records. Projections are estimates. Evidence and assumptions are inspectable. Preferences are explicit, essentials are protected, and consequences are described before activation. Draft adjustments do not change the active plan until approval. Pausing and turning off are available. No bank connection, transfers, payment blocking, real monitoring or actual reminders exist.

The model only receives the synthetic fixture/tool results, the planning request, saved context and stated preferences. API credentials stay server-side. The API rejects invalid input, limits request size, restricts browser origins and binds to localhost. This is a local demo, not a hardened public financial service.

## 11. Accessibility

Semantic controls, visible keyboard focus, named icon buttons, labeled ranges, text equivalents for charts, non-color status labels, focus trapping/return in dialogs, Escape dismissal, and reduced-motion support are implemented. Native input text stays at least 16px on mobile to avoid focus zoom. Primary controls are at least 40–48px high; smaller text links have expanded hit areas. Contrast uses dark text on neutral surfaces. Automated unit tests are not an accessibility certification; screen-reader and device testing remain necessary before release.

## 12. Stack

React 19, TypeScript, Vite, Zod, Node's HTTP server, native server-side `fetch`, OpenAI Responses API, and Node's test runner. Use Node 22.6+ (Node 24 recommended). No external font or illustration request is required.

## 13. Run locally

```bash
git pull
npm install
npm run dev
```

Open `http://localhost:5173/`. For the interview presentation, open `http://localhost:5173/preview`. The API runs on `127.0.0.1:5174` behind Vite's `/api` proxy. Keep both ports free. The dev script accepts `--host` and `--port` when a preview environment requires them.

```bash
npm test
npm run build
npm start
```

The last command serves the built app and API locally on port 5173. `API_PORT` can override its port. The app works in example mode immediately without a model account.

## 14. Environment variables

For real natural-language planning, create a local `.env` from `.env.example`:

```bash
cp .env.example .env
```

Set `OPENAI_API_KEY` privately in that file and optionally change `OPENAI_MODEL` (default `gpt-4.1-mini`). Restart the server. Do not paste secrets into the app or commit `.env`. Never use a `VITE_` prefix for this key. Live requests may incur API usage charges. `/api/config` exposes only `live` or `example`, never credentials. The presence of a key means configured, not that connectivity has been verified; a failed request visibly falls back.

## 15. Known limitations

- No live API call was verified in this development environment because no API key was configured. Tests exercise the real tool loop with controlled mock Responses API messages, not a live model.
- Browser-local storage is a demo persistence layer on the same browser/origin. It is not encrypted banking storage or cross-device sync. Clear site data for a fresh demo.
- There is no continuous background analysis, bank integration, authorization system or scheduled notification service.
- Current sample spending and category caps are fixed. Checking buffer is checked against today's balance only and cannot guarantee future liquidity.
- Example mode understands a limited set of dining/subscription/shopping/amount phrases. It does not understand arbitrary natural language. Live model explanations may still be wrong even when their amounts pass validation.
- Protected categories are hard constraints; a requested monthly amount is a planning preference. Multiple protected categories or caps can leave a shortfall, which remains visible.
- Goal dates use whole monthly steps, not exact weeks. All projections assume reductions are saved consistently.
- No usability study or formal WCAG audit has been completed.

## 16. Next steps

Validate the flow with people on actual phones; calibrate the timing and usefulness of proactive insights; evaluate natural-language constraints and unsafe/inconsistent model outputs against a larger test set; normalize partial-month comparisons; model cash flow and recurring commitments; add authorized bank data and reminder delivery only after research and security review.

## 17. AI-assisted development disclosure

AI coding tools accelerated the implementation, synthetic fixture construction, proposed architecture, interaction refinements and test authoring. The human supplied the product concept, design challenge, mobile-first priorities, visual critiques and updated brief, and directs final product judgment. Implementation and architecture proposals still require human review. The documented tests and browser checks were performed during AI-assisted development; this does not claim human usability evaluation or independent validation that has not occurred.
