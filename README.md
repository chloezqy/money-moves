# Money Moves · ABC Bank

A high-fidelity, responsive frontend prototype that expands Chloe Zhu’s four-step banking storyboard into a working experience.

## Experience

Overview → dining insight → evidence → customizable monthly plan → explicit review → saved plan.

The prototype includes editable savings goals, category protection, instant what-if calculations, an alternative-plan interaction, transaction search and filtering, account privacy preferences, plan export, edit and pause flows, keyboard focus handling, and browser-local persistence. Desktop has a persistent sidebar; mobile has bottom navigation.

## Run

Serve the repository root using any static web server. There is no build step and no runtime dependency. For example, `python3 -m http.server 8000`.

Run financial and data checks with `npm test` (Node 20+).

## Structure

- `app.js`: views, state, events, dialogs, browser persistence.
- `styles.css`: responsive visual system and interaction states.
- `data.js`: synthetic account, transactions, and goal data.
- `plan-engine.js`: deterministic calculation and constraint-aware planning functions.
- `icons.js`: original SVG icons and vacation illustration.
- `planning.test.js`: meaningful financial and constraint checks.

## Numbers and assumptions

Dining is $420 versus a usual $300, preserving the original storyboard. The supporting synthetic purchases reconcile with each category and the $1,280 spending total. The vacation goal starts at $400 of $1,000 with four months left. A $90 existing monthly savings contribution projects $760. An extra $60 a month closes the $240 gap.

Projection = already saved + (scheduled monthly contribution + monthly spending adjustments) × remaining months. No interest, withdrawals, or automatic transfers are assumed. Reducing spending only supports the projection if the customer actually saves the difference.

## Scope and honesty

This release prioritizes visual design and a complete functional frontend. The planner is a deterministic, constraint-aware demo, **not a live language model or an AI agent**. It recognizes protected dining and requested monthly savings amounts. Arbitrary requests are redirected to supported examples or the controls. The interface discloses this.

No bank connection, financial action, actual notification, or server persistence exists. Saving a plan stores budgets and preferences in localStorage. The weekly reminder is only a stored preference. Fonts are optional Google Fonts with system fallbacks. No user data is sent to a model.

A live tool-calling model can replace `suggestPlan` behind a server endpoint while preserving `simulate`, validation rules, and the existing view contract. Do not put model API keys in frontend code.

## Verification

Financial calculations, infeasible plans, protected categories, valid ranges, and transaction totals have automated coverage. JavaScript syntax checks pass. Browser visual QA could not be completed because the environment blocked browser access to the local preview; viewport layouts still require a visual review on the deployed prototype.
