# Money Moves — Life Happens

**One goal. Multiple possible futures. Human choice.** A financial future simulator inside the existing fictional ABC Bank journey: Home → Insight → Planner → Review → Active Plan.

Life Happens turns a life change into editable constraints and comparable financial paths. Alex can preserve dinner with friends, budget for a wedding, explore a later vacation, and change their mind without starting over. The interface uses branching trajectories, restrained cobalt and earth tones, warm neutral surfaces, and serif financial numerals. Every screen, including Life Happens, uses the same mobile-first canvas capped at 440px, including on desktop.

## Run

```sh
npm install
npm run dev
# http://127.0.0.1:5173
npm test
npm run test:live
npm run build
npm start
```

Node 22.6+ required. Copy `.env.example` to `.env` and configure `OPENAI_API_KEY` and optionally `OPENAI_MODEL` for live planning. Credentials stay on the Node server. Without a key the app uses clearly labeled Example mode. The planner also has a **Use Example mode** switch for reliable demos with a key configured. Example interpretation is a limited phrase parser, never represented as model reasoning. A live failure is explicitly labeled as a calculated example.

If another prototype is running: `API_PORT=5184 npm run dev -- --port 5183`. API and Vite proxy use the same override. `/preview` retains the earlier two-phone presentation.

## Flagship demo

1. From Home, open **See what changed**, inspect dining evidence, then **Explore my options**.
2. In the planner’s Life Happens section, choose **Unexpected expense** to populate:
   > I have a wedding next month and need an extra $200. I don't want to cut dining because that's how I spend time with friends. Can I still reach my vacation goal?
3. Click **Explore futures**. Inspect the structured dining protection, wedding amount/date and visible funding assumption.
4. Compare **Keep your date**, **A balanced path**, and **Keep your lifestyle**. Select a path to change the chart, date, monthly savings, category changes and tradeoffs.
5. Change the expense funding dropdown to see why paying from checking, reducing a contribution, and withdrawing from savings are different decisions.
6. Follow up: **Actually, I could reduce shopping by $30, but I don't want to change my vacation date.** Wedding and dining remain; the deadline becomes fixed and the shopping adjustment is exact.
7. Try **Actually, the wedding is in December.** The existing event changes to December instead of duplicating. **Never mind, forget the wedding expense.** removes it.
8. Review the date, total monthly savings, expense funding, category targets and check-in preference. Explicitly activate the demo plan. Edit, pause, resume or turn it off on Active Plan.

Draft exploration never changes an active plan. No money will be transferred automatically. Check-ins are saved preferences, with no actual notifications.

## Why AI is needed

The model interprets flexible language, implicit priorities, relative dates, hard deadlines, corrections and contradictions. It selects financial tools and returns a short structured explanation. It does not calculate balances, choose arbitrary savings amounts or activate anything. Direct constraint edits run the same calculations immediately without an unnecessary model call.

The existing planning agent remains available in the manual planner. Existing evidence, transaction details, goal editing, sliders, presets, projection, review and active-plan controls remain intact.

## Architecture

| File                                                                               | Role                                                                                                                          |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `life.ts`                                                                          | Zod life-event/constraint contracts, cents-based simulation, allocation, feasibility, validation and comparison               |
| `life-agent.ts`                                                                    | Responses API tool loop, full-state interpretation, multi-turn updates, structured final output and explicit example fallback |
| `LifeHappens.tsx`, `LifeConstraints.tsx`, `FuturePaths.tsx`, `ScenarioDetails.tsx` | Integrated input, editable constraints, accessible branching chart, path selection and factual transparency                   |
| `model.ts`                                                                         | Existing domain types, extended with optional life-event path metadata                                                        |
| `finance.ts`, `fixtures.ts`                                                        | Reused financial validation, synthetic ledger, spending baselines and goal calculations                                       |
| `agent.ts`                                                                         | Existing goal agent and shared server-only OpenAI transport; bounded network/5xx retries                                      |
| `server.ts`                                                                        | Existing local HTTP service plus `POST /api/life`; same origin, payload and schema checks                                     |
| `App.tsx`, `components.tsx`                                                        | Existing journey, approval, persistence, path-aware forecast and activation validation                                        |
| `life.test.ts`, `life.live.test.ts`                                                | Financial/agent/HTTP regression tests and opt-in real-model evaluation                                                        |

No new runtime dependencies, agents, frameworks, bank connections or databases were added. Earlier vanilla JS files are retained as an unimported snapshot; `main.tsx` is the React entry point.

### Structured state

`LifeState` contains protected categories; one optional event `{name, amount, month, funding}`; hard/flexible deadline; optional exact shopping reduction; and optional changed target/horizon. Event month is a relative contribution checkpoint: November is `1`, December `2`, March `5` from October 23, 2026. A tomorrow deadline is `0` and cannot be met by this monthly model.

`FutureScenario` extends the existing scenario with this state, planned month count, monthly balance points, and feasibility. It retains category adjustments, deterministic projection, evidence and tradeoffs. The complete selected path survives review, activation and reload. Draft constraints persist for the browser session; approved plans persist locally and are validated/recalculated on restore. Raw conversation text is not stored. Each request sends the current structured state, so corrections preserve prior context.

### Agent tool contracts

The tool-calling protocol follows [OpenAI’s official function-calling documentation](https://developers.openai.com/api/docs/guides/function-calling).

- `get_financial_context()` returns the synthetic goal, checking balance, transactions, observed totals, caps and fixed time reference.
- `analyze_adjustable_spending({state})` returns eligible categories and reduction limits; protected categories have zero capacity.
- `generate_feasible_paths({state})` enforces constraints, simulates the event, generates and validates candidates, and returns structured path comparisons. It composes deterministic `simulateLifeEvent`, `validateFuture` and `comparePaths` functions rather than creating gratuitous model round trips.

Live recommendations require successful context/category tools and successful path generation. JSON Schema constrains calls and final output; Zod and domain checks validate again. A premature model response is prompted to finish tool execution, with a ten-round limit. Tool errors are returned to the model for correction. The server returns its own tool-validated scenarios, never model-authored financial amounts. Numerical claims in the final model summary are replaced by neutral copy; financial numbers render from tools. Transparency shows actual executed tool names and distinguishes direct recalculation from a new AI call. No hidden reasoning is exposed.

### Calculation methodology

Reference date: **October 23, 2026**. Vacation Fund: **$400** saved, **$1,000** target, **March 23, 2027**, scheduled **$60/month**.

Calculations use integer cents. Every month adds the scheduled contribution plus recurring category reductions. A funded event changes the contribution/balance only at its selected checkpoint:

- **Checking (default, visibly labeled and editable):** expense comes from synthetic checking, preserving goal savings. Remaining checking must meet the requested buffer. This checks today's balance only; future bills and income are not forecast.
- **Savings contribution:** reduce only that month’s contribution. Reject a path if its contribution cannot cover the entire expense; never imply a hidden withdrawal.
- **Vacation Fund:** explicitly withdraw the one-time expense from the fund. Reject negative balances.

For each candidate horizon, required monthly saving is rounded **up** to the nearest cent, then allocated across eligible Shopping → Entertainment → Subscriptions → Dining, respecting exact shopping adjustments and caps ($80/$60/$30/$120 respectively). Caps are illustrative product limits, bounded by observed spending, not model estimates of affordability. Groceries and Bills stay protected. The deadline path uses the original/requested horizon; the lifestyle path searches later dates with no new reductions beyond an exact user adjustment; a balanced path adds one month only when it offers a distinct tradeoff. A hard deadline suppresses later alternatives. No candidate is labeled feasible unless the validated projection reaches the target and funding/constraints are satisfied.

With the flagship’s checking assumption, calculations produce $120/month through March, $100/month through April, or $60/month through August. These are derived from the current goal, not embedded in the UI. The chart marks the event even when its checking funding leaves the goal trajectory unchanged. Projections show monthly estimates and planned completion, not precise daily forecasts.

## Verification status — October 23, 2026

- `npm test`: deterministic financial, mocked agent, multi-turn, contradictions, fallback and HTTP-boundary coverage.
- `npm run test:live`: **all A–G passed with the configured OpenAI model**, using real requests and rejecting fallback as a success. This includes protected dining; a $200 event with an explicit funding treatment; groceries/dining plus fixed deadline; an existing wedding corrected to December; contradictory dining constraints; and $10,000 by tomorrow. The seventh live check covers the full flagship plus its shopping follow-up. Live execution exposed and led to fixes for relative month interpretation, premature final responses, and transient transport failures. These results are a point-in-time check, not a guarantee of future service availability.
- Production TypeScript/Vite build passes.
- Actual desktop and 390px mobile browser checks cover entry, future selection, follow-up recalculation, review, activation, reload persistence and pause/resume. Browser layout checks verify no horizontal overflow.

Run the live suite separately; it makes paid API calls and skips when no key is configured. `npm test` uses deterministic/mocked behavior, including explicitly forced Example mode at the new HTTP integration boundary.

## Known limitations

All account data is synthetic. October figures cover days 1–23 and are not normalized full-month spending estimates; the UI labels the observation period. The model can misinterpret flexible language, so constraints are inspectable/editable before activation. Example mode only understands the documented demo phrases and a small set of patterns. The prototype supports one life event, one exact category adjustment (Shopping), and up to sixty monthly checkpoints. An otherwise achievable real-world goal due tomorrow is conservatively infeasible in this monthly model. Missing expense amounts ask for clarification. Unsupported requests may require restating or editing constraints directly.

No interest, investment return, income changes, future checking cash flow, real notifications or transfers are modeled. There is no authentication or production security infrastructure. API input is capped and origin-checked for local development. Chart text alternatives, keyboard controls, dialog focus handling and reduced motion are implemented; this is not a formal accessibility audit.

## Final visual refinement

The planner now uses progressive disclosure: compact goal context, a conversational composer that collapses after interpretation, an editable situation summary, and grouped priorities behind one disclosure. Possible Futures is the primary decision surface, with a larger mobile chart and date/contribution/spending-change comparisons. Clicking a trajectory or using Enter/Space selects the same validated scenario as its comparison button. Selected paths use cobalt; alternatives use muted copper; the current projection is dashed gray. SVG geometry remains a linear monthly projection, including negative balances in the displayed domain when necessary.

Navigation, financial figures, screen headings and controls use sans serif; the initial “What changed?” moment retains restrained serif typography. Home presents a concise, evidence-based dining observation. Review shows the chosen future, exact targets and funding treatment, with check-in settings progressively disclosed. Active Plan puts edit/pause controls immediately below progress and shows the total monthly savings. Home and Goals display the approved plan’s deadline while the original goal remains available for comparison.

The planner review action appears only for a validated future and is hidden during composition or processing. It sits in normal document flow so it cannot obscure the input or chart. Textareas resize to the request, reduced motion is respected, and result focus targets the compact explorer heading rather than its entire container.

QA found and fixed redundant later scenarios with identical adjustments, an unsupported model-created exact shopping constraint, and rounded-away cents in monetary labels. These are covered by regression checks. No synthetic spending data was modified.

Screenshots and the visual QA record are in [qa/polish](qa/polish/README.md), covering all nine requested states at 390 × 844 and 1440px desktop width.
