# Money Moves · ABC Bank

A responsive banking prototype built around a simple idea: explore a useful next move instead of reading another dashboard.

## Run on your desktop

Requires Node.js 20 or newer. There are no dependencies to install.

```bash
git clone https://github.com/chloezqy/money-moves.git
cd money-moves
npm run dev
```

Open **http://127.0.0.1:5173**. Editing an application file automatically reloads the page. Stop with Ctrl+C. If you already cloned the repository, run `git pull` first.

To choose another port: `npm run dev -- --port 3000`.

## Try the flow

1. Choose **Find my next move** from the overview.
2. Switch between **The smallest change**, **Keep the dinners**, and **A little breathing room**.
3. Watch the budgets and forecast change together. Use **Undo** to go back.
4. Try **Keep dining. Save $50 a month** to see an honest remaining savings gap.
5. Open **Fine-tune** to adjust targets directly, or protect an individual category.
6. Choose **This feels right**, review the targets, and save your plan.
7. Reload. Your plan and preferences remain in this browser.

Evidence, calculations, and assumptions are available on demand. Goals, activity search, plan editing, pause, export, and balance privacy also work.

## Interaction and visual design

The overview centers one relevant suggestion. Planning happens in one workspace with three clear starting points, a live forecast, and optional controls. A short review dialog replaces the separate review page.

Warm white, sage, and deep green keep the interface quiet. DM Sans carries functional text; Instrument Serif adds a little personality to key headlines. View Transitions, subtle chart motion, focus preservation, and a compact success state provide feedback. The active slider stays mounted during dragging. Reduced-motion preferences disable nonessential motion.

## Files

- `app.js`: views, event handling, accessible dialogs, undo, and local persistence.
- `styles.css`: responsive visual system, states, and motion.
- `data.js`: synthetic account, transactions, and savings goal.
- `plan-engine.js`: deterministic scenarios, constraints, and calculations.
- `icons.js`: SVG icons and vacation illustration.
- `dev.mjs`: dependency-free local development server with automatic reload.
- `planning.test.js`: calculation, constraint, and transaction consistency checks.

## Calculation

Dining is $420 versus a usual $300. Transactions reconcile with the category totals and $1,280 total spending. The goal starts at $400 of $1,000, with four months remaining and a $90 scheduled monthly contribution.

`Projected savings = saved + (scheduled contribution + monthly spending reductions) × months`

The baseline projects $760. An extra $60/month closes the $240 gap. A $50/month adjustment projects $960 and correctly reports $40 still to save. Forecasts assume all reductions are saved consistently, with no interest or withdrawals. They are not guaranteed outcomes or automatic transfers.

## Prototype scope

**Scenario mode is deterministic, not a live AI agent.** It recognizes protected dining and requested savings amounts. Unsupported requests receive example prompts without silently changing the plan. The structure is ready for a server-backed agent while retaining deterministic calculations and constraint validation.

No real bank accounts, financial actions, or notification services are connected. Saving uses localStorage; the weekly check-in is a stored preference only. No model API key belongs in frontend code. Fonts load from Google Fonts with system fallbacks.

The local server serves only the application's public files. It does not expose environment files, repository metadata, or arbitrary filesystem paths. It binds to localhost by default on your desktop.

## Verification

```bash
npm test
```

Six automated checks cover projections, infeasible goals, protected categories, allowed ranges, and transaction totals. JavaScript syntax checks pass. Browser checks cover the desktop overview, scenario selection, preference requests, honest gap reporting, undo, review, save, and restoration after reload. Responsive styles are implemented; a separate mobile viewport visual review remains outstanding.
