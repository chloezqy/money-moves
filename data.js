export const INITIAL_GOAL = { name: 'A little escape', target: 1000, saved: 400, months: 4, base: 90 };
export const spending = [
 { name:'Dining', total:420, usual:300, color:'#285e4d', icon:'utensils' },
 { name:'Shopping', total:280, usual:260, color:'#98ad8b', icon:'bag' },
 { name:'Groceries', total:360, usual:350, color:'#d2b486', icon:'basket' },
 { name:'Transport', total:140, usual:150, color:'#b0bcb8', icon:'train' },
 { name:'Subscriptions', total:80, usual:80, color:'#d9ddd6', icon:'repeat' },
];
export const transactions = [
 { id:'tx01',merchant:'Sweetgreen',category:'Dining',sub:'Restaurants',date:'2026-10-22',amount:18.50,icon:'utensils' },
 { id:'tx02',merchant:'Whole Foods Market',category:'Groceries',date:'2026-10-21',amount:64.20,icon:'basket' },
 { id:'tx03',merchant:'Blue Bottle Coffee',category:'Dining',sub:'Cafés',date:'2026-10-21',amount:6.75,icon:'cup' },
 { id:'tx04',merchant:'DoorDash',category:'Dining',sub:'Delivery',date:'2026-10-20',amount:32.40,icon:'delivery' },
 { id:'tx05',merchant:'Uniqlo',category:'Shopping',date:'2026-10-20',amount:59.90,icon:'bag' },
 { id:'tx06',merchant:'Spotify Premium',category:'Subscriptions',date:'2026-10-19',amount:11.99,icon:'music' },
 { id:'tx07',merchant:'Noodlehead',category:'Dining',sub:'Restaurants',date:'2026-10-18',amount:26.50,icon:'utensils' },
 { id:'tx08',merchant:'Pittsburgh Regional Transit',category:'Transport',date:'2026-10-18',amount:5.50,icon:'train' },
 { id:'tx09',merchant:'Tako',category:'Dining',sub:'Restaurants',date:'2026-10-17',amount:48.00,icon:'utensils' },
 { id:'tx10',merchant:'Target',category:'Shopping',date:'2026-10-16',amount:42.30,icon:'bag' },
 { id:'tx11',merchant:'Trader Joe’s',category:'Groceries',date:'2026-10-15',amount:56.80,icon:'basket' },
 { id:'tx12',merchant:'La Prima Espresso',category:'Dining',sub:'Cafés',date:'2026-10-14',amount:12.75,icon:'cup' },
 { id:'tx13',merchant:'Other restaurant purchases',category:'Dining',sub:'Restaurants',date:'2026-10-13',amount:137.00,icon:'utensils',grouped:true },
 { id:'tx14',merchant:'Other café purchases',category:'Dining',sub:'Cafés',date:'2026-10-12',amount:70.50,icon:'cup',grouped:true },
 { id:'tx15',merchant:'Other delivery purchases',category:'Dining',sub:'Delivery',date:'2026-10-11',amount:37.60,icon:'delivery',grouped:true },
 { id:'tx16',merchant:'Other dining purchases',category:'Dining',sub:'Other',date:'2026-10-10',amount:30.00,icon:'utensils',grouped:true },
 { id:'tx17',merchant:'Other grocery purchases',category:'Groceries',date:'2026-10-09',amount:239.00,icon:'basket',grouped:true },
 { id:'tx18',merchant:'Other shopping purchases',category:'Shopping',date:'2026-10-08',amount:177.80,icon:'bag',grouped:true },
 { id:'tx19',merchant:'Other transport purchases',category:'Transport',date:'2026-10-07',amount:134.50,icon:'train',grouped:true },
 { id:'tx20',merchant:'Other subscriptions',category:'Subscriptions',date:'2026-10-06',amount:68.01,icon:'repeat',grouped:true },
];
export const monthlyDining = [{month:'Jun',value:285},{month:'Jul',value:305},{month:'Aug',value:310},{month:'Sep',value:300},{month:'Oct',value:420}];
export const limits = {Dining:120,Shopping:80,Subscriptions:30};
export const money = (n, cents=false) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:cents?2:0,minimumFractionDigits:cents?2:0}).format(n);
export const totalSpend = spending.reduce((n,c)=>n+c.total,0);
