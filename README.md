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

## Mobile preview

Open **http://127.0.0.1:5173/preview** to compare home and planning in two real **390 × 844** iframe viewports. Open the root URL on a phone or narrow browser to use the app directly. Wider browsers display a centered mobile app rather than a desktop dashboard.

## Try the flow

1. Tap **See my next move** on home.
2. Inspect the dining change and supporting purchases.
3. Tap **Find a way forward** for the suggested monthly adjustment.
4. Choose **Keep dining**, or open the adjustment menu for another approach.
5. Tap **Edit** to adjust amounts in a bottom sheet. Closing it preserves your changes; **Undo** restores the previous plan.
6. Use **What would make this work for you?** to try a supported request such as **Keep dining. Save $50 a month**.
7. Review the exact budgets and save your plan.

Goals, transaction search, privacy preferences, plan editing, and pause also work. Plans persist after reload.

## Interaction and visual design

The original mobile journey drives the structure: **notice → understand → customize → approve**. The interface uses system typography, a white canvas, one blue action color, simple rows, and restrained separators. A single home insight gets visual emphasis. The plan presents one recommendation and its impact, rather than several equally weighted cards.

Bottom navigation supports the banking areas. Flow screens have a fixed primary action and a clear back route. Alternatives, evidence, preferences, amount adjustments, and final review use bottom sheets. Touch controls, safe-area padding, meaningful transitions, focus restoration, and reduced-motion support are included. The slider stays mounted during dragging.

## Files

- `app.js`: views, event handling, accessible dialogs, undo, and local persistence.
- `styles.css`: responsive visual system, states, and motion.
- `data.js`: synthetic account, transactions, and savings goal.
- `plan-engine.js`: deterministic scenarios, constraints, and calculations.
- `icons.js`: SVG interface icons.
- `dev.mjs`: dependency-free local development server with automatic reload.
- `planning.test.js`: calculation, constraint, and transaction consistency checks.
- `preview.html`: two mobile viewports for local design review.

## Calculation

Dining is $420 versus a usual $300. Transactions reconcile with the category totals and $1,280 total spending. The goal starts at $400 of $1,000, with four months remaining and a $90 scheduled monthly contribution.

`Projected savings = saved + (scheduled contribution + monthly spending reductions) × months`

The baseline projects $760. An extra $60/month closes the $240 gap. A $50/month adjustment projects $960 and correctly reports $40 still to save. Forecasts assume all reductions are saved consistently, with no interest or withdrawals. They are not guaranteed outcomes or automatic transfers.

## Prototype scope

**Scenario mode is deterministic, not a live AI agent.** It recognizes protected dining and requested savings amounts. Unsupported requests receive example prompts without silently changing the plan. The structure is ready for a server-backed agent while retaining deterministic calculations and constraint validation.

No real bank accounts, financial actions, or notification services are connected. Saving uses localStorage; the weekly check-in is a stored preference only. No model API key belongs in frontend code. Typography uses the device’s system font; no external font service is needed.

The local server serves only the application's public files. It does not expose environment files, repository metadata, or arbitrary filesystem paths. It binds to localhost by default on your desktop.

## Verification

```bash
npm test
```

Six automated checks cover projections, infeasible goals, protected categories, allowed ranges, and transaction totals. JavaScript syntax checks pass. Browser review uses actual 390 × 844 iframe viewports. Checks cover home, insight, protected dining, an adjustment sheet, live slider updates, closing the sheet without losing edits, undo, review, and save. Native-device keyboard and gesture behavior still need testing on a physical phone.
