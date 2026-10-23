import { addMonths, dateLabel, money } from "./finance";
import { emptyAdjustments, type Goal } from "./model";
import { simulateLifeEvent, type LifeState, type FutureScenario } from "./life";

export function FuturePaths({
  paths,
  selected,
  goal,
  state,
  onSelect,
  disabled = false,
}: {
  paths: FutureScenario[];
  selected: FutureScenario | null;
  goal: Goal;
  state: LifeState;
  disabled?: boolean;
  onSelect: (path: FutureScenario) => void;
}) {
  const horizon = Math.max(goal.months, ...paths.map((p) => p.months));
  const target = state.target ?? goal.target;
  const current = simulateLifeEvent(
    goal,
    state,
    emptyAdjustments(),
    horizon,
  ).points;
  const minimum = Math.min(0, ...current, ...paths.flatMap((p) => p.points));
  const max = Math.max(
    target * 1.12,
    ...current,
    ...paths.flatMap((p) => p.points),
  );
  const x = (m: number) => 40 + (m / horizon) * 320;
  const y = (v: number) => 218 - ((v - minimum) / (max - minimum)) * 180;
  const line = (points: number[]) =>
    points
      .map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(" ");
  const colors = paths.map((p) =>
    p.id === selected?.id ? "#4259c9" : "#9b7c63",
  );
  return (
    <figure className="future-chart">
      <div className="chart-context">
        <span>Vacation Fund trajectory</span>
        <b>
          {money(goal.saved)} → {money(target)}
        </b>
      </div>
      <svg
        viewBox="0 0 390 290"
        role="group"
        aria-labelledby="future-chart-title future-chart-desc"
      >
        <title id="future-chart-title">
          Possible savings paths toward {money(target)}
        </title>
        <desc id="future-chart-desc">
          Current path reaches {money(current[current.length - 1])} by{" "}
          {dateLabel(addMonths(horizon))}.{" "}
          {paths
            .map(
              (p) =>
                `${p.title}: ${money(p.projection.monthly)} monthly; ${money(p.projection.projected)} by ${dateLabel(p.projection.targetDate)}.`,
            )
            .join(" ")}{" "}
          {state.event &&
            `Event is ${money(state.event.amount)} in month ${state.event.month}, funded from ${state.event.funding}.`}
        </desc>
        {[minimum, ...(minimum < 0 ? [0] : []), goal.saved, target].map((v) => (
          <g key={v}>
            <line
              x1="40"
              x2="360"
              y1={y(v)}
              y2={y(v)}
              stroke="#deded7"
              strokeDasharray={v === target ? "4 5" : "0"}
            />
            <text x="4" y={y(v) + 4}>
              {money(v)}
            </text>
          </g>
        ))}
        <line
          x1={x(goal.months)}
          x2={x(goal.months)}
          y1="22"
          y2="225"
          stroke="#d4d6de"
          strokeDasharray="3 5"
        />
        <text x={x(goal.months)} y="14" textAnchor="middle">
          Original goal · {dateLabel(addMonths(goal.months))}
        </text>
        {state.event && state.event.month <= horizon && (
          <g>
            <rect
              x={x(state.event.month) - 10}
              y="32"
              width="20"
              height="193"
              fill="#bd9c6a"
              opacity=".08"
            />
            <text x={x(state.event.month)} y="242" textAnchor="middle">
              ◇
            </text>
            <text x={x(state.event.month)} y="258" textAnchor="middle">
              {state.event.name}
            </text>
          </g>
        )}
        <path
          d={line(current)}
          stroke="#a6acb5"
          strokeWidth="2"
          strokeDasharray="5 5"
          fill="none"
        />
        {paths.map((p, i) => (
          <g
            key={p.id}
            className="trajectory-option"
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            aria-label={`Explore ${p.title}`}
            aria-pressed={selected?.id === p.id}
            onClick={() => {
              if (!disabled) onSelect(p);
            }}
            onKeyDown={(e) => {
              if (!disabled && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onSelect(p);
              }
            }}
            opacity={selected?.id === p.id ? 1 : 0.5}
          >
            <path
              d={line(p.points)}
              stroke="transparent"
              strokeWidth="20"
              fill="none"
              pointerEvents="stroke"
            />
            <path
              d={line(p.points)}
              stroke={colors[i]}
              strokeWidth={selected?.id === p.id ? 5 : 2.5}
              fill="none"
            />
            <circle
              cx={x(p.months)}
              cy={y(p.points.at(-1)!)}
              r={selected?.id === p.id ? 8 : 5}
              fill={colors[i]}
              stroke="#fbfaf7"
              strokeWidth="2"
            />
            <text
              x={x(p.months)}
              y={y(p.points.at(-1)!) - 12}
              textAnchor="middle"
              fill={colors[i]}
            >
              {String.fromCharCode(65 + i)}
            </text>
          </g>
        ))}
        <circle cx={x(0)} cy={y(goal.saved)} r="5" fill="#172033" />
        {[0, goal.months, horizon]
          .filter((m, i, a) => a.indexOf(m) === i)
          .map((m) => (
            <text
              key={m}
              x={x(m)}
              y="281"
              textAnchor={m === 0 ? "start" : "middle"}
            >
              {m === 0 ? "Today" : dateLabel(addMonths(m))}
            </text>
          ))}
      </svg>
      <figcaption>
        <span>
          <i className="current-path" />
          Current plan + life event
        </span>
        <span>
          <i
            style={{
              background:
                colors[
                  Math.max(
                    0,
                    paths.findIndex((p) => p.id === selected?.id),
                  )
                ],
            }}
          />
          Selected future
        </span>
        <span>Monthly estimates</span>
      </figcaption>
    </figure>
  );
}
