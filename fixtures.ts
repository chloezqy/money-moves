import type { Category, Goal, Transaction } from "./model";
export const asOf = "2026-10-23";
export const balance = 8452.8;
export const initialGoal: Goal = {
  name: "Vacation Fund",
  saved: 400,
  target: 1000,
  months: 5,
  base: 60,
};
export const categories: Category[] = [
  "Dining",
  "Groceries",
  "Transport",
  "Entertainment",
  "Subscriptions",
  "Shopping",
  "Bills",
];
const monthTotals: Record<Category, number[]> = {
  Dining: [200, 200, 200, 200, 320],
  Groceries: [340, 355, 360, 345, 360],
  Transport: [135, 140, 145, 140, 140],
  Entertainment: [145, 165, 160, 170, 180],
  Subscriptions: [80, 80, 80, 80, 80],
  Shopping: [230, 250, 240, 260, 280],
  Bills: [1600, 1600, 1600, 1600, 1600],
};
const merchants: Record<Category, string[]> = {
  Dining: [
    "La Prima Espresso",
    "Sweetgreen",
    "Noodlehead",
    "Tako",
    "Blue Bottle Coffee",
  ],
  Groceries: ["Trader Joe’s", "Whole Foods Market"],
  Transport: ["Pittsburgh Regional Transit", "Lyft"],
  Entertainment: ["AMC Waterfront", "City events"],
  Subscriptions: ["Streaming & music", "Other subscriptions"],
  Shopping: ["Uniqlo", "Target"],
  Bills: ["Rent", "Utilities & internet"],
};
export const ledger: Transaction[] = [];
for (let month = 6; month <= 10; month++) {
  for (const category of categories) {
    const total = monthTotals[category][month - 6];
    if (category === "Dining") {
      // Ten routine purchases total $200. October adds five small purchases totalling $120.
      for (let i = 0; i < 10; i++)
        ledger.push({
          id: `${month}-d-${i}`,
          date: `2026-${String(month).padStart(2, "0")}-${String(2 + i * 2).padStart(2, "0")}`,
          merchant: merchants.Dining[i % 5],
          category,
          amount: 20,
        });
      if (month === 10)
        [18, 22, 24, 28, 28].forEach((amount, i) =>
          ledger.push({
            id: `10-extra-${i}`,
            date: `2026-10-${[17, 19, 20, 22, 23][i]}`,
            merchant: [
              "Sweetgreen",
              "Noodlehead",
              "Tako",
              "DoorDash",
              "Noodlehead",
            ][i],
            category,
            amount,
            contributing: true,
          }),
        );
    } else {
      const first =
        category === "Bills" ? 1350 : Math.round(total * 0.58 * 100) / 100;
      [first, Math.round((total - first) * 100) / 100].forEach((amount, i) =>
        ledger.push({
          id: `${month}-${category}-${i}`,
          date: `2026-${String(month).padStart(2, "0")}-${i ? "18" : "04"}`,
          merchant: merchants[category][i],
          category,
          amount,
        }),
      );
    }
  }
}
export const currentTransactions = ledger
  .filter((t) => t.date.startsWith("2026-10"))
  .sort((a, b) => b.date.localeCompare(a.date));
export const currentTotals = Object.fromEntries(
  categories.map((c) => [
    c,
    Math.round(
      currentTransactions
        .filter((t) => t.category === c)
        .reduce((sum, t) => sum + t.amount, 0) * 100,
    ) / 100,
  ]),
) as Record<Category, number>;
export const monthlyDining = [6, 7, 8, 9, 10].map((m) => ({
  month: ["Jun", "Jul", "Aug", "Sep", "Oct"][m - 6],
  total: ledger
    .filter(
      (t) =>
        t.category === "Dining" &&
        t.date.startsWith(`2026-${String(m).padStart(2, "0")}`),
    )
    .reduce((n, t) => n + t.amount, 0),
}));
