import { Icon } from "./components";
import { dateLabel, money } from "./finance";
import { currentTotals } from "./fixtures";
import { adjustable } from "./model";
import type { FutureScenario } from "./life";
export function ScenarioDetails({ chosen }: { chosen: FutureScenario }) {
  return (
    <div className="path-details" aria-live="polite" aria-atomic="true">
      <div className="path-outcome">
        <div>
          <span>PLANNED COMPLETION</span>
          <strong>{dateLabel(chosen.projection.targetDate)}</strong>
        </div>
        <div>
          <span>MONTHLY SAVINGS</span>
          <strong>{money(chosen.projection.monthly)}</strong>
        </div>
      </div>
      <div className="selected-priorities">
        <Icon name="shield" />
        {chosen.life.protectedCategories.join(", ")} protected
      </div>
      <div className="path-adjustments">
        {adjustable
          .filter((c) => chosen.adjustments[c] > 0)
          .map((c) => (
            <div key={c}>
              <span>
                {c}
                <small>Observed {money(currentTotals[c])} · Oct 1–23</small>
              </span>
              <b>
                −{money(chosen.adjustments[c])}
                <small>
                  target {money(currentTotals[c] - chosen.adjustments[c])} / mo
                </small>
              </b>
            </div>
          ))}
        {chosen.projection.extra === 0 && (
          <p>Your spending targets stay unchanged.</p>
        )}
      </div>
      <div className="path-tradeoff">
        <span>THE TRADEOFF</span>
        <p>{chosen.tradeoffs.slice(0, 2).join(" ")}</p>
      </div>
    </div>
  );
}
