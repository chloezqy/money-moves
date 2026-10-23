import { addMonths, dateLabel, money } from "./finance";
import { balance } from "./fixtures";
import type { Goal, Category } from "./model";
import type { LifeState } from "./life";
export const fundingLabels = {
  checking: "Pay from checking",
  savings: "Reduce that month’s contribution",
  vacation: "Withdraw from Vacation Fund",
};
export function LifeConstraints({
  goal,
  state,
  busy,
  edit,
}: {
  goal: Goal;
  state: LifeState;
  busy: boolean;
  edit: (next: LifeState) => void;
}) {
  return (
    <div className="life-constraints">
      <div>
        <span className="constraint-type">PROTECTED</span>
        <div className="life-protections">
          {[
            "Dining",
            "Groceries",
            "Shopping",
            "Subscriptions",
            "Entertainment",
            "Bills",
          ].map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={state.protectedCategories.includes(c as Category)}
              disabled={busy || c === "Groceries" || c === "Bills"}
              className={
                state.protectedCategories.includes(c as Category)
                  ? "protected"
                  : ""
              }
              onClick={() =>
                edit({
                  ...state,
                  protectedCategories: state.protectedCategories.includes(
                    c as Category,
                  )
                    ? state.protectedCategories.filter((x) => x !== c)
                    : [...state.protectedCategories, c as Category],
                  shoppingReduction:
                    c === "Shopping" ? null : state.shoppingReduction,
                })
              }
            >
              {state.protectedCategories.includes(c as Category) ? "✓" : "+"}{" "}
              {c}
            </button>
          ))}
        </div>
      </div>
      {state.event && (
        <div className="event-editor">
          <span className="constraint-type">UPCOMING · {state.event.name}</span>
          <div className="event-fields">
            <label>
              Amount{" "}
              <span>
                $
                <input
                  type="number"
                  aria-label="Event amount"
                  min="1"
                  max="100000"
                  value={state.event.amount}
                  disabled={busy}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (n > 0 && n <= 100000)
                      edit({
                        ...state,
                        event: { ...state.event!, amount: n },
                      });
                  }}
                />
              </span>
            </label>
            <label>
              When
              <select
                aria-label="Event month"
                value={state.event.month}
                disabled={busy}
                onChange={(e) =>
                  edit({
                    ...state,
                    event: {
                      ...state.event!,
                      month: Number(e.target.value),
                    },
                  })
                }
              >
                {Array.from({ length: 60 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(
                      `${addMonths(i + 1)}T12:00:00Z`,
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="remove-event"
              aria-label="Remove life event"
              disabled={busy}
              onClick={() => edit({ ...state, event: null })}
            >
              ×
            </button>
          </div>
          <label className="funding-select">
            Funding assumption
            <select
              aria-label="Expense funding source"
              disabled={busy}
              value={state.event.funding}
              onChange={(e) =>
                edit({
                  ...state,
                  event: {
                    ...state.event!,
                    funding: e.target.value as NonNullable<
                      LifeState["event"]
                    >["funding"],
                  },
                })
              }
            >
              {Object.entries(fundingLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p>
            {state.event.funding === "checking"
              ? `${money(state.event.amount)} comes from checking; your ${money(goal.saved)} saved stays intact. Today’s remaining checking balance: ${money(balance - state.event.amount)}. Future bills are not modeled.`
              : state.event.funding === "savings"
                ? "Only the event month’s contribution is reduced. Paths must cover the full expense without a withdrawal."
                : "This explicitly models a one-time withdrawal from your Vacation Fund."}
          </p>
        </div>
      )}
      <div className="deadline-editor">
        <span>
          <span className="constraint-type">{goal.name.toUpperCase()}</span>
          <b>
            {money(state.target ?? goal.target)} ·{" "}
            {dateLabel(addMonths(state.horizon ?? goal.months))}
          </b>
          <select
            className="goal-timeline"
            aria-label="Goal timeline"
            disabled={busy}
            value={state.horizon ?? goal.months}
            onChange={(e) =>
              edit({ ...state, horizon: Number(e.target.value) })
            }
          >
            {state.horizon === 0 && (
              <option value={0}>Before next checkpoint</option>
            )}
            {Array.from({ length: 60 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(`${addMonths(i + 1)}T12:00:00Z`).toLocaleDateString(
                  "en-US",
                  {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  },
                )}
              </option>
            ))}
          </select>
        </span>
        <button
          type="button"
          disabled={busy}
          aria-pressed={state.deadlineHard}
          onClick={() => edit({ ...state, deadlineHard: !state.deadlineHard })}
        >
          {state.deadlineHard ? "⊙ Date protected" : "↔ Date flexible"}
        </button>
      </div>
      {state.shoppingReduction !== null && (
        <label className="shopping-constraint">
          Shopping reduction <b>{money(state.shoppingReduction)} / month</b>
          <input
            aria-label="Shopping reduction constraint"
            type="range"
            min="0"
            max="80"
            step="5"
            disabled={busy}
            value={state.shoppingReduction}
            onChange={(e) =>
              edit({
                ...state,
                shoppingReduction: Number(e.target.value),
              })
            }
          />
          <button
            disabled={busy}
            onClick={() => edit({ ...state, shoppingReduction: null })}
          >
            Remove fixed amount
          </button>
        </label>
      )}
    </div>
  );
}
