import { FuturePaths } from "./FuturePaths";
import { LifeConstraints, fundingLabels } from "./LifeConstraints";
import { ScenarioDetails } from "./ScenarioDetails";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Icon } from "./components";
import { type Goal, type Preferences, type Scenario } from "./model";
import { addMonths, dateLabel, money } from "./finance";
import {
  initialLifeState,
  limitations,
  lifeStateSchema,
  generateFeasiblePaths,
  type LifeState,
  type LifeResult,
  type FutureScenario,
} from "./life";
const flagship =
  "I have a wedding next month and need an extra $200. I don't want to cut dining because that's how I spend time with friends. Can I still reach my vacation goal?";
function restored(): LifeState {
  try {
    return lifeStateSchema.parse(
      JSON.parse(sessionStorage.getItem("money-moves-life") || "null"),
    );
  } catch {
    return initialLifeState();
  }
}
export function LifeHappens({
  goal,
  preferences,
  selected,
  onSelect,
  onClear,
  onBusy,
  mode,
}: {
  goal: Goal;
  preferences: Preferences;
  selected: Scenario;
  onSelect: (s: FutureScenario, p: Preferences) => void;
  onClear: () => void;
  onBusy: (busy: boolean) => void;
  mode: "live" | "example";
}) {
  const [state, setState] = useState<LifeState>(selected.life || restored);
  const hasSavedConstraints = Boolean(
    selected.life ||
    state.event ||
    state.deadlineHard ||
    state.protectedCategories.length > 2 ||
    state.shoppingReduction !== null ||
    state.target !== null,
  );
  const [result, setResult] = useState<LifeResult | null>(
    hasSavedConstraints
      ? {
          source: "example",
          state,
          scenarios: [],
          summary: "Your saved path. Edit a constraint to explore again.",
          clarification: null,
          tools: [],
          limitations,
        }
      : null,
  );
  const [composerOpen, setComposerOpen] = useState(!hasSavedConstraints);
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [exampleMode, setExampleMode] = useState(false);
  const isExample = mode === "example" || exampleMode;
  const [error, setError] = useState("");
  const [localEdit, setLocalEdit] = useState(hasSavedConstraints);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const output = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const field = input.current;
    if (field) {
      field.style.height = "auto";
      field.style.height = `${Math.min(260, Math.max(128, field.scrollHeight))}px`;
    }
  }, [draft, composerOpen]);
  useEffect(() => {
    onBusy(busy || composerOpen);
  }, [busy, composerOpen, onBusy]);
  useEffect(() => {
    try {
      sessionStorage.setItem("money-moves-life", JSON.stringify(state));
    } catch {}
  }, [state]);
  const effectivePreferences = {
    ...preferences,
    protectedCategories: state.protectedCategories,
  };
  const paths =
    result && !result.clarification
      ? generateFeasiblePaths(goal, effectivePreferences, state)
      : [];
  const chosen = paths.find((p) => p.id === selected.id) || null;
  useEffect(() => {
    if (hasSavedConstraints && !paths.length) onClear();
    else if (hasSavedConstraints && paths.length && !chosen)
      onSelect(paths[0], effectivePreferences);
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !draft.trim()) return;
    const requestSequence = ++sequence.current;
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      const http = await fetch("/api/life", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: draft,
          goal,
          preferences: effectivePreferences,
          state,
          example: isExample,
        }),
        signal: controller.current.signal,
      });
      if (!http.ok)
        throw new Error(
          "Couldn’t reach the planner. Your current plan is unchanged. Please retry.",
        );
      const response: LifeResult = await http.json();
      if (requestSequence !== sequence.current) return;
      const next = lifeStateSchema.parse(response.state);
      setState(next);
      setResult(response);
      setLocalEdit(false);
      const validated = response.clarification
        ? []
        : generateFeasiblePaths(
            goal,
            { ...preferences, protectedCategories: next.protectedCategories },
            next,
          );
      if (validated.length)
        onSelect(validated[0], {
          ...preferences,
          protectedCategories: next.protectedCategories,
        });
      else onClear();
      setDraft("");
      setComposerOpen(Boolean(response.clarification));
      requestAnimationFrame(() => {
        output.current?.focus({ preventScroll: true });
        output.current?.scrollIntoView({
          block: "start",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
      });
    } catch (e) {
      if (
        requestSequence === sequence.current &&
        (e as Error).name !== "AbortError"
      )
        setError((e as Error).message);
    } finally {
      if (requestSequence === sequence.current) setBusy(false);
    }
  }
  function edit(next: LifeState) {
    setState(next);
    setLocalEdit(true);
    const calculated = generateFeasiblePaths(
      goal,
      { ...preferences, protectedCategories: next.protectedCategories },
      next,
    );
    setResult({
      source: result?.source || "example",
      state: next,
      scenarios: calculated,
      summary: "Updated from your edited constraints.",
      clarification: null,
      tools: [],
      limitations: result?.limitations || [],
    });
    if (calculated.length)
      onSelect(calculated[0], {
        ...preferences,
        protectedCategories: next.protectedCategories,
      });
    else onClear();
  }
  return (
    <section
      className={`life-workspace ${result ? "has-futures" : "is-starting"}`}
      aria-labelledby="life-title"
    >
      <div className="life-kicker">
        <span className="branch-mark">⑂</span> LIFE HAPPENS{" "}
        <span>
          {localEdit
            ? "Calculated paths"
            : result?.source === "fallback"
              ? "AI unavailable · Example mode"
              : result?.source === "example"
                ? "Example mode"
                : isExample
                  ? "Example mode"
                  : "Live AI available"}
        </span>
      </div>
      <h2 id="life-title">
        {result ? "Your possible futures" : "What changed?"}
      </h2>
      {result && (
        <div className="situation-summary">
          <div>
            <span>Your situation</span>
            <strong>
              {state.event
                ? `${state.event.name} · ${money(state.event.amount)}`
                : "Your priorities, reflected"}
            </strong>
            <small>
              {state.event
                ? `In ${new Date(`${addMonths(state.event.month)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })} · ${fundingLabels[state.event.funding]}`
                : "Explore the tradeoffs that work for you"}
            </small>
          </div>
          <button
            type="button"
            aria-expanded={composerOpen}
            onClick={() => {
              setComposerOpen(!composerOpen);
              requestAnimationFrame(() => input.current?.focus());
            }}
          >
            {" "}
            {composerOpen ? "Close" : "Update"} <Icon name="edit" />
          </button>
        </div>
      )}
      <div className="life-composer" hidden={!composerOpen}>
        <label className="life-mode">
          <input
            type="checkbox"
            checked={isExample}
            disabled={busy || mode === "example"}
            onChange={(e) => setExampleMode(e.target.checked)}
          />
          Use Example mode <small>Scripted interpretation</small>
        </label>
        <p className="life-intro">
          Tell us what’s happening. We’ll explore how it affects your goal.
        </p>
        <form className="life-input" onSubmit={submit}>
          <label htmlFor="life-request">
            {result ? "What else has changed?" : "What changed in your life?"}
          </label>
          <textarea
            id="life-request"
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
            disabled={busy}
            placeholder={
              result
                ? "Actually, I could reduce shopping by $30, but keep my vacation date…"
                : "I have a wedding next month, but I still want to save for my vacation…"
            }
            required
          />
          <div className="life-input-footer">
            <small>
              {isExample
                ? "Scripted interpretation · real calculations"
                : "Explore freely. Nothing moves."}
            </small>
            <Button type="submit" disabled={busy || !draft.trim()}>
              {busy
                ? "Exploring…"
                : result
                  ? "Update paths"
                  : "Explore futures"}
              <Icon name="arrow" />
            </Button>
          </div>
        </form>
        <div className="life-prompts">
          {[
            ["Unexpected expense", flagship],
            ["Protect a priority", "Keep dining unchanged. Find another way."],
            [
              "Change my timeline",
              "I would prefer a later vacation date to keep my lifestyle.",
            ],
          ].map(([label, text]) => (
            <button
              key={label}
              disabled={busy}
              onClick={() => {
                setDraft(text);
                input.current?.focus();
              }}
            >
              {label}
              <span>↗</span>
            </button>
          ))}
        </div>
      </div>
      {busy && (
        <div className="life-loading" role="status">
          <span className="processing-bars">
            <i />
            <i />
            <i />
          </span>
          <span>
            {isExample
              ? "Interpreting example and calculating paths…"
              : "Understanding your update and comparing financial paths…"}
          </span>
          <button
            type="button"
            onClick={() => {
              ++sequence.current;
              controller.current?.abort();
              setBusy(false);
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div
          className="future-results"
          aria-label="Possible futures results"
          aria-busy={busy}
        >
          <details
            className="constraint-disclosure"
            open={constraintsOpen}
            onToggle={(e) => setConstraintsOpen(e.currentTarget.open)}
          >
            <summary>
              <span>
                <Icon name="shield" />
                {state.protectedCategories
                  .filter((c) => c !== "Bills" && c !== "Groceries")
                  .join(", ") || "Essentials"}{" "}
                protected
              </span>
              <span>
                {state.deadlineHard ? "Date fixed" : "Date flexible"} · Edit
              </span>
            </summary>
            <LifeConstraints
              goal={goal}
              state={state}
              busy={busy}
              edit={edit}
            />
          </details>
          {result.clarification ? (
            <p className="life-clarification" role="status">
              {result.clarification}
            </p>
          ) : (
            <>
              <div className="futures-heading" ref={output} tabIndex={-1}>
                <h3>Choose your path</h3>
                <span>
                  {paths.length} calculated{" "}
                  {paths.length === 1 ? "option" : "options"}
                </span>
              </div>
              {paths.length > 0 ? (
                <>
                  <FuturePaths
                    paths={paths}
                    selected={chosen}
                    goal={goal}
                    state={state}
                    disabled={busy}
                    onSelect={(path) => onSelect(path, effectivePreferences)}
                  />
                  <div
                    className="path-options"
                    role="group"
                    aria-label="Choose a possible future"
                  >
                    {paths.map((path, i) => (
                      <button
                        disabled={busy}
                        type="button"
                        key={path.id}
                        aria-pressed={chosen?.id === path.id}
                        className={`path-option path-${i} ${chosen?.id === path.id ? "is-selected" : ""}`}
                        onClick={() => onSelect(path, effectivePreferences)}
                      >
                        <span className="path-letter">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="path-info">
                          <strong>{path.title}</strong>
                          <small>
                            Reach {dateLabel(path.projection.targetDate)}
                          </small>
                        </span>
                        <span className="path-figures">
                          <strong>
                            {money(path.projection.monthly)}
                            <small>/mo</small>
                          </strong>
                          <small>
                            {path.projection.extra
                              ? `${money(path.projection.extra)} less spending`
                              : "Spending unchanged"}
                          </small>
                        </span>
                        <span className="path-radio">
                          {chosen?.id === path.id ? "✓" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                  {chosen && (
                    <ScenarioDetails key={chosen.id} chosen={chosen} />
                  )}
                  <button
                    className="followup-action"
                    type="button"
                    onClick={() => {
                      setComposerOpen(true);
                      requestAnimationFrame(() => input.current?.focus());
                    }}
                  >
                    Something else changed?
                    <span>
                      Update your situation <Icon name="arrow" />
                    </span>
                  </button>
                </>
              ) : (
                <p className="life-clarification" role="status">
                  No feasible future meets all of these constraints. Try making
                  the date flexible, changing the expense funding, or allowing
                  another spending category. Your active plan has not changed.
                </p>
              )}
            </>
          )}
          <details className="life-transparency">
            <summary>How we explored these paths</summary>
            <p>
              {localEdit
                ? "Current constraints were recalculated directly; no additional model call."
                : result.source === "live"
                  ? "AI interpreted your update. Deterministic tools calculated these futures."
                  : result.source === "fallback"
                    ? "Live model execution failed; the labeled example parser produced these constraints."
                    : "Example mode uses a limited scripted parser, not AI reasoning."}
            </p>
            <p>
              Enforced: {state.protectedCategories.join(", ")} protected;{" "}
              {state.deadlineHard ? "deadline fixed" : "deadline flexible"}.{" "}
              {state.event &&
                `Funding assumption: ${fundingLabels[state.event.funding]}.`}
            </p>
            <p>
              Data: synthetic transactions, goal balance and checking balance as
              of Oct 23, 2026. Category caps: Dining $120, Shopping $80,
              Entertainment $60, Subscriptions $30.
            </p>
            <ul>
              {(localEdit
                ? [
                    "generate_feasible_paths (includes simulation and validation)",
                  ]
                : result.tools
              ).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            {chosen?.evidence.map((e) => (
              <p key={e}>{e}</p>
            ))}
            {result.limitations.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </details>
        </div>
      )}
      <p className="life-boundary">
        Monthly estimates. You choose what becomes a plan.
      </p>
    </section>
  );
}
