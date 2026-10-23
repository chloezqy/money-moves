import { LifeHappens } from "./LifeHappens";
import { validateFuture, generateFeasiblePaths, lifeStateSchema } from "./life";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AgentLabel,
  Button,
  Dock,
  Forecast,
  GoalProgress,
  Icon,
  IconButton,
  Sheet,
  TransactionRow,
} from "./components";
import {
  initialGoal,
  balance,
  currentTransactions,
  currentTotals,
  monthlyDining,
} from "./fixtures";
import {
  addMonths,
  calculateSuggestion,
  dateLabel,
  makeScenario,
  money,
  parseExamplePreferences,
  project,
  spendingAnalysis,
} from "./finance";
import {
  adjustable,
  caps,
  defaultPreferences,
  emptyAdjustments,
  goalSchema,
  type ActivePlan,
  type Adjustments,
  type Category,
  type Goal,
  type PlanningResponse,
  type Preferences,
  type Scenario,
} from "./model";

type Page = "home" | "insight" | "planner" | "active" | "goals" | "activity";
const pages: Page[] = [
  "home",
  "insight",
  "planner",
  "active",
  "goals",
  "activity",
];
function pageFromHash(hash: string): Page {
  const candidate = hash.replace(/^#/, "") as Page;
  return pages.includes(candidate) ? candidate : "home";
}
type Modal =
  | "evidence"
  | "correction"
  | "why"
  | "adjust"
  | "ask"
  | "review"
  | "goal"
  | "about"
  | "pause"
  | "off"
  | null;
function restore() {
  try {
    const raw = JSON.parse(localStorage.getItem("money-moves-v3") || "null");
    if (!raw) return null;
    goalSchema.parse(raw.goal);
    if (raw.plan?.scenario.life) {
      validateFuture(
        raw.goal,
        raw.plan.preferences,
        raw.plan.scenario.life,
        raw.plan.scenario.adjustments,
        raw.plan.scenario.months,
      );
      const fresh = generateFeasiblePaths(
        raw.goal,
        raw.plan.preferences,
        raw.plan.scenario.life,
      ).find((p) => p.id === raw.plan.scenario.id);
      if (!fresh) return null;
      raw.plan.scenario = fresh;
    } else if (raw.plan)
      makeScenario(
        raw.goal,
        raw.plan.scenario.adjustments,
        raw.plan.preferences,
      );
    return raw as {
      goal: Goal;
      plan: ActivePlan | null;
      context: string;
      dismissed: boolean;
    };
  } catch {
    return null;
  }
}
const stored = restore();
function restoreLifeDraft() {
  try {
    const state = lifeStateSchema.parse(
      JSON.parse(sessionStorage.getItem("money-moves-life") || "null"),
    );
    if (
      !state.event &&
      state.protectedCategories.length === 2 &&
      !state.deadlineHard &&
      state.shoppingReduction === null &&
      state.target === null
    )
      return null;
    const paths = generateFeasiblePaths(
      stored?.goal || initialGoal,
      {
        ...defaultPreferences(),
        protectedCategories: state.protectedCategories,
      },
      state,
    );
    return (
      paths.find(
        (p) => p.id === sessionStorage.getItem("money-moves-life-selected"),
      ) ||
      paths[0] ||
      null
    );
  } catch {
    return null;
  }
}
const lifeDraft = restoreLifeDraft();
const plannerDraft =
  pageFromHash(location.hash) === "planner" ? lifeDraft : null;

const analysis = spendingAnalysis();
const pendingWords = [
  "Reviewing your spending and preferences",
  "Comparing options with your Vacation Fund",
];
export function App() {
  const [page, setPage] = useState<Page>(pageFromHash(location.hash));
  const [goal, setGoal] = useState<Goal>(stored?.goal || initialGoal);
  const [plan, setPlan] = useState<ActivePlan | null>(stored?.plan || null);
  const [preferences, setPreferences] = useState<Preferences>(
    (plannerDraft
      ? {
          ...defaultPreferences(),
          protectedCategories: plannerDraft.life.protectedCategories,
        }
      : null) ||
      stored?.plan?.preferences ||
      (lifeDraft
        ? {
            ...defaultPreferences(),
            protectedCategories: lifeDraft.life.protectedCategories,
          }
        : defaultPreferences()),
  );
  const [scenario, setScenario] = useState(
    () =>
      plannerDraft ||
      (stored?.plan?.scenario.life
        ? stored.plan.scenario
        : stored?.plan
          ? makeScenario(
              stored.goal,
              stored.plan.scenario.adjustments,
              stored.plan.preferences,
              stored.plan.scenario.title,
            )
          : lifeDraft || calculateSuggestion(stored?.goal || initialGoal)),
  );
  const [lifeBlocked, setLifeBlocked] = useState(false);
  const [lifeBusy, setLifeBusy] = useState(false);
  useEffect(() => {
    if (scenario.life && page === "planner") {
      try {
        sessionStorage.setItem("money-moves-life-selected", scenario.id);
      } catch {}
    }
  }, [scenario, page]);
  const [alternatives, setAlternatives] = useState<Scenario[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [context, setContext] = useState(stored?.context || "");
  const [draftContext, setDraftContext] = useState("");
  const [dismissed, setDismissed] = useState(stored?.dismissed || false);
  const [reminder, setReminder] = useState(stored?.plan?.reminder ?? true);
  const [day, setDay] = useState(stored?.plan?.day || "Sunday");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"live" | "example">("example");
  const [response, setResponse] = useState<PlanningResponse | null>(null);
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [toast, setToast] = useState("");
  const history = useRef<
    Array<{ scenario: Scenario; preferences: Preferences }>
  >([]);
  const abort = useRef<AbortController | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => setMode(c.mode === "live" ? "live" : "example"))
      .catch(() => {});
    return () => abort.current?.abort();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        "money-moves-v3",
        JSON.stringify({ goal, plan, context, dismissed }),
      );
    } catch {
      setToast("This browser could not save your plan.");
    }
  }, [goal, plan, context, dismissed]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(id);
  }, [toast]);
  function go(next: Page) {
    setModal(null);
    setPage(next);
    history.current = [];
    setCanUndo(false);
    historyReplace(next);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() =>
      heading.current?.focus({ preventScroll: true }),
    );
  }
  function historyReplace(next: Page) {
    window.history.replaceState(
      null,
      "",
      next === "home" ? location.pathname : `#${next}`,
    );
  }
  function remember() {
    history.current.push({ scenario, preferences });
    setCanUndo(true);
  }
  function usePreset(kind: "small" | "dining" | "cushion" | "lighter") {
    remember();
    const next = {
      ...defaultPreferences(),
      protectedCategories: [
        ...new Set<Category>([
          ...preferences.protectedCategories.filter((c) => c !== "Dining"),
          ...(kind === "dining" ? ["Dining" as Category] : []),
        ]),
      ],
    };
    setPreferences(next);
    setScenario(calculateSuggestion(goal, next, kind));
    setResponse(null);
    setAlternatives([]);
  }
  function start() {
    setScenario(calculateSuggestion(goal, preferences));
    setResponse(null);
    setAlternatives([]);
    go("planner");
  }
  function modify(category: (typeof adjustable)[number], value: number) {
    setScenario(
      makeScenario(
        goal,
        { ...scenario.adjustments, [category]: value },
        preferences,
        "Your custom plan",
      ),
    );
    setResponse(null);
  }
  function protect(category: Category) {
    if (category === "Groceries" || category === "Bills") {
      setToast("Essentials stay protected in this prototype.");
      return;
    }
    remember();
    const next = {
      ...preferences,
      protectedCategories: preferences.protectedCategories.includes(category)
        ? preferences.protectedCategories.filter((c) => c !== category)
        : [...preferences.protectedCategories, category],
    };
    setPreferences(next);
    const amounts = { ...scenario.adjustments };
    if (adjustable.includes(category as (typeof adjustable)[number]))
      amounts[category as (typeof adjustable)[number]] = 0;
    setScenario(makeScenario(goal, amounts, next, "Your custom plan"));
    setResponse(null);
  }
  async function askAgent(event?: FormEvent) {
    event?.preventDefault();
    if (!request.trim() || busy) return;
    setBusy(true);
    setNetworkError(false);
    setResponse(null);
    abort.current = new AbortController();
    try {
      const http = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, goal, preferences, context }),
        signal: abort.current.signal,
      });
      if (!http.ok) throw new Error("Request failed");
      const data: PlanningResponse = await http.json();
      if (
        !["live", "example", "fallback"].includes(data.source) ||
        !Array.isArray(data.scenarios)
      )
        throw new Error("Malformed response");
      data.scenarios = data.scenarios.map((item) =>
        makeScenario(
          goal,
          item.adjustments,
          data.preferences,
          item.title,
          item.source,
          item.rationale,
          item.tradeoffs,
        ),
      );
      setResponse(data);
      if (data.scenarios.length) {
        remember();
        setPreferences(data.preferences);
        setScenario(data.scenarios[0]);
        setAlternatives(data.scenarios.slice(1));
      }
      setModal(null);
    } catch (error) {
      if ((error as Error).name !== "AbortError") setNetworkError(true);
    } finally {
      setBusy(false);
    }
  }
  function activate() {
    if (scenario.life) {
      try {
        validateFuture(
          goal,
          preferences,
          scenario.life,
          scenario.adjustments,
          scenario.months!,
        );
      } catch {
        setToast("This path needs to be recalculated before activation.");
        return;
      }
    }
    setPlan({
      scenario,
      preferences,
      reminder,
      day,
      status: "active",
      activatedAt: new Date().toISOString(),
    });
    go("active");
    setToast("Your plan is active in this demo.");
  }
  const flow = ["insight", "planner", "active"].includes(page);
  const p = scenario.projection;
  const nav = [
    ["home", "home", "Home"],
    ["activity", "chart", "Activity"],
    ["goals", "flag", "Goals"],
  ] as const;
  return (
    <div
      className={`app-shell ${flow ? "flow" : ""} ${page === "planner" ? "planner-shell" : ""}`}
    >
      {flow ? (
        <header className="flow-header">
          <IconButton
            name="left"
            label="Go back"
            onClick={() => go(page === "planner" ? "insight" : "home")}
          />
          <span>
            {page === "insight"
              ? "Spending insight"
              : page === "active"
                ? "Your active plan"
                : "Your next move"}
          </span>
          <IconButton
            name="info"
            label="About Money Moves"
            onClick={() => setModal("about")}
          />
        </header>
      ) : (
        <header className="bank-header">
          <button className="brand" onClick={() => go("home")}>
            <span className="bank-mark">
              <i />
              <i />
              <i />
            </span>
            ABC Bank
          </button>
          <div>
            <IconButton
              name="bell"
              label="Open spending insight"
              onClick={() => go("insight")}
            />
            <button
              className="avatar placeholder-control"
              disabled
              aria-label="Account profile unavailable in this prototype"
            >
              AC
            </button>
          </div>
        </header>
      )}
      <main className={page}>
        {page === "home" && (
          <>
            <section className="balance-section">
              <div className="greeting">Good morning, Alex</div>
              <div className="balance-caption">Available balance</div>
              <h1 ref={heading} tabIndex={-1} className="balance">
                $8,452<span>.80</span>
              </h1>
              <div className="account-caption">
                <span>Everyday checking · •• 4829</span>
              </div>
            </section>
            <section className="home-goal">
              <div className="section-title">
                <h2>Vacation Fund</h2>
                <button className="text-button" onClick={() => go("goals")}>
                  View goal
                  <Icon name="chevron" />
                </button>
              </div>
              <GoalProgress goal={goal} />
            </section>
            {dismissed ? (
              <div className="saved-insight">
                <AgentLabel />
                <button
                  className="text-button"
                  onClick={() => {
                    setDismissed(false);
                    go("insight");
                  }}
                >
                  Saved insight
                  <Icon name="arrow" />
                </button>
              </div>
            ) : (
              <section className="home-insight">
                <div className="section-title">
                  <AgentLabel />
                  <button
                    className="text-button"
                    aria-label="Save insight for later"
                    onClick={() => {
                      setDismissed(true);
                      setToast("Saved for later. Find it under Money Moves.");
                    }}
                  >
                    Later
                  </button>
                </div>
                <h2>A small pattern changed.</h2>
                <div className="insight-metrics">
                  <div>
                    <small>DINING · OCT 1–23</small>
                    <strong>$320</strong>
                    <i style={{ "--metric": "100%" } as React.CSSProperties} />
                  </div>
                  <div>
                    <small>TYPICAL · SAME 23 DAYS</small>
                    <strong>$200</strong>
                    <i style={{ "--metric": "62.5%" } as React.CSSProperties} />
                  </div>
                </div>
                <div className="insight-delta">
                  <b>+$120</b> above your recent pace
                </div>
                <p>
                  Five more small purchases explain the difference. See the
                  evidence, then decide whether it matters for your goal.
                </p>
                <Button onClick={() => go("insight")}>
                  See what changed
                  <Icon name="arrow" />
                </Button>
              </section>
            )}
            {plan && (
              <button className="active-home" onClick={() => go("active")}>
                <span>
                  <Icon name="check" />
                  Plan {plan.status}
                </span>
                <b>{money(plan.scenario.projection.extra)} extra / month</b>
                <Icon name="chevron" />
              </button>
            )}
            <section className="home-activity">
              <div className="section-title">
                <h2>Recent activity</h2>
                <button className="text-button" onClick={() => go("activity")}>
                  See all
                  <Icon name="chevron" />
                </button>
              </div>
              {currentTransactions.slice(0, 2).map((t) => (
                <TransactionRow key={t.id} transaction={t} />
              ))}
            </section>
            <p className="sample-note">
              Synthetic account ·{" "}
              {mode === "live"
                ? "Live planning available"
                : "Example planning mode"}
            </p>
          </>
        )}
        {page === "insight" && (
          <>
            <AgentLabel />
            <h1 ref={heading} tabIndex={-1} className="page-title">
              A closer look
              <br />
              at your dining.
            </h1>
            <section className="dining-figure">
              <div>
                <span>Oct 1–23</span>
                <strong>$320</strong>
              </div>
              <span className="delta">
                +$120<small>vs. the same 23 days</small>
              </span>
            </section>
            <section
              className="dining-chart"
              aria-label="Dining: June 200 dollars, July 200, August 200, September 200, October 320"
            >
              <div className="usual-line">
                <span>Usual $200</span>
              </div>
              {monthlyDining.map((m, i) => (
                <div className="chart-column" key={m.month}>
                  <i
                    style={{ height: `${(m.total / 350) * 105}px` }}
                    className={i === 4 ? "current" : ""}
                  />
                  <span>{m.month}</span>
                </div>
              ))}
            </section>
            <div className="insight-facts">
              <span className="overline">OBSERVED IN YOUR TRANSACTIONS</span>
              <h2>5 more dining purchases.</h2>
              <p>
                Five additional purchases, between $18 and $28, account for the
                $120 increase versus the same date range in recent months.
              </p>
              <button
                className="text-button"
                onClick={() => setModal("evidence")}
              >
                See contributing purchases
                <Icon name="chevron" />
              </button>
            </div>
            <div className="interpretation">
              <span className="overline">MONEY MOVES’ INTERPRETATION</span>
              <p>
                {context
                  ? "You added context to this insight. The observed totals stay the same."
                  : "This looks like a change in frequency, not a single unusually large expense."}
              </p>
              {context && <blockquote>{context}</blockquote>}
              <button
                className="text-button"
                onClick={() => {
                  setDraftContext(context);
                  setModal("correction");
                }}
              >
                Not quite?
                <Icon name="edit" />
              </button>
            </div>
            <section className="goal-impact">
              <Icon name="plane" />
              <div>
                <h2>Your goal is still within reach.</h2>
                <p>
                  {money(project(goal, emptyAdjustments()).needed)} more a month
                  could close your{" "}
                  {money(project(goal, emptyAdjustments()).gap)} savings gap.
                  This is an estimate.
                </p>
              </div>
            </section>
            <button className="text-button" onClick={() => setModal("why")}>
              Why this insight?
              <Icon name="info" />
            </button>
            <Dock note="Explore freely. No account changes.">
              <Button onClick={start}>
                Explore my options
                <Icon name="arrow" />
              </Button>
            </Dock>
          </>
        )}
        {page === "planner" && (
          <>
            <div className="flow-progress">
              <span>Your plan</span>
              <span>1 of 2</span>
            </div>
            <AgentLabel
              example={
                response ? response.source !== "live" : mode === "example"
              }
            />
            <h1 ref={heading} tabIndex={-1} className="page-title">
              A plan that works
              <br />
              for your life.
            </h1>
            <span className="planner-step">01 · YOUR GOAL</span>
            <div className="goal-context">
              <Icon name="plane" />
              <span>{goal.name}</span>
              <b>
                {money(goal.saved)} / {money(goal.target)}
              </b>
            </div>
            <LifeHappens
              goal={goal}
              preferences={preferences}
              selected={scenario}
              mode={mode}
              onBusy={setLifeBusy}
              onClear={() => setLifeBlocked(true)}
              onSelect={(next, prefs) => {
                setScenario(next);
                setPreferences(prefs);
                setLifeBlocked(false);
              }}
            />
            {!scenario.life && !lifeBlocked && (
              <details className="manual-planner">
                <summary>Or adjust your plan manually</summary>
                <p className="recommendation-copy">
                  {money(p.extra)} more each month.{" "}
                  {preferences.protectedCategories.includes("Dining")
                    ? "Keep dining as it is."
                    : "Start with one small change."}
                </p>
                <span className="planner-step">02 · YOUR CHOICES</span>
                <div className="plan-options">
                  <button
                    className={
                      !preferences.protectedCategories.includes("Dining")
                        ? "selected"
                        : ""
                    }
                    onClick={() => usePreset("small")}
                    aria-pressed={
                      !preferences.protectedCategories.includes("Dining")
                    }
                  >
                    <Icon name="flag" />
                    Suggested
                  </button>
                  <button
                    className={
                      preferences.protectedCategories.includes("Dining")
                        ? "selected"
                        : ""
                    }
                    onClick={() => usePreset("dining")}
                    aria-pressed={preferences.protectedCategories.includes(
                      "Dining",
                    )}
                  >
                    <Icon name="utensils" />
                    Keep dining
                  </button>
                  <IconButton
                    name="settings"
                    label="Adjust monthly amounts"
                    onClick={() => setModal("adjust")}
                  />
                </div>
                <div className="section-title">
                  <h2>Your monthly change</h2>
                  <button
                    className="text-button"
                    onClick={() => setModal("adjust")}
                  >
                    Edit
                  </button>
                </div>
                {adjustable
                  .filter((c) => scenario.adjustments[c] > 0)
                  .map((c) => (
                    <div className="plan-change" key={c}>
                      <span className="merchant-icon">
                        <Icon
                          name={
                            c === "Dining"
                              ? "utensils"
                              : c === "Shopping"
                                ? "bag"
                                : c === "Entertainment"
                                  ? "music"
                                  : "repeat"
                          }
                        />
                      </span>
                      <div>
                        <strong>{c}</strong>
                        <small>
                          {money(currentTotals[c])} →{" "}
                          {money(currentTotals[c] - scenario.adjustments[c])} /
                          month
                        </small>
                      </div>
                      <b>−{money(scenario.adjustments[c])}</b>
                    </div>
                  ))}
                {p.extra === 0 && (
                  <p className="body-copy">No new spending targets.</p>
                )}
                {!preferences.protectedCategories.includes("Dining") && (
                  <label className="inline-slider">
                    <span>
                      <span>Dining adjustment</span>
                      <b>{money(scenario.adjustments.Dining)} less / month</b>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={120}
                      step={5}
                      value={scenario.adjustments.Dining}
                      aria-label="Dining monthly reduction"
                      onPointerDown={remember}
                      onKeyDown={(e) => {
                        if (e.key.startsWith("Arrow")) remember();
                      }}
                      onChange={(e) => modify("Dining", Number(e.target.value))}
                      style={
                        {
                          "--fill": `${(scenario.adjustments.Dining / 120) * 100}%`,
                        } as React.CSSProperties
                      }
                    />
                    <small>
                      <span>$0</span>
                      <span>$120 / month</span>
                    </small>
                  </label>
                )}
                <div className="protected-note">
                  <Icon name="shield" />
                  {preferences.protectedCategories.join(", ")} protected
                </div>
                {response && (
                  <div
                    className={`agent-result ${response.source === "fallback" ? "fallback" : ""}`}
                    role="status"
                  >
                    <div className="agent-result-heading">
                      <Icon
                        name={response.source === "live" ? "check" : "info"}
                      />
                      <strong>
                        {response.source === "live"
                          ? "Money Moves understood your priority"
                          : response.source === "fallback"
                            ? "Live planning unavailable · calculated example"
                            : "Calculated example · no live AI"}
                      </strong>
                    </div>
                    <p>{response.summary}</p>
                    {response.constraints.length > 0 && (
                      <div className="understood-priorities">
                        <span>Understood</span>
                        {response.constraints.map((constraint) => (
                          <b key={constraint}>
                            <Icon name="lock" />
                            {constraint}
                          </b>
                        ))}
                      </div>
                    )}
                    <details>
                      <summary>How this plan was built</summary>
                      <ul>
                        {response.toolActivity.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                      <p>{scenario.rationale}</p>
                      {scenario.tradeoffs.map((s) => (
                        <p key={s}>{s}</p>
                      ))}
                      {response.limitations.map((s) => (
                        <p key={s}>{s}</p>
                      ))}
                    </details>
                  </div>
                )}
                <span className="planner-step future-step">
                  03 · YOUR FUTURE
                </span>
                <Forecast scenario={scenario} goal={goal} />
                <button
                  className="calculation-link"
                  onClick={() => setModal("why")}
                >
                  Assumptions and evidence
                  <Icon name="info" />
                </button>
                {alternatives.length > 0 && (
                  <div className="alternatives">
                    <h2>Another way to get there</h2>
                    {alternatives.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          remember();
                          setAlternatives([scenario]);
                          setScenario(s);
                        }}
                      >
                        <span>
                          {s.title}
                          <small>
                            {money(s.projection.extra)} extra / month ·{" "}
                            {s.projection.gap
                              ? `${money(s.projection.gap)} short`
                              : "On target"}
                          </small>
                        </span>
                        <Icon name="arrow" />
                      </button>
                    ))}
                  </div>
                )}
                <section className="preference-section">
                  <h2>Anything you don’t want to change?</h2>
                  <div className="constraint-chips">
                    {[
                      ["Dining", "Keep dining as-is"],
                      ["Groceries", "Protect groceries"],
                      ["Subscriptions", "No subscription changes"],
                    ].map(([c, label]) => (
                      <button
                        key={c}
                        className={
                          preferences.protectedCategories.includes(
                            c as Category,
                          )
                            ? "selected"
                            : ""
                        }
                        aria-pressed={preferences.protectedCategories.includes(
                          c as Category,
                        )}
                        onClick={() => protect(c as Category)}
                      >
                        <Icon
                          name={
                            preferences.protectedCategories.includes(
                              c as Category,
                            )
                              ? "lock"
                              : "plus"
                          }
                        />
                        {label}
                      </button>
                    ))}
                    <button
                      className={
                        preferences.checkingBuffer === 500 ? "selected" : ""
                      }
                      onClick={() => {
                        remember();
                        setPreferences({ ...preferences, checkingBuffer: 500 });
                        setToast(
                          "$500 buffer selected. Today’s sample balance meets it; future cash flow is not modeled.",
                        );
                      }}
                    >
                      <Icon name="shield" />
                      $500 checking buffer
                    </button>
                  </div>
                  <button className="ask-row" onClick={() => setModal("ask")}>
                    <Icon name="chat" />
                    <span>Tell Money Moves what matters</span>
                    <Icon name="chevron" />
                  </button>
                  <button
                    className="text-button"
                    disabled={!canUndo}
                    onClick={() => {
                      const old = history.current.pop();
                      if (old) {
                        setScenario(old.scenario);
                        setPreferences(old.preferences);
                        setCanUndo(history.current.length > 0);
                        setResponse(null);
                        setAlternatives([]);
                      }
                    }}
                  >
                    <Icon name="left" />
                    Undo last change
                  </button>
                </section>
              </details>
            )}
            <Dock note="Choose freely. No money will be transferred automatically.">
              <Button
                disabled={lifeBlocked || lifeBusy}
                onClick={() => setModal("review")}
              >
                Review my plan
                <Icon name="arrow" />
              </Button>
            </Dock>
          </>
        )}
        {page === "active" && (
          <>
            <div className="success-symbol">
              <Icon name={plan?.status === "paused" ? "pause" : "check"} />
            </div>
            <span className="overline">
              {plan?.status === "paused"
                ? "PLAN PAUSED"
                : "PLAN ACTIVE IN THIS DEMO"}
            </span>
            <h1 ref={heading} tabIndex={-1} className="page-title">
              {plan?.status === "paused"
                ? "Take it at your pace."
                : "Your next move is set."}
            </h1>
            <p className="body-copy">
              {plan?.status === "paused"
                ? "Your goal stays here. Resume when it works for you."
                : "A little more room for what matters. Change it anytime."}
            </p>
            <GoalProgress
              goal={
                plan?.scenario.life
                  ? {
                      ...goal,
                      months: plan.scenario.months!,
                      target: plan.scenario.life.target ?? goal.target,
                    }
                  : goal
              }
            />
            {plan && (
              <>
                <div className="saved-plan-lines">
                  <div>
                    <span>Planned goal date</span>
                    <b>{dateLabel(plan.scenario.projection.targetDate)}</b>
                  </div>
                  {plan.scenario.life?.event && (
                    <p className="sheet-note">
                      {plan.scenario.tradeoffs.at(-1)}
                    </p>
                  )}
                  <div>
                    <span>Extra toward your goal</span>
                    <b>{money(plan.scenario.projection.extra)} / month</b>
                  </div>
                  {adjustable
                    .filter((c) => plan.scenario.adjustments[c] > 0)
                    .map((c) => (
                      <div key={c}>
                        <span>{c} target</span>
                        <b>
                          {money(
                            currentTotals[c] - plan.scenario.adjustments[c],
                          )}{" "}
                          / month
                        </b>
                      </div>
                    ))}
                  <div>
                    <span>Check-in preference</span>
                    <b>{plan.reminder ? plan.day : "Off"}</b>
                  </div>
                </div>
                <Forecast scenario={plan.scenario} goal={goal} />
                <div className="feedback-example">
                  <span className="overline">
                    FUTURE FEEDBACK · ILLUSTRATIVE ONLY
                  </span>
                  <p>
                    “You’re $18 under your weekly dining target. Your Vacation
                    Fund remains on track.”
                  </p>
                  <small>
                    This message is an example, not a result from your current
                    transactions.
                  </small>
                </div>
                <div className="active-actions">
                  <Button
                    secondary
                    onClick={() => {
                      setScenario(
                        plan.scenario.life
                          ? plan.scenario
                          : makeScenario(
                              goal,
                              plan.scenario.adjustments,
                              plan.preferences,
                              plan.scenario.title,
                            ),
                      );
                      setPreferences(plan.preferences);
                      go("planner");
                    }}
                  >
                    Edit plan
                    <Icon name="edit" />
                  </Button>
                  <button
                    className="text-button"
                    onClick={() =>
                      plan.status === "paused"
                        ? setPlan({ ...plan, status: "active" })
                        : setModal("pause")
                    }
                  >
                    {plan.status === "paused" ? "Resume plan" : "Pause plan"}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setModal("off")}
                  >
                    Turn off
                  </button>
                </div>
              </>
            )}
            <p className="sample-note">
              No real reminders are scheduled. No money has moved.
            </p>
            <Dock>
              <Button onClick={() => go("home")}>
                Back to home
                <Icon name="arrow" />
              </Button>
            </Dock>
          </>
        )}
        {page === "goals" && (
          <>
            <h1 ref={heading} tabIndex={-1} className="page-title">
              Your goals
            </h1>
            <p className="body-copy">Make room for what matters.</p>
            <div className="goal-detail">
              <GoalProgress goal={goal} />
              <button className="text-button" onClick={() => setModal("goal")}>
                Edit goal
                <Icon name="edit" />
              </button>
            </div>
            <Button onClick={() => (plan ? go("active") : start())}>
              {plan ? "View active plan" : "Make a plan"}
              <Icon name="arrow" />
            </Button>
          </>
        )}
        {page === "activity" && (
          <>
            <h1 ref={heading} tabIndex={-1} className="page-title">
              Activity
            </h1>
            <p className="body-copy">October 2026 · Synthetic account</p>
            <label className="search-field">
              <Icon name="search" />
              <input
                aria-label="Search transactions"
                placeholder="Find a purchase"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {currentTransactions
              .filter((t) =>
                `${t.merchant} ${t.category}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((t) => (
                <TransactionRow key={t.id} transaction={t} />
              ))}
            {!currentTransactions.some((t) =>
              `${t.merchant} ${t.category}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            ) && <p className="empty-state">No purchases match that search.</p>}
          </>
        )}
      </main>
      {!flow && (
        <nav className="bottom-nav" aria-label="Main navigation">
          {nav.map(([id, glyph, label]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              aria-current={page === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              <Icon name={glyph} />
              <span>{label}</span>
            </button>
          ))}
          <button
            className="placeholder-control"
            disabled
            aria-label="Settings unavailable in this prototype"
          >
            <Icon name="settings" />
            <span>Settings</span>
          </button>
        </nav>
      )}
      {modal && (
        <Sheet
          title={
            {
              evidence: "Behind the increase.",
              correction: "What are we missing?",
              why: "How this was put together.",
              adjust: "Make it work for you.",
              ask: "What matters to you?",
              review: "Your plan. Your final say.",
              goal: "Make it yours.",
              about: "A little help, on your terms.",
              pause: "Pause this plan?",
              off: "Turn this plan off?",
            }[modal]
          }
          eyebrow={
            modal === "review"
              ? "2 OF 2 · REVIEW"
              : modal === "ask"
                ? mode === "live"
                  ? "GOAL PLANNING AGENT"
                  : "EXAMPLE PLANNING MODE"
                : undefined
          }
          onClose={() => {
            if (busy) {
              abort.current?.abort();
              setBusy(false);
            }
            setModal(null);
          }}
        >
          {modal === "evidence" && (
            <>
              <p>
                These five additional purchases total $120. The comparison is
                ten dining purchases totaling $200 over days 1–23 in each of the
                previous three months.
              </p>
              {analysis.contributing.map((t) => (
                <TransactionRow key={t.id} transaction={t} />
              ))}
              <details className="disclosure">
                <summary>View all October dining purchases</summary>
                {currentTransactions
                  .filter((t) => t.category === "Dining" && !t.contributing)
                  .map((t) => (
                    <TransactionRow key={t.id} transaction={t} />
                  ))}
              </details>
              <p className="sheet-note">
                Observed: 15 purchases through Oct 23, compared with 10 through
                the 23rd in July–September. All data is synthetic.
              </p>
            </>
          )}
          {modal === "correction" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setContext(draftContext.trim());
                setModal(null);
                setToast("Context saved. Transaction facts are unchanged.");
              }}
            >
              <p>
                Travel, reimbursements, or a celebration? Add context so the
                next plan can take it into account.
              </p>
              <textarea
                aria-label="Correct the interpretation"
                placeholder="Some of these meals will be reimbursed…"
                maxLength={300}
                value={draftContext}
                onChange={(e) => setDraftContext(e.target.value)}
              />
              <Button type="submit">
                Save context
                <Icon name="check" />
              </Button>
            </form>
          )}
          {modal === "why" && (
            <>
              <span className="overline">SIGNALS USED</span>
              <ul className="signal-list">
                <li>Recent dining purchases</li>
                <li>Equivalent July–September date ranges (days 1–23)</li>
                <li>Your Vacation Fund target</li>
                <li>Preferences and context you explicitly provided</li>
              </ul>
              <span className="overline">NOT USED</span>
              <p>Demographic assumptions or unrelated account information.</p>
              <div className="math-lines">
                <div>
                  <span>Already saved</span>
                  <b>{money(goal.saved)}</b>
                </div>
                <div>
                  <span>Scheduled contribution</span>
                  <b>{money(goal.base)} / mo</b>
                </div>
                <div>
                  <span>This plan’s adjustment</span>
                  <b>+{money(p.extra)} / mo</b>
                </div>
                <div>
                  <span>Months remaining</span>
                  <b>{scenario.months || goal.months}</b>
                </div>
                <div className="math-total">
                  <span>Projected savings</span>
                  <b>{money(p.projected)}</b>
                </div>
              </div>
              <p className="sheet-note">
                {money(goal.saved)} + ({money(goal.base)} + {money(p.extra)}) ×{" "}
                {scenario.months || goal.months}
                {scenario.life?.event &&
                scenario.life.event.funding !== "checking" &&
                scenario.life.event.month <= (scenario.months || goal.months)
                  ? ` − ${money(scenario.life.event.amount)} one-time expense`
                  : ""}
                . Assumes the full reduction is saved.{" "}
                {scenario.life?.event
                  ? scenario.tradeoffs.at(-1)
                  : "No withdrawals modeled."}{" "}
                No interest or automatic transfers. A checking-buffer check uses
                today’s balance only.
              </p>
            </>
          )}
          {modal === "adjust" && (
            <>
              <p>Amounts are monthly reductions. Essentials stay protected.</p>
              {adjustable.map((c) => (
                <div className="adjustment" key={c}>
                  <div className="adjustment-title">
                    <span>
                      {c}
                      <small>Currently {money(currentTotals[c])} / month</small>
                    </span>
                    <button
                      className={`protect-button ${preferences.protectedCategories.includes(c) ? "locked" : ""}`}
                      aria-pressed={preferences.protectedCategories.includes(c)}
                      onClick={() => protect(c)}
                    >
                      <Icon
                        name={
                          preferences.protectedCategories.includes(c)
                            ? "lock"
                            : "unlock"
                        }
                      />
                      {preferences.protectedCategories.includes(c)
                        ? "Protected"
                        : "Protect"}
                    </button>
                  </div>
                  <div className="adjustment-value">
                    <strong>{money(scenario.adjustments[c])}</strong>
                    <span>less / month</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={caps[c]}
                    step={5}
                    value={scenario.adjustments[c]}
                    disabled={preferences.protectedCategories.includes(c)}
                    aria-label={`${c} monthly reduction`}
                    aria-valuetext={`${money(scenario.adjustments[c])} less per month`}
                    onPointerDown={remember}
                    onKeyDown={(e) => {
                      if (
                        ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                          e.key,
                        )
                      )
                        remember();
                    }}
                    onChange={(e) => modify(c, Number(e.target.value))}
                    style={
                      {
                        "--fill": `${(scenario.adjustments[c] / caps[c]) * 100}%`,
                      } as React.CSSProperties
                    }
                  />
                </div>
              ))}
              <div className="adjust-total">
                <span>Projected savings</span>
                <strong aria-live="polite">{money(p.projected)}</strong>
              </div>
              <Button onClick={() => setModal(null)}>
                Done
                <Icon name="check" />
              </Button>
            </>
          )}
          {modal === "ask" && (
            <form onSubmit={askAgent}>
              <p>
                {mode === "live"
                  ? "Describe the tradeoff in your own words. The agent will compare options using your sample spending."
                  : "Try a preference below. Live natural-language planning becomes available when a server API key is configured."}
              </p>
              <textarea
                aria-label="Planning request"
                placeholder="I eat out with friends a lot. Find another way."
                maxLength={1000}
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                required
                disabled={busy}
              />
              <div className="prompt-examples">
                <button
                  type="button"
                  onClick={() =>
                    setRequest("Keep dining unchanged. Find another way.")
                  }
                >
                  Keep dining
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRequest("No subscription changes. Save $55 a month.")
                  }
                >
                  Save $55, keep subscriptions
                </button>
              </div>
              {busy && (
                <div className="processing" role="status" aria-live="polite">
                  <span className="processing-bars">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>{pendingWords[mode === "live" ? 1 : 0]}…</span>
                </div>
              )}
              {networkError && (
                <div className="error-message" role="alert">
                  <strong>Couldn’t reach the planner.</strong>
                  <p>
                    Your request and plan are unchanged. Check that the local
                    server is running, then retry.
                  </p>
                </div>
              )}
              <Button type="submit" disabled={busy || !request.trim()}>
                {busy
                  ? "Comparing options…"
                  : networkError
                    ? "Retry planning"
                    : "Find another way"}
                <Icon name="arrow" />
              </Button>
              {busy && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    abort.current?.abort();
                    setBusy(false);
                  }}
                >
                  Cancel
                </button>
              )}
              <p className="sheet-note">
                The sample request and your synthetic spending are sent to the
                model only in live mode. API keys remain on the server.
              </p>
            </form>
          )}
          {modal === "review" && (
            <>
              <div className="review-amount">
                +{money(p.extra)}
                <span>
                  additional monthly savings · {money(p.monthly)} total
                </span>
              </div>
              <div className="review-changes">
                <div>
                  <span>Goal date</span>
                  <b>
                    {dateLabel(addMonths(goal.months))} →{" "}
                    {dateLabel(p.targetDate)}
                  </b>
                </div>
                <div>
                  <span>Total savings target</span>
                  <b>{money(p.monthly)} / month</b>
                </div>
                {scenario.life?.event && (
                  <p className="sheet-note">{scenario.tradeoffs.at(-1)}</p>
                )}
                <p className="sheet-note">
                  {preferences.protectedCategories.join(", ")} stay protected.
                </p>
                {adjustable
                  .filter((c) => scenario.adjustments[c] > 0)
                  .map((c) => (
                    <div key={c}>
                      <span>{c} target</span>
                      <b>
                        {money(currentTotals[c] - scenario.adjustments[c])} /
                        month
                      </b>
                    </div>
                  ))}
              </div>
              <label className="reminder-toggle">
                <span>
                  <strong>Weekly check-in</strong>
                  <small>Saved preference, no real notification</small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={reminder}
                  onChange={(e) => setReminder(e.target.checked)}
                />
              </label>
              <div className="reminder-day">
                <label htmlFor="day">My day</label>
                <select
                  id="day"
                  disabled={!reminder}
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                >
                  {[
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="approval-boundary">
                <h3>With your approval</h3>
                <p>
                  <Icon name="check" />
                  Save targets and update projections in this demo.
                </p>
                <p>
                  <Icon name="close" />
                  No money will be transferred automatically. No transaction
                  blocking or bank account changes.
                </p>
              </div>
              {p.gap > 0 && (
                <p className="gap-note">
                  This plan leaves {money(p.gap)} still to save.
                </p>
              )}
              <button className="text-button" onClick={() => setModal("why")}>
                Why this recommendation?
                <Icon name="info" />
              </button>
              <Button onClick={activate}>
                Activate plan
                <Icon name="check" />
              </Button>
              <Button
                secondary
                onClick={() => setModal(scenario.life ? null : "adjust")}
              >
                Edit plan
              </Button>
            </>
          )}
          {modal === "goal" && (
            <GoalForm
              goal={goal}
              onSave={(next) => {
                setGoal(next);
                setScenario(calculateSuggestion(next, preferences));
                setPlan(null);
                setModal(null);
                setToast("Goal updated. Review a new plan for this goal.");
              }}
            />
          )}
          {modal === "about" && (
            <>
              <AgentLabel example={mode === "example"} />
              <p>
                Money Moves connects spending changes to your goals. It can
                analyze and propose; you decide what becomes a plan.
              </p>
              <p>
                {mode === "live"
                  ? "Live planning is configured. Natural-language requests use a server-side model and deterministic tools."
                  : "Example mode is active. The server-side agent is implemented but no model API key is configured. Presets and projections work without AI."}
              </p>
              <p className="sheet-note">
                Synthetic financial data. Browser-local persistence. No real
                bank account, transfers, or notification service.
              </p>
            </>
          )}
          {(modal === "pause" || modal === "off") && (
            <>
              <p>
                {modal === "pause"
                  ? "Your targets stay saved. Resume when you’re ready."
                  : "Your active targets and check-in preference will be removed. Your savings goal stays."}
              </p>
              <Button
                onClick={() => {
                  setPlan(
                    modal === "off"
                      ? null
                      : plan
                        ? { ...plan, status: "paused" }
                        : null,
                  );
                  setModal(null);
                  if (modal === "off") go("goals");
                }}
              >
                {modal === "pause" ? "Pause plan" : "Turn off plan"}
              </Button>
              <Button secondary onClick={() => setModal(null)}>
                Keep my plan
              </Button>
            </>
          )}
        </Sheet>
      )}
      {toast && (
        <div id="toast" className="visible" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
function GoalForm({
  goal,
  onSave,
}: {
  goal: Goal;
  onSave: (goal: Goal) => void;
}) {
  const [name, setName] = useState(goal.name),
    [target, setTarget] = useState(String(goal.target)),
    [months, setMonths] = useState(String(goal.months)),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const checked = goalSchema.safeParse({
          ...goal,
          name,
          target: Number(target),
          months: Number(months),
        });
        if (!checked.success) {
          setError(
            "Choose a target above your current savings and a timeline of 1–60 months.",
          );
          return;
        }
        onSave(checked.data);
      }}
    >
      <label className="field-label">
        Goal name
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          required
        />
      </label>
      <div className="field-grid">
        <label className="field-label">
          Amount ($)
          <input
            className="field"
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            min={goal.saved + 1}
            max={100000}
            required
          />
        </label>
        <label className="field-label">
          Months to go
          <input
            className="field"
            type="number"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            min={1}
            max={60}
            step={1}
            required
          />
        </label>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <p className="sheet-note">
        {money(goal.saved)} saved · {money(goal.base)} scheduled each month.
      </p>
      <Button type="submit">
        Save goal
        <Icon name="check" />
      </Button>
    </form>
  );
}
