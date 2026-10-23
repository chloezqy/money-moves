import { limits } from './data.js';
export function simulate(goal, adjustments) {
 const monthlyExtra=Object.values(adjustments).reduce((a,b)=>a+b,0);
 const projected=goal.saved+(goal.base+monthlyExtra)*goal.months;
 return {monthlyExtra,projected,gap:Math.max(0,goal.target-projected),surplus:Math.max(0,projected-goal.target),progress:Math.min(100,projected/goal.target*100),needed:Math.max(0,Math.ceil((goal.target-goal.saved)/goal.months-goal.base))};
}
// Deterministic, constraint-aware prototype planner. This is not a live language model.
export function suggestPlan(goal, protectedCategories=[], request='') {
 const protectedSet = new Set(protectedCategories);
 if(/(?:keep|protect|don.t (?:cut|reduce)|without (?:cutting|reducing))\s+(?:my\s+)?(?:friday dinners|dining|restaurants)/i.test(request)) protectedSet.add('Dining');
 let needed = Math.max(0,Math.ceil((goal.target-goal.saved)/goal.months-goal.base));
 if(/(?:save|extra)\s*\$?(\d+)/i.test(request)) needed = Number(request.match(/(?:save|extra)\s*\$?(\d+)/i)[1]);
 const adjustments={Dining:0,Shopping:0,Subscriptions:0};
 for(const category of Object.keys(limits)) {
  if(protectedSet.has(category)) continue;
  const amount=Math.min(limits[category],Math.max(0,Math.ceil(needed/5)*5));
  adjustments[category]=amount; needed-=amount;
 }
 const result=simulate(goal,adjustments);
 const explanation = result.gap>0 ? `With your preferences protected, this plan leaves a $${result.gap} gap. Try a smaller goal, a longer timeline, or a different adjustment.` : protectedSet.has('Dining') ? 'Your dinners stay just as they are. Making a little room in shopping and subscriptions can help close the gap instead.' : 'A small dining adjustment covers your savings gap. Your groceries and everyday essentials stay untouched.';
 return {adjustments,protectedCategories:[...protectedSet],explanation};
}
export function validateAdjustments(adjustments,protectedCategories=[]) {
 return Object.fromEntries(Object.entries(limits).map(([k,max])=>[k,protectedCategories.includes(k)?0:Math.max(0,Math.min(max,Number(adjustments[k])||0))]));
}
