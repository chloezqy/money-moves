import { INITIAL_GOAL, spending, transactions, monthlyDining, money, limits } from './data.js';
import { simulate, suggestPlan, validateAdjustments } from './plan-engine.js';
import { icon } from './icons.js';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const read = () => { try { return JSON.parse(localStorage.getItem('money-moves-v1') || '{}'); } catch { return {}; } };
const saved = read();
const state = {
  page: ['insight','planner','activity','goals'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview', goal: { ...INITIAL_GOAL, ...saved.goal }, plan: saved.plan || null,
  adjustments: { Dining: 60, Shopping: 0, Subscriptions: 0 }, protected: [],
  selected: 'small', history: [], note: '', search: '', category: 'All',
  reminders: saved.reminders ?? true, day: saved.day || 'Monday', hiddenBalance: saved.hiddenBalance || false,
};
let lastFocus, toastTimer;
const isFlow = () => ['insight', 'planner', 'success'].includes(state.page);
const result = () => simulate(state.goal, state.adjustments);
const agentMark = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 13.5V18M10 8.5V18M15 4v14M20 9v9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;

function persist() {
  try { const { goal, plan, reminders, day, hiddenBalance } = state; localStorage.setItem('money-moves-v1', JSON.stringify({ goal, plan, reminders, day, hiddenBalance })); }
  catch { toast('This browser couldn’t save your changes.'); }
}
function toast(message) {
  $('#toast').textContent=message; $('#toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);
}
function snapshot() {
  state.history.push({ adjustments:{...state.adjustments}, protected:[...state.protected], selected:state.selected, note:state.note });
  if(state.history.length>20)state.history.shift();
}
function transition(update) {
  if(document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches)document.startViewTransition(update);
  else update();
}
function navigate(page) { closeSheet();state.page=page;transition(render);window.scrollTo({top:0,behavior:'instant'}); }
function render() {
  history.replaceState(null,'',location.pathname + location.search + (state.page==='overview'?'':`#${state.page}`));
  const flow=isFlow();
  $('#app').innerHTML=`<div class="app-shell ${flow?'flow':''}">${flow?flowHeader():bankHeader()}<main id="main" class="${state.page}">${pageContent()}</main>${flow?'':bottomNavigation()}</div>`;
  document.title=`${state.page==='planner'?'Your next move':state.page==='insight'?'Your dining insight':'ABC Bank'} · Money Moves`;
}
function bankHeader() {
  return `<header class="bank-header"><a href="#" class="brand" data-action="home"><span class="bank-mark"><i></i><i></i><i></i></span>ABC Bank</a><div><button class="icon-button" data-action="notifications" aria-label="Notifications">${icon('bell')}<span class="notification-dot"></span></button><button class="avatar" data-action="account" aria-label="Alex’s account">AC</button></div></header>`;
}
function flowHeader() {
  return `<header class="flow-header"><button class="icon-button" data-action="${state.page==='planner'?'back-insight':'home'}" aria-label="Go back">${icon('left')}</button><span>${state.page==='success'?'Your plan':state.page==='insight'?'Spending insight':'Your next move'}</span><button class="icon-button" data-action="about" aria-label="About Money Moves">${icon('info')}</button></header>`;
}
function bottomNavigation() {
  return `<nav class="bottom-nav" aria-label="Main navigation">${[['overview','home','Home'],['activity','chart','Activity'],['goals','flag','Goals'],['settings','settings','Settings']].map(([page,glyph,label])=>`<button ${page==='settings'?'data-action="settings"':`data-nav="${page}"`} class="${state.page===page?'active':''}" ${state.page===page?'aria-current="page"':''}>${icon(glyph)}<span>${label}</span></button>`).join('')}</nav>`;
}
function pageContent() {
  if(state.page==='insight')return insight();
  if(state.page==='planner')return planner();
  if(state.page==='success')return success();
  if(state.page==='activity')return activity();
  if(state.page==='goals')return goals();
  return overview();
}
function button(label, action, glyph='arrow', type='primary') {
  return `<button class="button ${type}" data-action="${action}">${label}${glyph?icon(glyph):''}</button>`;
}
function agentLabel(label='Money Moves') { return `<span class="agent-label"><span class="agent-mark">${agentMark}</span>${label}</span>`; }
function dock(label,action,sub='You’re in control. No money is moved.') {
  return `<div class="flow-dock">${button(label,action)}<p>${sub}</p></div>`;
}
function overview() {
  const baseline=simulate(state.goal,{});
  return `<section class="balance-section"><div class="greeting">Good morning, Alex</div><div class="balance-caption">Available balance <button class="inline-icon" data-action="privacy" aria-label="${state.hiddenBalance?'Show':'Hide'} balance">${icon('eye')}</button></div><h1 class="balance">${state.hiddenBalance?'••,•••.••':'$8,452<span>.80</span>'}</h1><button class="account-caption" data-action="account">Everyday checking <span>•• 4829</span>${icon('chevron')}</button></section>
    <section class="home-insight">${agentLabel()}<span class="insight-fresh">New insight</span><h2>Dining’s up.<br>Your getaway can<br>stay on track.</h2><p>A small change could keep you on track.</p><div class="insight-comparison"><div><span>This month</span><strong>$420</strong></div><div class="comparison-spark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><span class="change-badge">+$120</span></div>${button('See my next move','insight')}</section>
    <section class="home-goal"><div class="section-title"><h2>Your goal</h2><button class="text-button" data-nav="goals">View goal ${icon('chevron')}</button></div><button class="goal-row" data-nav="goals"><span class="goal-glyph">${icon('plane')}</span><span><strong>${esc(state.goal.name)}</strong><small>${state.goal.months} months to go</small></span><span class="goal-value">${money(state.goal.saved)}<small>of ${money(state.goal.target)}</small></span></button><div class="progress-track" role="progressbar" aria-label="Goal savings" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(state.goal.saved/state.goal.target*100)}"><i style="width:${Math.min(100,state.goal.saved/state.goal.target*100)}%"></i></div><div class="goal-foot"><span>${Math.round(state.goal.saved/state.goal.target*100)}% saved</span><span>${state.plan?'Plan saved':`${money(baseline.needed)} / mo to close the gap`}</span></div></section>
    <section class="home-activity"><div class="section-title"><h2>Recent activity</h2><button class="text-button" data-nav="activity">See all ${icon('chevron')}</button></div>${transactions.slice(0,2).map(transaction).join('')}</section><p class="sample-note">Sample account · Interactive prototype</p>`;
}
function insight() {
  const baseline=simulate(state.goal,{});
  return `<div class="flow-intro">${agentLabel('Money Moves · Insight')}<h1>A closer look<br>at your dining.</h1><p>A few more meals out this month.</p></div><section class="dining-figure"><div><span>October spending</span><strong>$420</strong></div><span class="delta">↑ $120 <small>vs. usual</small></span></section><section class="dining-chart" aria-label="Dining spending June through October"><div class="usual-line"><span>Usual $300</span></div>${monthlyDining.map((m,i)=>`<div class="chart-column"><span class="bar-value">${i===4?'$420':''}</span><i style="height:${m.value/450*113}px" class="${i===4?'current':''}"></i><span>${m.month}</span></div>`).join('')}</section><button class="evidence-button" data-action="evidence">See the purchases ${icon('chevron')}</button><section class="goal-impact"><span class="goal-glyph">${icon('plane')}</span><div><h2>Your goal is still within reach.</h2><p>${baseline.gap?`${money(baseline.needed)} more a month could close your ${money(baseline.gap)} savings gap.`:'Your current savings already cover your goal.'}</p></div></section><div class="insight-context"><h2>What changed?</h2><div class="spending-breakdown">${[['Restaurants',230],['Cafés',90],['Delivery',70],['Other',30]].map(([label,value])=>`<span>${label}<b>${money(value)}</b></span>`).join('')}</div></div>${dock('Find a way forward','begin')}`;
}
function chooseScenario(choice,record=true) {
  if(record)snapshot();
  const needed=simulate(state.goal,{}).needed;
  const request=choice==='dinners'?'Keep my Friday dinners':choice==='cushion'?`Save $${needed+30} extra`:choice==='lighter'?'Save $30 extra':'Find the smallest change';
  const plan=suggestPlan(state.goal,[],request);
  state.adjustments=plan.adjustments;state.protected=plan.protectedCategories;state.selected=choice;state.note='';
}
function shortExplanation() {
  if(result().monthlyExtra===0)return 'Your spending stays as it is. You can adjust this anytime.';
  if(state.protected.includes('Dining')){
    const categories=Object.entries(state.adjustments).filter(([,value])=>value>0).map(([category])=>category.toLowerCase()).join(' and ');
    return `Keep the dinners. Make a little room in ${categories} instead.`;
  }
  if(state.selected==='cushion')return 'A slightly bigger move gives your goal a little breathing room.';
  return 'One small adjustment, with your everyday essentials protected.';
}
function planChanges(editable=false) {
  const active=Object.entries(state.adjustments).filter(([,value])=>value>0);
  if(!active.length)return '<div class="unchanged-plan">No new spending targets.</div>';
  return active.map(([category,value])=>{
    const c=spending.find(c=>c.name===category);
    return `<div class="plan-change"><span class="merchant-icon">${icon(c.icon)}</span><div><strong>${category}</strong><small>${money(c.total)} → <b>${money(c.total-value)}</b> / month</small></div><span class="reduction">−${money(value)}${editable?'<small>per month</small>':''}</span></div>`;
  }).join('');
}
function forecastChart() {
  const r=result();
  const top=Math.max(state.goal.target*1.13,r.projected*1.08,state.goal.saved*1.1);
  const y=value=>128-value/top*100;
  const points=monthly=>Array.from({length:state.goal.months+1},(_,i)=>`${10+i/state.goal.months*314},${y(state.goal.saved+monthly*i)}`).join(' ');
  return `<svg viewBox="0 0 344 153" role="img" aria-label="${money(r.projected)} projected savings, versus ${money(simulate(state.goal,{}).projected)} without adjustments"><defs><linearGradient id="forecast-fill" x2="0" y2="1"><stop stop-color="#dce5ff"/><stop offset="1" stop-color="#f5f7ff" stop-opacity="0"/></linearGradient></defs><line x1="10" y1="${y(state.goal.target)}" x2="324" y2="${y(state.goal.target)}" stroke="#ced5e5" stroke-dasharray="3 4"/><text x="324" y="${y(state.goal.target)-8}" text-anchor="end">${money(state.goal.target)} goal</text><polygon points="10,130 ${points(state.goal.base+r.monthlyExtra)} 324,130" fill="url(#forecast-fill)"/><polyline points="${points(state.goal.base)}" fill="none" stroke="#bcc4d4" stroke-width="2" stroke-dasharray="4 5"/><polyline class="forecast-line" points="${points(state.goal.base+r.monthlyExtra)}" fill="none" stroke="#425fe1" stroke-width="2.5" stroke-linecap="round"/><circle cx="324" cy="${y(r.projected)}" r="4" fill="#425fe1" stroke="#fff" stroke-width="2"/><text x="10" y="151">Today</text><text x="324" y="151" text-anchor="end">In ${state.goal.months} months</text></svg>`;
}
function planBody() {
  const r=result();
  return `<section class="agent-recommendation">${agentLabel()}<h1>Save <span>${money(r.monthlyExtra)} more</span><br>each month.</h1><p>${shortExplanation()}</p></section><div class="plan-options" role="group" aria-label="Try another approach"><button data-scenario="small" class="${state.selected==='small'?'selected':''}" aria-pressed="${state.selected==='small'}">${icon('flag')} Suggested</button><button data-scenario="dinners" class="${state.selected==='dinners'?'selected':''}" aria-pressed="${state.selected==='dinners'}">${icon('utensils')} Keep dining</button><button data-action="options" aria-label="More ways to adjust this plan">${icon('settings')}</button></div><section class="change-section"><div class="section-title"><h2>${Object.values(state.adjustments).filter(Boolean).length>1?'Your monthly moves':'Your small move'}</h2><button class="text-button" data-action="adjust">Edit</button></div>${planChanges(true)}<div class="protected-note">${icon('shield')} ${state.protected.includes('Dining')?'Dining, groceries & essentials protected':'Groceries & essentials protected'}</div></section><section class="forecast-section"><div class="forecast-heading"><div><span>You could reach</span><strong>${money(r.projected)}</strong></div><span class="forecast-status ${r.gap?'gap':''}">${icon(r.gap?'flag':'check')}${r.gap?`${money(r.gap)} short`:'On track'}</span></div>${forecastChart()}<div class="forecast-key"><span><i></i>With your plan</span><span><i></i>Current path</span></div><button class="calculation-link" data-action="calculation">How we worked this out ${icon('info')}</button></section><div class="planner-tools"><button data-action="ask">${icon('chat')}<span>What would make this work for you?</span>${icon('chevron')}</button><button class="undo" data-action="undo" ${state.history.length?'':'disabled'}>${icon('left')} Undo</button></div>${state.note?`<p class="planner-note" role="status">${esc(state.note)}</p>`:''}`;
}
function planner() {return `<div class="flow-progress"><span>Your plan</span><span>1 of 2</span></div><div id="plan-body">${planBody()}</div>${dock('Review my plan','review','A projection, not a guarantee. You decide what happens.')}`;}
function updatePlan() {
  const current=document.activeElement;
  const data=current?.dataset?.scenario;
  transition(()=>{
    $('#plan-body').innerHTML=planBody();
    if(data)document.querySelector(`[data-scenario="${data}"]`)?.focus({preventScroll:true});
  });
}
function transaction(t) {
  return `<div class="transaction"><span class="merchant-icon">${icon(t.icon)}</span><div><strong>${esc(t.merchant)}</strong><small>${t.category} · Oct ${Number(t.date.slice(-2))}${t.grouped?' · Grouped':''}</small></div><b>−${money(t.amount,true)}</b></div>`;
}
function activityResults() {
  const rows=transactions.filter(t=>(state.category==='All'||t.category===state.category)&&t.merchant.toLowerCase().includes(state.search.toLowerCase()));
  return `<div class="activity-caption">October 2026 · ${money(rows.reduce((sum,t)=>sum+t.amount,0),true)} spent</div>${rows.length?rows.map(transaction).join(''):'<p class="empty-state">No purchases found.</p>'}`;
}
function activity() {
  return `<div class="page-heading"><h1>Activity</h1><p>The everyday, made clear.</p></div><label class="search-field">${icon('search')}<input id="search" type="search" placeholder="Find a purchase" aria-label="Search transactions" value="${esc(state.search)}"></label><select class="category-select" id="category" aria-label="Filter category">${['All',...spending.map(c=>c.name)].map(c=>`<option ${state.category===c?'selected':''}>${c}</option>`).join('')}</select><section id="activity-results">${activityResults()}</section>`;
}
function goals() {
  const g=state.goal;
  return `<div class="page-heading"><h1>Your goals</h1><p>Make room for what matters.</p></div><section class="goal-detail"><span class="large-goal-glyph">${icon('plane')}</span><h2>${esc(g.name)}</h2><p>${g.months} months to go</p><div class="goal-funded">${money(g.saved)}<span>of ${money(g.target)}</span></div><div class="progress-track"><i style="width:${Math.min(100,g.saved/g.target*100)}%"></i></div><div class="goal-foot"><span>${Math.round(g.saved/g.target*100)}% saved</span><button class="text-button" data-action="edit-goal">Edit goal</button></div></section><section class="goal-plan"><div class="section-title"><h2>${state.plan?'Your active plan':'Your next move'}</h2>${state.plan?'<span class="saved-badge">Saved</span>':''}</div><p>${state.plan?`${money(state.plan.monthlyExtra)} extra for your goal each month.`:'A small adjustment could keep you on track.'}</p>${button(state.plan?'View my plan':'Make a plan',state.plan?'edit-plan':'begin')}${state.plan?'<button class="pause-button" data-action="pause">Pause plan</button>':''}</section>`;
}
function success() {
  const r=simulate(state.goal,state.plan?.adjustments||{});
  return `<section class="success-content"><div class="success-symbol">${icon('check')}</div><span class="overline">PLAN SAVED</span><h1>A good move,<br>Alex.</h1><p>Your getaway has a plan.<br>And you can change it anytime.</p><div class="saved-plan-summary"><span class="goal-glyph">${icon('plane')}</span><div><strong>${esc(state.goal.name)}</strong><small>${money(r.projected)} projected in ${state.goal.months} months</small></div></div><div class="saved-plan-lines"><div><span>Extra each month</span><b>${money(r.monthlyExtra)}</b></div><div><span>Weekly check-in</span><b>${state.reminders?state.day:'Off'}</b></div></div>${r.gap?`<p class="gap-note">${money(r.gap)} still to save. Revisit your plan anytime.</p>`:''}<div class="success-info">${icon('shield')}<span>No money has moved.<br>These are targets for you to track.</span></div><button class="text-button" data-action="edit-plan">Make a change ${icon('arrow')}</button></section>${dock('Back to home','home','Check-in preferences are saved. No real reminder is scheduled.')}`;
}
function sheet(html,options={}) {
  lastFocus=document.activeElement;
  $('#overlay-root').innerHTML=`<div class="overlay"><section class="sheet ${options.large?'large':''}" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><button class="icon-button close-sheet" data-action="close" aria-label="Close">${icon('close')}</button>${html}</section></div>`;
  document.body.style.overflow='hidden';queueMicrotask(()=>$('.close-sheet')?.focus());
}
function closeSheet(){
  if(!$('.overlay'))return;
  if($('#adjust-total') && state.page==='planner' && $('#plan-body'))$('#plan-body').innerHTML=planBody();
  $('#overlay-root').innerHTML='';document.body.style.overflow='';
  if(lastFocus?.isConnected)lastFocus.focus();
  else if(state.page==='planner')document.querySelector('[data-action="adjust"]')?.focus({preventScroll:true});
}
function evidence(){sheet(`<span class="overline">OCTOBER DINING</span><h2 id="sheet-title">Behind the $420.</h2><p>Sample purchases behind this insight.</p><div class="evidence-transactions">${transactions.filter(t=>t.category==='Dining').map(transaction).join('')}</div><p class="sheet-note">Grouped rows include the remaining purchases. Your usual $300 is rounded from the June–September average.</p>`,{large:true});}
function options(){sheet(`<span class="overline">MAKE IT WORK FOR YOU</span><h2 id="sheet-title">There’s more than one way.</h2><div class="option-list">${[
  ['small','flag','The smallest change','Just enough to close the gap.'],
  ['dinners','utensils','Keep dining unchanged','Find room somewhere else.'],
  ['cushion','sun','Add a little breathing room','Save an extra $30 beyond the gap.'],
  ['lighter','wallet','Start with $30 a month','Take a smaller first step.'],
].map(([value,glyph,title,sub])=>`<button data-sheet-scenario="${value}"><span class="option-icon">${icon(glyph)}</span><span><strong>${title}</strong><small>${sub}</small></span>${icon('chevron')}</button>`).join('')}</div><button class="text-button" data-action="adjust">Set my own amounts ${icon('arrow')}</button>`);}
function adjust(){sheet(`<span class="overline">YOUR MONTHLY TARGETS</span><h2 id="sheet-title">A little more your way.</h2><p>Adjust an amount. Protect what matters.</p><div class="adjustments">${Object.keys(limits).map(category=>{
  const c=spending.find(c=>c.name===category),value=state.adjustments[category],locked=state.protected.includes(category);
  return `<div class="adjustment"><div class="adjustment-title"><span>${category}<small>Currently ${money(c.total)} / month</small></span><button class="protect-button ${locked?'locked':''}" data-protect="${category}" aria-pressed="${locked}" aria-label="${locked?'Unprotect':'Protect'} ${category}">${icon(locked?'lock':'unlock')} ${locked?'Protected':'Protect'}</button></div><div class="adjustment-value"><strong data-amount="${category}">${money(value)}</strong><span>less / month</span></div><input type="range" min="0" max="${limits[category]}" step="5" value="${value}" data-slider="${category}" aria-label="${category} monthly reduction" aria-valuetext="${money(value)} less per month" ${locked?'disabled':''} style="--fill:${value/limits[category]*100}%"></div>`;
}).join('')}</div><div class="adjust-total"><span>Projected savings</span><strong id="adjust-total">${money(result().projected)}</strong></div>${button('Done','finish-adjust','check')}`,{large:true});}
function ask(){sheet(`<span class="overline">YOUR PRIORITIES</span><h2 id="sheet-title">What would make this work?</h2><p>Tell Money Moves what you want to keep.</p><form id="request-form"><label class="request-field"><textarea name="request" id="request" placeholder="Keep dining. Could I save $50 a month?" aria-label="Your planning preference" maxlength="200" required></textarea></label><div class="prompt-examples"><button type="button" data-example="Keep my Friday dinners">Keep my dinners</button><button type="button" data-example="Save $30 a month">Start with $30</button></div><button class="button primary" type="submit">Update my plan ${icon('arrow')}</button></form><p class="sheet-note">Demo scenario planner. Understands dining preferences and monthly savings amounts; no live AI model.</p>`);}
function review(){const r=result();sheet(`<span class="overline">2 OF 2 · REVIEW</span><h2 id="sheet-title">Your next move.<br>Your final say.</h2><div class="review-amount">+${money(r.monthlyExtra)}<span>toward your goal each month</span></div><div class="review-changes">${planChanges()}</div><label class="reminder-toggle"><span><strong>A gentle weekly check-in</strong><small>Preference only in this demo</small></span><input id="reminders" type="checkbox" role="switch" ${state.reminders?'checked':''}></label><div class="reminder-day"><label for="day">Check-in day</label><select id="day" ${state.reminders?'':'disabled'}>${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d=>`<option ${state.day===d?'selected':''}>${d}</option>`).join('')}</select></div>${r.gap?`<p class="gap-note">This plan leaves ${money(r.gap)} still to save.</p>`:''}${button('Save my plan','save','check')}<p class="sheet-note centered">No transfers. No account changes.<br>You’re saving spending targets.</p>`);}
function editGoal(){sheet(`<span class="overline">YOUR NEXT CHAPTER</span><h2 id="sheet-title">Make it yours.</h2><form id="goal-form"><label class="field-label" for="name">Goal name</label><input class="field" id="name" name="name" value="${esc(state.goal.name)}" maxlength="40" required><div class="field-grid"><div><label class="field-label" for="target">Amount ($)</label><input class="field" id="target" name="target" type="number" min="${state.goal.saved+1}" max="100000" value="${state.goal.target}" required></div><div><label class="field-label" for="months">Months to go</label><input class="field" id="months" name="months" type="number" min="1" max="60" step="1" value="${state.goal.months}" required></div></div><p class="sheet-note">${money(state.goal.saved)} saved · ${money(state.goal.base)} scheduled each month.</p><button class="button primary" type="submit">Update goal ${icon('check')}</button></form>`);}
function settings(){sheet(`<span class="overline">PREFERENCES</span><h2 id="sheet-title">Bank on your terms.</h2><label class="reminder-toggle"><span><strong>Hide my balance</strong><small>A little privacy when you need it</small></span><input type="checkbox" role="switch" id="privacy" ${state.hiddenBalance?'checked':''}></label><label class="reminder-toggle"><span><strong>Weekly check-ins</strong><small>Saved preference; no real notifications</small></span><input type="checkbox" role="switch" id="settings-reminders" ${state.reminders?'checked':''}></label>${button('All set','close','check')}<button class="text-button about-link" data-action="about">About this prototype ${icon('info')}</button>`);}
function requestPlan(request){
  if(!request.trim())return;
  if(!/(?:dining|dinners|restaurants|save|extra|smallest|protect)/i.test(request)){toast('Try “Keep dining” or “Save $50 a month”.');return;}
  snapshot();const p=suggestPlan(state.goal,state.protected,request);
  state.adjustments=validateAdjustments(p.adjustments,p.protectedCategories);state.protected=p.protectedCategories;state.selected='custom';
  state.note=result().gap?`${money(result().gap)} still to save. Try a longer timeline or another adjustment.`:'';
  closeSheet();updatePlan();
}
function savePlan(){state.plan={adjustments:{...validateAdjustments(state.adjustments,state.protected)},protected:[...state.protected],monthlyExtra:result().monthlyExtra,savedAt:new Date().toISOString()};persist();navigate('success');}
const actions={
  home:()=>navigate('overview'),insight:()=>navigate('insight'),'back-insight':()=>navigate('insight'),
  begin:()=>{chooseScenario('small',false);state.history=[];navigate('planner');},
  evidence,options,adjust,ask,review,'edit-goal':editGoal,settings,save:savePlan,close:closeSheet,
  'finish-adjust':()=>{closeSheet();updatePlan();},
  undo:()=>{const previous=state.history.pop();if(previous){Object.assign(state,previous);updatePlan();}},
  privacy:()=>{state.hiddenBalance=!state.hiddenBalance;persist();render();},
  'edit-plan':()=>{if(state.plan){state.adjustments={...state.plan.adjustments};state.protected=[...(state.plan.protected||[])];state.selected='custom';}state.note='';navigate('planner');},
  about:()=>sheet(`<span class="overline">SCENARIO MODE</span><h2 id="sheet-title">A smarter way to explore.</h2><p>This prototype uses sample transactions and deterministic planning rules. It is not connected to a live AI model or bank account.</p><p>Try a suggestion, protect dining, or ask for a monthly savings amount. Calculations use your goal and scheduled savings.</p><p class="sheet-note">Plans stay in this browser. No real money moves and no notifications are scheduled.</p>`),
  calculation:()=>{const r=result();sheet(`<span class="overline">BEHIND THE FORECAST</span><h2 id="sheet-title">The math stays simple.</h2><div class="math-lines"><div><span>Already saved</span><b>${money(state.goal.saved)}</b></div><div><span>Scheduled savings</span><b>${money(state.goal.base)} / month</b></div><div><span>Your adjustments</span><b>+${money(r.monthlyExtra)} / month</b></div><div><span>Months to go</span><b>${state.goal.months}</b></div><div class="math-total"><span>Projected</span><b>${money(r.projected)}</b></div></div><p class="sheet-note">${money(state.goal.saved)} + (${money(state.goal.base)} + ${money(r.monthlyExtra)}) × ${state.goal.months}. Assumes you save all reductions consistently, with no interest or withdrawals.</p>`);},
  account:()=>sheet(`<span class="overline">EVERYDAY CHECKING · •• 4829</span><h2 id="sheet-title">${state.hiddenBalance?'••,•••.••':'$8,452.80'}</h2><p>Available balance · Alex Chen</p><p class="sheet-note">Sample account. No real bank account connected.</p><button class="button primary" data-nav="activity">View activity ${icon('arrow')}</button>`),
  notifications:()=>sheet(`<span class="overline">NOTIFICATIONS</span><h2 id="sheet-title">One thing worth a look.</h2><button class="notification" data-action="insight">${agentLabel()}<strong>Dining is $120 above usual.</strong><span>See what that means for your getaway. ${icon('arrow')}</span></button>`),
  pause:()=>sheet(`<span class="overline">YOUR PACE</span><h2 id="sheet-title">Pause this plan?</h2><p>Your goal stays here. Start again whenever you’re ready.</p>${button('Pause plan','confirm-pause','pause')}${button('Keep my plan','close','','secondary')}`),
  'confirm-pause':()=>{state.plan=null;persist();closeSheet();render();toast('Plan paused. Your goal is still here.');},
};
document.addEventListener('click',event=>{
  const el=event.target.closest('button,a');if(!el){if(event.target.classList.contains('overlay'))closeSheet();return;}
  if(el.dataset.nav){event.preventDefault();navigate(el.dataset.nav);return;}
  if(el.dataset.action){event.preventDefault();actions[el.dataset.action]?.();return;}
  if(el.dataset.scenario){chooseScenario(el.dataset.scenario);updatePlan();return;}
  if(el.dataset.sheetScenario){chooseScenario(el.dataset.sheetScenario);closeSheet();updatePlan();return;}
  if(el.dataset.example){$('#request').value=el.dataset.example;$('#request').focus();return;}
  if(el.dataset.protect){snapshot();const c=el.dataset.protect;state.protected=state.protected.includes(c)?state.protected.filter(x=>x!==c):[...state.protected,c];if(state.protected.includes(c))state.adjustments[c]=0;state.selected='custom';adjust();}
});
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.id==='search'){state.search=el.value;$('#activity-results').innerHTML=activityResults();}
  if(el.dataset.slider){const c=el.dataset.slider;state.adjustments[c]=Number(el.value);state.selected='custom';el.style.setProperty('--fill',Number(el.value)/limits[c]*100+'%');el.setAttribute('aria-valuetext',`${money(Number(el.value))} less per month`);$(`[data-amount="${c}"]`).textContent=money(Number(el.value));$('#adjust-total').textContent=money(result().projected);}
});
document.addEventListener('pointerdown',event=>{if(event.target.dataset.slider)snapshot();});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.id==='category'){state.category=el.value;$('#activity-results').innerHTML=activityResults();}
  if(el.id==='reminders'){state.reminders=el.checked;$('#day').disabled=!state.reminders;}
  if(el.id==='day')state.day=el.value;
  if(el.id==='privacy'){state.hiddenBalance=el.checked;persist();render();}
  if(el.id==='settings-reminders'){state.reminders=el.checked;persist();}
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')closeSheet();
  if(event.target.dataset.slider&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))snapshot();
  if(event.key==='Tab'&&$('.sheet')){
    const fields=[...$('.sheet').querySelectorAll('button,input,select,textarea,a')].filter(el=>!el.disabled);
    const first=fields[0],last=fields.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
document.addEventListener('submit',event=>{
  if(event.target.id==='request-form'){event.preventDefault();requestPlan(String(new FormData(event.target).get('request')));}
  if(event.target.id==='goal-form'){
    event.preventDefault();const form=new FormData(event.target);
    state.goal={...state.goal,name:String(form.get('name')).trim()||INITIAL_GOAL.name,target:Number(form.get('target')),months:Number(form.get('months'))};
    if(state.page==='planner')chooseScenario('small',false);persist();closeSheet();render();toast('Goal updated.');
  }
});
render();
