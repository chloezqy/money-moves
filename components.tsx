import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { icon } from "./icons.js";
import { money, dateLabel } from "./finance";
import type { Goal, Scenario, Transaction } from "./model";
export function Icon({ name }: { name: string }) {
  return (
    <span
      className="icon-wrap"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icon(name) }}
    />
  );
}
export function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={`button ${secondary ? "secondary" : "primary"}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function IconButton({
  name,
  label,
  onClick,
}: {
  name: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="icon-button" aria-label={label} onClick={onClick}>
      <Icon name={name} />
    </button>
  );
}
export function AgentLabel({ example = false }: { example?: boolean }) {
  return (
    <div className="agent-label">
      <span className="agent-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>Money Moves</span>
      {example && <small>Example mode</small>}
    </div>
  );
}
export function TransactionRow({
  transaction: t,
}: {
  transaction: Transaction;
}) {
  const glyph: Record<string, string> = {
    Dining: "utensils",
    Groceries: "basket",
    Transport: "train",
    Entertainment: "music",
    Subscriptions: "repeat",
    Shopping: "bag",
    Bills: "home",
  };
  return (
    <div className="transaction">
      <span className="merchant-icon">
        <Icon name={glyph[t.category]} />
      </span>
      <div>
        <strong>{t.merchant}</strong>
        <small>
          {dateLabel(t.date)} · {t.category}
        </small>
      </div>
      <b>−{money(t.amount, true)}</b>
    </div>
  );
}
export function GoalProgress({ goal }: { goal: Goal }) {
  return (
    <>
      <div className="goal-row">
        <span className="goal-glyph">
          <Icon name="plane" />
        </span>
        <div>
          <strong>{goal.name}</strong>
          <small>
            Target{" "}
            {dateLabel(
              new Date(Date.UTC(2026, 9 + goal.months, 23))
                .toISOString()
                .slice(0, 10),
            )}
          </small>
        </div>
        <span>
          {money(goal.saved)}
          <small>of {money(goal.target)}</small>
        </span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={`${goal.name} savings`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((goal.saved / goal.target) * 100)}
      >
        <i
          style={{
            width: `${Math.min(100, (goal.saved / goal.target) * 100)}%`,
          }}
        />
      </div>
      <div className="goal-foot">
        <span>{Math.round((goal.saved / goal.target) * 100)}% saved</span>
        <span>{goal.months} months to go</span>
      </div>
    </>
  );
}
export function Forecast({
  scenario,
  goal,
}: {
  scenario: Scenario;
  goal: Goal;
}) {
  const p = scenario.projection,
    max = Math.max(goal.target * 1.15, p.projected * 1.08);
  const y = (value: number) => 125 - (value / max) * 100;
  const points = (monthly: number) =>
    Array.from(
      { length: goal.months + 1 },
      (_, i) => `${8 + (i / goal.months) * 320},${y(goal.saved + monthly * i)}`,
    ).join(" ");
  return (
    <section className="forecast">
      <div className="forecast-heading">
        <div>
          <span>Projected by {dateLabel(p.targetDate)}</span>
          <strong>{money(p.projected)}</strong>
        </div>
        <span className={`status ${p.gap ? "warning" : ""}`}>
          <Icon name={p.gap ? "flag" : "check"} />
          {p.gap ? `${money(p.gap)} short` : "On target"}
        </span>
      </div>
      <svg
        viewBox="0 0 344 150"
        role="img"
        aria-label={`With this plan ${money(p.projected)}, compared with ${money(p.baseline)} on your current savings path. Goal ${money(goal.target)}.`}
      >
        <line
          x1="8"
          x2="328"
          y1={y(goal.target)}
          y2={y(goal.target)}
          stroke="#cbd3e4"
          strokeDasharray="3 4"
        />
        <text x="328" y={y(goal.target) - 8} textAnchor="end">
          {money(goal.target)} goal
        </text>
        <polyline
          points={points(goal.base)}
          fill="none"
          stroke="#aab5c9"
          strokeWidth="2"
          strokeDasharray="4 5"
        />
        <polyline
          points={points(p.monthly)}
          fill="none"
          stroke="#405ee0"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="328" cy={y(p.projected)} r="4" fill="#405ee0" />
        <text x="8" y="149">
          Today
        </text>
        <text x="328" y="149" textAnchor="end">
          {dateLabel(p.targetDate)}
        </text>
      </svg>
      <div className="forecast-key">
        <span>
          <i />
          With your plan
        </span>
        <span>
          <i />
          Current path
        </span>
      </div>
      <p className="forecast-date">
        Estimated goal date:{" "}
        <b>{p.goalDate ? dateLabel(p.goalDate) : "No regular contribution"}</b>
      </p>
    </section>
  );
}
export function Sheet({
  title,
  eyebrow,
  children,
  onClose,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previous.current = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      document.body.style.overflow = old;
      previous.current?.focus?.();
    };
  }, []);
  return createPortal(
    <div
      className="overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key === "Tab") {
            const nodes = [
              ...ref.current!.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input:not(:disabled),textarea,select:not(:disabled),a[href]",
              ),
            ];
            const first = nodes[0],
              last = nodes.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <span className="sheet-handle" />
        <IconButton name="close" label="Close dialog" onClick={onClose} />
        {eyebrow && <span className="overline">{eyebrow}</span>}
        <h2 id="sheet-title">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
export function Dock({
  children,
  note,
}: {
  children: ReactNode;
  note?: string;
}) {
  return (
    <div className="flow-dock">
      {children}
      {note && <p>{note}</p>}
    </div>
  );
}
