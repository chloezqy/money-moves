import { INITIAL_GOAL, spending, transactions, money, limits } from './data.js';
import { simulate, suggestPlan, validateAdjustments } from './plan-engine.js';
import { icon, landscape } from './icons.js';

const $ = (selector, root = document) => root.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const read = () => { try { return JSON.parse(localStorage.getItem('money-moves-v1') || '{}'); } catch { return {}; } };
const saved = read();
const state = {
  page: 'overview', goal: { ...INITIAL_GOAL, ...saved.goal }, plan: saved.plan || null,
  adjustments: { Dining: 60, Shopping: 0, Subscriptions: 0 }, protected: [],
  selected: 'small', fineTune: false, note: '', history: [], search: '', category: 'All',
  reminders: saved.reminders ?? true, day: saved.day || 'Monday', hiddenBalance: saved.hiddenBalance || false,
};
let lastFocus;
let toastTimer;

function persist() {
  try {
    const { goal, plan, reminders, day, hiddenBalance } = state;
    localStorage.setItem('money-moves-v1', JSON.stringify({ goal, plan, reminders, day, hiddenBalance }));
  } catch { toast('Your browser couldn’t save this change.'); }
}
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3200);
}
function snapshot() {
  state.history.push({ adjustments: { ...state.adjustments }, protected: [...state.protected], selected: state.selected, note: state.note });
  if (state.history.length > 20) state.history.shift();
}
function result() { return simulate(state.goal, state.adjustments); }
function changeView(update) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (document.startViewTransition && !reduced) document.startViewTransition(update);
  else update();
}
function renderMain(animate = false) {
  const update = () => { $('#main').innerHTML = page(); document.title = `${state.page === 'planner' ? 'Make your next move' : 'Your overview'} · ABC Bank`; };
  if (animate) changeView(update); else update();
  document.querySelectorAll('[data-nav]').forEach(button => {
    const active = button.dataset.nav === state.page;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
}
function navigate(pageName) { closeModal(); state.page = pageName; renderMain(true); window.scrollTo({ top: 0, behavior: 'instant' }); }
const nav = [['overview','home','Overview'],['planner','spark','Money Moves'],['activity','chart','Activity'],['goals','flag','Goals']];
function navigation(mobile = false) {
  return nav.map(([id, glyph, label]) => `<button data-nav="${id}" class="${state.page === id ? 'active' : ''}">${icon(glyph)}<span>${label}</span>${id === 'planner' && !mobile ? '<i class="nav-dot"></i>' : ''}</button>`).join('');
}
function shell() {
  $('#app').innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand" href="#" data-action="home"><span class="brand-symbol"><i></i><i></i><i></i></span>ABC <span>Bank</span></a><div class="nav-caption">YOUR SPACE</div><nav aria-label="Main navigation">${navigation()}</nav><div class="sidebar-bottom"><div class="side-note">${icon('shield')}<span>A little guidance.<br>Always your decision.</span></div><button class="settings-link" data-action="settings">${icon('settings')} Preferences</button><button class="profile" data-action="account"><span class="avatar">AC</span><span>Alex Chen<small>Personal account</small></span>${icon('down')}</button></div></aside><div class="workspace"><header class="topbar"><span class="topbar-greeting">Your money, with a little perspective.</span><span class="mobile-brand">ABC Bank</span><div class="topbar-actions"><button class="mode-label" data-action="about"><i></i> Scenario mode ${icon('info')}</button><button class="icon-button" data-action="notifications" aria-label="Notifications">${icon('bell')}<i class="notification-dot"></i></button><button class="avatar" data-action="account" aria-label="View your account">AC</button></div></header><main id="main" class="main">${page()}</main></div><nav class="mobile-nav" aria-label="Mobile navigation">${navigation(true)}</nav></div>`;
}
function page() {
  if (state.page === 'planner') return planner();
  if (state.page === 'activity') return activity();
  if (state.page === 'goals') return goals();
  if (state.page === 'success') return success();
  return overview();
}
function eyebrow(text, glyph = 'spark') { return `<span class="eyebrow">${icon(glyph)} ${text}</span>`; }
function footer() { return `<footer><span>${icon('lock')} Your money stays in your control.</span><button data-action="about">Sample account · How this works ${icon('arrow')}</button></footer>`; }
function overview() {
  const baseline = simulate(state.goal, {});
  return `<div class="page-title"><div><span class="date">THURSDAY, OCTOBER 22</span><h1>Good morning, Alex<span class="greeting-dot">.</span></h1></div><span class="quiet-label">A good day for a little clarity.</span></div>
    <div class="account-strip"><button class="account-summary" data-action="account"><span class="account-icon">${icon('wallet')}</span><span>Everyday checking<strong>${state.hiddenBalance ? '••,•••.••' : '$8,452.80'}</strong></span><span class="account-number">•• 4829 ${icon('chevron')}</span></button><button class="account-summary" data-nav="goals"><span class="account-icon light">${icon('flag')}</span><span>Your getaway fund<strong>${money(state.goal.saved)} <small>/ ${money(state.goal.target)}</small></strong></span><span class="mini-progress" style="--progress:${state.goal.saved / state.goal.target * 100}%"></span></button></div>
    <section class="discovery"><div class="discovery-copy">${eyebrow('ONE THING WORTH A LOOK')}<h2>Your getaway.<br>Still <em>on the cards.</em></h2><p>Dining’s up $120 this month.<br>A small move could keep your goal on track.</p><button class="button primary" data-action="begin">Find my next move ${icon('arrow')}</button><button class="evidence-link" data-action="evidence">Why this came up ${icon('info')}</button></div><div class="destination"><div class="destination-art">${landscape()}<span class="destination-tag">${icon('plane')} ${escape(state.goal.name)}</span></div><div class="destination-bottom"><div><span>YOUR NEXT CHAPTER</span><strong>${money(state.goal.target)}<small>in ${state.goal.months} months</small></strong></div><div class="destination-stamp">a little<br><em>escape</em><span>✳</span></div></div><div class="destination-progress"><i style="width:${Math.min(100, state.goal.saved/state.goal.target*100)}%"></i></div></div></section>
    <div class="overview-bottom"><section class="spending-summary"><div class="section-head"><h3>This month, at a glance</h3><button class="text-button" data-nav="activity">All activity ${icon('arrow')}</button></div><div class="spend-total">$1,280 <span>spent in October</span></div><div class="spend-bar" role="img" aria-label="Dining 420 dollars, groceries 360 dollars, shopping 280 dollars, transport 140 dollars, subscriptions 80 dollars">${spending.map(c=>`<i style="flex:${c.total};background:${c.color}"></i>`).join('')}</div><div class="spend-legend">${spending.slice(0,3).map(c=>`<span><i style="background:${c.color}"></i>${c.name}<b>${money(c.total)}</b></span>`).join('')}</div></section><section class="next-move-note">${eyebrow(state.plan ? 'YOUR PLAN IS IN PLACE' : 'THE OPPORTUNITY', 'flag')}<h3>${state.plan ? `${money(state.plan.monthlyExtra)} more for your future.` : `${money(baseline.needed)} a month. That’s the gap.`}</h3><p>${state.plan ? 'Your targets are saved. Keep them flexible.' : 'You’re closer than it might feel.'}</p><button class="text-button" data-action="${state.plan ? 'edit-plan' : 'begin'}">${state.plan ? 'Revisit my plan' : 'Show me how'} ${icon('arrow')}</button></section></div>${footer()}`;
}
function selectScenario(choice, record = true) {
  if (record) snapshot();
  const needed = simulate(state.goal, {}).needed;
  const request = choice === 'dinners' ? 'Keep my Friday dinners' : choice === 'cushion' ? `Save $${needed + 30} extra` : 'Find the smallest change';
  const suggested = suggestPlan(state.goal, [], request);
  state.adjustments = suggested.adjustments;
  state.protected = suggested.protectedCategories;
  state.selected = choice;
  state.note = '';
}
function scenarioCards() {
  const need = simulate(state.goal, {}).needed;
  const smallExtra = simulate(state.goal, suggestPlan(state.goal).adjustments).monthlyExtra;
  const dinnerExtra = simulate(state.goal, suggestPlan(state.goal, [], 'Keep my Friday dinners').adjustments).monthlyExtra;
  const cushionExtra = simulate(state.goal, suggestPlan(state.goal, [], `Save $${need + 30} extra`).adjustments).monthlyExtra;
  return `<div class="scenario-choices" role="group" aria-label="Choose a starting point">${[
    ['small','flag','The smallest change','One small adjustment.',smallExtra],
    ['dinners','utensils','Keep the dinners','Make room somewhere else.',dinnerExtra],
    ['cushion','sun','A little breathing room','A cushion for the unexpected.',cushionExtra],
  ].map(([id,glyph,title,sub,amount])=>`<button class="scenario ${state.selected === id ? 'selected' : ''}" data-scenario="${id}" aria-pressed="${state.selected === id}"><span class="scenario-icon">${icon(glyph)}</span><span class="selection-mark">${icon('check')}</span><strong>${title}</strong><small>${sub}</small><span class="scenario-amount">+${money(amount)}<small> / month</small></span></button>`).join('')}</div>`;
}
function forecastChart() {
  const base = simulate(state.goal, {}), projected = result();
  const max = Math.max(state.goal.target * 1.15, projected.projected * 1.05, state.goal.saved * 1.1);
  const y = value => 155 - value/max*125;
  const points = amount => Array.from({length:state.goal.months+1},(_,i)=>`${30+i/state.goal.months*440},${y(state.goal.saved+amount*i)}`).join(' ');
  const targetY = y(state.goal.target);
  return `<svg viewBox="0 0 520 190" class="forecast-svg" role="img" aria-label="Savings projection: ${money(projected.projected)} with your plan, compared with ${money(base.projected)} on your current path"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d2e5c1" stop-opacity=".65"/><stop offset="1" stop-color="#edf4e4" stop-opacity=".05"/></linearGradient></defs><line x1="30" y1="${targetY}" x2="478" y2="${targetY}" stroke="#cbd6be" stroke-dasharray="4 5"/><text x="478" y="${targetY-9}" text-anchor="end">${money(state.goal.target)} goal</text><polygon points="30,164 ${points(state.goal.base+projected.monthlyExtra)} 470,164" fill="url(#area)"/><polyline points="${points(state.goal.base)}" stroke="#c6cbbf" stroke-width="2" stroke-dasharray="5 6" fill="none"/><polyline class="forecast-line" points="${points(state.goal.base+projected.monthlyExtra)}" stroke="#3e674c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="470" cy="${y(projected.projected)}" r="5" fill="#3e674c" stroke="#fff" stroke-width="3"/><circle cx="30" cy="${y(state.goal.saved)}" r="4" fill="#92ad7a"/><text x="30" y="184">Today</text><text x="470" y="184" text-anchor="end">In ${state.goal.months} months</text></svg>`;
}
function explanation() {
  const reductions = Object.entries(state.adjustments).filter(([,v])=>v>0);
  if (!reductions.length) return 'No spending changes. Your scheduled savings continue as they are.';
  if (state.protected.includes('Dining')) return 'Dinners stay. A little less shopping makes room for your getaway.';
  if (state.selected === 'cushion') return 'A slightly bigger adjustment adds a little breathing room.';
  return reductions.length === 1 ? `Just ${money(reductions[0][1])} less in ${reductions[0][0].toLowerCase()}. Everything else stays as it is.` : 'A little room across a few categories, with essentials protected.';
}
function adjustmentRows() {
  return Object.keys(limits).map(category => {
    const current = spending.find(c=>c.name===category), value=state.adjustments[category], locked=state.protected.includes(category);
    return `<div class="budget-row"><span class="budget-icon">${icon(current.icon)}</span><div class="budget-name"><strong>${category}</strong><span>${locked ? 'Stays just as it is' : `${money(current.total)} → ${money(current.total-value)} / month`}</span></div><span class="budget-change ${!value?'unchanged':''}">${value ? `−${money(value)}` : 'No change'}</span><button class="icon-button protect ${locked?'protected':''}" data-protect="${category}" aria-label="${locked?'Unprotect':'Protect'} ${category}" aria-pressed="${locked}">${icon(locked?'lock':'unlock')}</button></div>${state.fineTune?`<div class="slider-row"><input aria-label="${category} monthly reduction" type="range" min="0" max="${limits[category]}" step="5" value="${value}" data-slider="${category}" ${locked?'disabled':''} style="--fill:${value/limits[category]*100}%"><span>${money(value)} less</span></div>`:''}`;
  }).join('');
}
function planContent() {
  const r=result();
  return `<section class="planning-stage"><div class="section-head"><span class="section-label">01 &nbsp; CHOOSE YOUR APPROACH</span><button class="text-button undo" data-action="undo" ${state.history.length?'':'disabled'}>${icon('left')} Undo</button></div>${scenarioCards()}<div class="plan-body"><section class="plan-suggestion"><div class="suggestion-caption"><span class="assistant-symbol">${icon('spark')}</span><span>Here’s a way forward.</span></div><h2>${explanation()}</h2><div class="budget-list">${adjustmentRows()}</div><div class="budget-bottom"><span>${icon('shield')} Essentials stay protected</span><button class="text-button" data-action="fine-tune">${icon('settings')} ${state.fineTune?'Done adjusting':'Fine-tune'}</button></div><details class="reasoning"><summary>What went into this? ${icon('down')}</summary><ol><li>Compared $420 in dining with your usual $300.</li><li>Calculated a ${money(simulate(state.goal,{}).needed)} monthly gap from your goal and scheduled savings.</li><li>Respected your protected categories and capped reductions.</li></ol><button class="text-button" data-action="evidence">View the spending evidence ${icon('arrow')}</button></details></section><aside class="forecast"><span class="section-label">02 &nbsp; SEE THE DIFFERENCE</span><div class="forecast-number" aria-live="polite">${money(r.projected)}<span>projected savings</span></div><span class="forecast-status ${r.gap?'behind':''}">${icon(r.gap?'flag':'check')}${r.gap?`${money(r.gap)} left to close`:r.surplus?`${money(r.surplus)} of breathing room`:'Your goal, within reach'}</span>${forecastChart()}<div class="forecast-key"><span><i></i> With this plan</span><span><i></i> Current path</span></div><div class="contribution"><span>Your monthly savings<strong>${money(state.goal.base+r.monthlyExtra)}</strong></span><span>${money(state.goal.base)} scheduled<small>+ ${money(r.monthlyExtra)} from your adjustments</small></span></div><button class="button primary full" data-action="review">This feels right ${icon('arrow')}</button><p class="forecast-disclaimer">Nothing moves until you decide. <button data-action="calculation">View assumptions</button></p></aside></div></section>`;
}
function planner() {
  return `<button class="back-button" data-nav="overview">${icon('left')} Overview</button><div class="planner-heading">${eyebrow('MONEY MOVES')}<div><h1>A plan for your life.<br><em>Not the other way around.</em></h1><button class="goal-context" data-action="edit-goal">${icon('plane')} ${escape(state.goal.name)} <b>${money(state.goal.target)}</b> ${icon('edit')}</button></div><p>Try a direction. See what changes. Keep what matters.</p></div><div id="planning-stage">${planContent()}</div><section class="composer-card"><div class="composer-label"><span class="assistant-symbol">${icon('spark')}</span><span>Or, tell us what matters to you.</span></div><form id="request-form"><input name="request" id="request" aria-label="Change your plan" placeholder="Keep dining. Could I save $50 a month?" maxlength="200" autocomplete="off"><button type="submit" class="composer-send" aria-label="Update my plan">${icon('arrow')}</button></form><div class="composer-bottom"><span>Scenario planner · sample data</span><button data-action="about">About this demo ${icon('info')}</button></div><div id="reply" aria-live="polite">${state.note?`<p class="planner-note">${escape(state.note)}</p>`:''}</div></section>${footer()}`;
}
function updateStage(animate = true) {
  const active = document.activeElement;
  const focusKey = ['scenario', 'protect', 'action'].find(key => active?.dataset?.[key]);
  const focusValue = focusKey ? active.dataset[focusKey] : null;
  const update=()=>{
    $('#planning-stage').innerHTML=planContent();
    $('#reply').innerHTML=state.note?`<p class="planner-note">${escape(state.note)}</p>`:'';
    if (focusKey) document.querySelector(`[data-${focusKey}="${focusValue}"]`)?.focus({preventScroll:true});
  };
  if(animate) changeView(update); else update();
}
function transaction(t) {
  return `<div class="transaction"><span class="budget-icon">${icon(t.icon)}</span><span><strong>${escape(t.merchant)}</strong><small>${t.category} · Oct ${Number(t.date.slice(-2))}${t.grouped?' · Grouped purchases':''}</small></span><b>−${money(t.amount,true)}</b></div>`;
}
function activityList() {
  const rows=transactions.filter(t=>(state.category==='All'||state.category===t.category)&&t.merchant.toLowerCase().includes(state.search.toLowerCase()));
  return `<div class="activity-caption">${rows.length} entries · ${money(rows.reduce((sum,t)=>sum+t.amount,0),true)} total</div>${rows.length?rows.map(transaction).join(''):'<p class="empty-state">Nothing here yet. Try another search.</p>'}`;
}
function activity() {
  return `<div class="page-title"><div><span class="date">OCTOBER 2026</span><h1>The everyday, made clear.</h1></div></div><div class="activity-controls"><label>${icon('search')}<input id="search" type="search" aria-label="Search transactions" placeholder="Find a purchase" value="${escape(state.search)}"></label><select id="category" aria-label="Filter category">${['All',...spending.map(c=>c.name)].map(c=>`<option ${state.category===c?'selected':''}>${c}</option>`).join('')}</select></div><section class="activity-list" id="activity-list">${activityList()}</section>${footer()}`;
}
function goals() {
  return `<div class="page-title"><div><span class="date">SOMETHING TO LOOK FORWARD TO</span><h1>A little closer to <em>what’s next.</em></h1></div></div><section class="goal-detail"><div class="goal-art">${landscape()}</div><div class="goal-detail-copy">${eyebrow('YOUR GETAWAY', 'plane')}<h2>${escape(state.goal.name)}</h2><p class="goal-funding">${money(state.goal.saved)} <span>/ ${money(state.goal.target)}</span></p><div class="goal-track"><i style="width:${Math.min(100,state.goal.saved/state.goal.target*100)}%"></i></div><p>${Math.round(state.goal.saved/state.goal.target*100)}% saved · ${state.goal.months} months to go</p><div class="goal-buttons"><button class="button primary" data-action="${state.plan?'edit-plan':'begin'}">${state.plan?'Revisit my plan':'Make a plan'} ${icon('arrow')}</button><button class="button secondary" data-action="edit-goal">Edit goal</button></div>${state.plan?'<button class="text-button pause-link" data-action="pause">Pause this plan</button>':''}</div></section>${footer()}`;
}
function success() {
  const r=simulate(state.goal,state.plan?.adjustments||{});
  return `<section class="success"><div class="success-check">${icon('check')}</div>${eyebrow('PLAN SAVED')}<h1>That’s a <em>good move.</em></h1><p>A little more room for what you’re looking forward to.</p><div class="success-ticket"><div class="ticket-art">${landscape()}</div><div class="ticket-content"><span>${escape(state.goal.name)}</span><strong>${money(r.projected)}<small>projected in ${state.goal.months} months</small></strong><div><span>Extra each month</span><b>${money(r.monthlyExtra)}</b></div><div><span>Check-in preference</span><b>${state.reminders?state.day:'Off'}</b></div><p>${r.gap?`${money(r.gap)} still to go. You can adjust your plan anytime.`:'Your goal has a plan. Keep it flexible.'}</p></div></div><div class="success-buttons"><button class="button primary" data-nav="overview">Back to my overview ${icon('arrow')}</button><button class="button secondary" data-action="edit-plan">Edit plan</button><button class="icon-button" data-action="download" aria-label="Download plan">${icon('download')}</button></div><small>No money transferred. No actual reminder scheduled.</small></section>${footer()}`;
}
function modal(html, wide = false) {
  lastFocus=document.activeElement;
  $('#overlay-root').innerHTML=`<div class="overlay"><section role="dialog" aria-modal="true" aria-labelledby="modal-title" class="modal ${wide?'wide':''}"><button class="icon-button close-modal" data-action="close" aria-label="Close">${icon('close')}</button>${html}</section></div>`;
  document.body.style.overflow='hidden';
  queueMicrotask(()=>$('.close-modal')?.focus());
}
function closeModal() { $('#overlay-root').innerHTML=''; document.body.style.overflow=''; lastFocus?.focus?.(); }
function evidence() {
  modal(`${eyebrow('THE CONTEXT')}<h2 id="modal-title">A few more meals out.</h2><p>Your October dining is $120 above usual.</p><div class="comparison"><div><small>Usual</small><strong>$300</strong><i style="--width:71%"></i></div><div><small>October</small><strong>$420</strong><i style="--width:100%"></i></div></div><details class="purchase-details"><summary>See the purchases ${icon('down')}</summary>${transactions.filter(t=>t.category==='Dining').map(transaction).join('')}</details><p class="modal-note">“Usual” is rounded from your June–September average. All purchases are synthetic sample data.</p><button class="button primary full" data-action="begin">Find a way forward ${icon('arrow')}</button>`);
}
function review() {
  const r=result();
  modal(`${eyebrow('ONE LAST LOOK', 'shield')}<h2 id="modal-title">Your plan.<br><em>Your say.</em></h2><div class="review-stat"><strong>+${money(r.monthlyExtra)}</strong><span>toward your getaway each month</span></div><div class="review-changes">${Object.entries(state.adjustments).filter(([,v])=>v).map(([category,value])=>`<div><span>${category}</span><b>${money(spending.find(c=>c.name===category).total-value)} / month</b></div>`).join('')||'<p>No new spending targets.</p>'}</div><label class="check-label"><input id="reminders" type="checkbox" ${state.reminders?'checked':''}><span>A gentle weekly check-in<small>Preference only in this prototype</small></span></label><div class="reminder-day"><label for="day">My day</label><select id="day" ${state.reminders?'':'disabled'}>${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day=>`<option ${state.day===day?'selected':''}>${day}</option>`).join('')}</select></div>${r.gap?`<p class="gap-note">This plan leaves ${money(r.gap)} still to save.</p>`:''}<button class="button primary full" data-action="save">Save this plan ${icon('check')}</button><p class="modal-note">You’re saving spending targets. No transfers or bank changes.</p>`);
}
function editGoal() {
  modal(`${eyebrow('YOUR NEXT CHAPTER','plane')}<h2 id="modal-title">Make it <em>yours.</em></h2><form id="goal-form"><label class="field-label" for="name">Goal name</label><input class="field" id="name" name="name" maxlength="40" value="${escape(state.goal.name)}" required><div class="field-grid"><div><label class="field-label" for="target">Goal amount ($)</label><input class="field" id="target" name="target" type="number" min="${state.goal.saved+1}" max="100000" value="${state.goal.target}" required></div><div><label class="field-label" for="months">Months to go</label><input class="field" id="months" name="months" type="number" min="1" max="60" step="1" value="${state.goal.months}" required></div></div><p class="modal-note">${money(state.goal.saved)} saved · ${money(state.goal.base)} scheduled monthly</p><button class="button primary full" type="submit">Update goal ${icon('check')}</button></form>`);
}
function about() {
  modal(`${eyebrow('SCENARIO MODE')}<h2 id="modal-title">Explore with confidence.</h2><p>This is an interactive prototype with sample transactions. The scenario planner uses deterministic rules, not a live AI model.</p><p>Choose an approach, protect a category, or ask for a monthly savings amount. You’ll see the forecast change immediately.</p><div class="modal-callout">Plans stay in this browser. No real account, money movement, or notification service is connected.</div>`);
}
function settings() {
  modal(`${eyebrow('YOUR PREFERENCES','settings')}<h2 id="modal-title">A little more <em>your way.</em></h2><label class="check-label"><input type="checkbox" id="privacy" ${state.hiddenBalance?'checked':''}><span>Hide my account balance<small>A little privacy when you want it</small></span></label><label class="check-label"><input type="checkbox" id="settings-reminders" ${state.reminders?'checked':''}><span>Weekly check-in preference<small>Saved locally; no actual notifications</small></span></label><button class="button primary full" data-action="close">All set ${icon('check')}</button>`);
}
function requestPlan(request) {
  if(!request.trim()) return;
  if(!/(?:dining|dinners|restaurants|save|extra|smallest|protect)/i.test(request)) {
    state.note='Try “Keep dining” or “Save $50 a month”, or choose an approach above.';
    $('#reply').innerHTML=`<p class="planner-note">${state.note}</p>`;
    return;
  }
  snapshot();
  const p=suggestPlan(state.goal,state.protected,request);
  state.adjustments=validateAdjustments(p.adjustments,p.protectedCategories);
  state.protected=p.protectedCategories; state.selected='custom';
  state.note=p.explanation;
  updateStage();
  $('#request').value='';
}
function savePlan() {
  const r=result();
  state.plan={adjustments:{...state.adjustments},protected:[...state.protected],monthlyExtra:r.monthlyExtra,savedAt:new Date().toISOString()};
  persist(); navigate('success');
}
function download() {
  const r=simulate(state.goal,state.plan.adjustments);
  const text=`MONEY MOVES\n${state.goal.name}\n\nGoal: ${money(state.goal.target)}\nProjected: ${money(r.projected)} in ${state.goal.months} months\nAlready saved: ${money(state.goal.saved)}\nScheduled savings: ${money(state.goal.base)}/month\n${Object.entries(state.plan.adjustments).map(([k,v])=>`${k}: ${money(v)} less per month`).join('\n')}\n\nSample data. No money transferred. Projection assumes all reductions are saved, no withdrawals, and no interest.`;
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain'}));
  const anchor=document.createElement('a'); anchor.href=url;anchor.download='Money-Moves-My-Plan.txt';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const actions={
  home:()=>navigate('overview'), begin:()=>{selectScenario('small',false);state.history=[];navigate('planner');}, evidence, review, 'edit-goal':editGoal, close:closeModal, about, settings,
  'fine-tune':()=>{state.fineTune=!state.fineTune;updateStage();},
  undo:()=>{const previous=state.history.pop();if(previous){Object.assign(state,previous);updateStage();}},
  save:savePlan, download,
  'edit-plan':()=>{if(state.plan){state.adjustments={...state.plan.adjustments};state.protected=[...(state.plan.protected||[])];state.selected='custom';}state.note='';navigate('planner');},
  calculation:()=>{const r=result();modal(`${eyebrow('THE MATH','chart')}<h2 id="modal-title">Simple, on purpose.</h2><div class="formula">${money(state.goal.saved)} + (${money(state.goal.base)} + ${money(r.monthlyExtra)}) × ${state.goal.months}<strong>= ${money(r.projected)}</strong></div><p>Already saved + (scheduled savings + your adjustments) × months remaining.</p><p class="modal-note">Assumes you save the full spending reduction consistently. No interest, withdrawals, or automatic transfers.</p>`);},
  notifications:()=>modal(`${eyebrow('JUST WHAT MATTERS','bell')}<h2 id="modal-title">One thing worth a look.</h2><button class="notification-card" data-action="evidence">${icon('spark')}<span><strong>Dining is $120 above usual.</strong><small>Your getaway goal is still within reach.</small></span>${icon('arrow')}</button>`),
  account:()=>modal(`${eyebrow('EVERYDAY CHECKING','wallet')}<h2 id="modal-title">Your everyday, covered.</h2><div class="review-stat"><strong>${state.hiddenBalance?'••,•••.••':'$8,452.80'}</strong><span>Available balance · •• 4829</span></div><p class="modal-note">Sample account for Alex Chen. No real accounts connected.</p><button class="button primary full" data-nav="activity">View activity ${icon('arrow')}</button>`),
  pause:()=>modal(`${eyebrow('YOUR PACE','pause')}<h2 id="modal-title">Pause this plan?</h2><p>Your savings goal stays. You can start a new plan whenever you’re ready.</p><button class="button primary full" data-action="confirm-pause">Pause plan</button><button class="button secondary full" data-action="close">Keep it going</button>`),
  'confirm-pause':()=>{state.plan=null;persist();closeModal();renderMain();toast('Plan paused. Your goal is still here.');},
};
document.addEventListener('click',event=>{
  const button=event.target.closest('button,a');if(!button)return;
  if(button.dataset.nav){event.preventDefault();navigate(button.dataset.nav);return;}
  if(button.dataset.action){event.preventDefault();actions[button.dataset.action]?.();return;}
  if(button.dataset.scenario){selectScenario(button.dataset.scenario);updateStage();return;}
  if(button.dataset.protect){snapshot();const category=button.dataset.protect;state.protected=state.protected.includes(category)?state.protected.filter(c=>c!==category):[...state.protected,category];if(state.protected.includes(category))state.adjustments[category]=0;state.selected='custom';state.note='';updateStage();}
});
document.addEventListener('click',event=>{if(event.target.classList.contains('overlay'))closeModal();});
document.addEventListener('input',event=>{
  if(event.target.id==='search'){state.search=event.target.value;$('#activity-list').innerHTML=activityList();return;}
  if(event.target.dataset.slider){
    const category=event.target.dataset.slider;
    state.adjustments[category]=Number(event.target.value);state.selected='custom';
    const focused=event.target;
    // Keep the active control in place; update only dependent values while dragging.
    focused.style.setProperty('--fill',Number(focused.value)/limits[category]*100+'%');
    focused.parentElement.querySelector('span').textContent=`${money(Number(focused.value))} less`;
    const row=focused.parentElement.previousElementSibling;
    row.querySelector('.budget-change').textContent=Number(focused.value)?`−${money(Number(focused.value))}`:'No change';
    row.querySelector('.budget-name span').textContent=`${money(spending.find(c=>c.name===category).total)} → ${money(spending.find(c=>c.name===category).total-Number(focused.value))} / month`;
    $('.forecast').outerHTML=new DOMParser().parseFromString(planContent(),'text/html').querySelector('.forecast').outerHTML;
    $('.forecast-line').style.animation='none';
    document.querySelectorAll('[data-scenario]').forEach(el=>{el.classList.remove('selected');el.setAttribute('aria-pressed','false');});
    $('.plan-suggestion h2').textContent=explanation();
  }
});
document.addEventListener('pointerdown',event=>{if(event.target.dataset.slider)snapshot();});
document.addEventListener('keydown',event=>{
  if(event.target.dataset.slider&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))snapshot();
  if(event.key==='Escape')closeModal();
  if(event.key==='Tab'&&$('.modal')){const fields=[...$('.modal').querySelectorAll('button,input,select,a')].filter(el=>!el.disabled);const first=fields[0],last=fields.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
});
document.addEventListener('change',event=>{
  if(event.target.id==='category'){state.category=event.target.value;$('#activity-list').innerHTML=activityList();}
  if(event.target.id==='reminders'){state.reminders=event.target.checked;$('#day').disabled=!state.reminders;}
  if(event.target.id==='day')state.day=event.target.value;
  if(event.target.id==='privacy'){state.hiddenBalance=event.target.checked;persist();renderMain();}
  if(event.target.id==='settings-reminders'){state.reminders=event.target.checked;persist();}
  if(event.target.dataset.slider){$('.undo').disabled=false;}
});
document.addEventListener('submit',event=>{
  if(event.target.id==='request-form'){event.preventDefault();requestPlan(new FormData(event.target).get('request'));}
  if(event.target.id==='goal-form'){event.preventDefault();const form=new FormData(event.target);state.goal={...state.goal,name:String(form.get('name')).trim()||INITIAL_GOAL.name,target:Number(form.get('target')),months:Number(form.get('months'))};if(state.page==='planner')selectScenario('small',false);persist();closeModal();renderMain(true);toast('Your goal is updated.');}
});
shell();
