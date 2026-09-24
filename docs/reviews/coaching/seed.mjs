// Synthetic screenshot fixtures only. Never points at production or calls a model.
const base = 'http://127.0.0.1:4317';
async function call(path, body, method = 'POST') {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local-e2e-token' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}
const kind = process.argv[2] || 'proposal';
const ago = minutes => new Date(Date.now() - minutes * 60000).toISOString();
const msg = (id, planId, content, extra = {}) => ({ id, chatId: 'coach-main', role: 'COACH', status: 'SENT', planId, content, createdAt: ago(5), ...extra });
const goal = 'Run my first half marathon under 2 hours';
let messages;
let monitoring = { setupPlanIds: [], pausedPlanIds: [], requests: [] };
if (kind === 'preparing') {
  messages = [];
  monitoring.setupPlanIds = ['fitness'];
} else if (kind === 'baseline') {
  messages = [msg('baseline-question', 'fitness', 'Before I suggest your first week, how far can you comfortably run now? A recent run or a rough estimate is enough. That will help me choose a starting point.', { requiresReply: true })];
} else if (kind === 'weekly') {
  messages = [msg('weekly-review', null, 'You logged all three runs and two meditation sessions this week. Keep meditation at three times a week.\n\nBefore changing the running schedule, how did Sunday’s run feel?', { planIds: ['fitness', 'scheduled'], requiresReply: true })];
} else if (kind === 'silence' || kind === 'paused') {
  messages = [msg('meditation-question', 'scheduled', 'There are no meditation sessions logged this week. Did you practise without logging, or has it been hard to get started?\n\nYou said you wanted to respond more calmly when angry. We can make restarting smaller if that helps.', { requiresReply: true })];
  if (kind === 'paused') monitoring.pausedPlanIds = ['scheduled'];
} else if (kind === 'session') {
  messages = [msg('session-question', 'fitness', `Did your planned session for “${goal}” happen? There is no matching log yet. You can log it, tell me it changed, or leave it unconfirmed.`, { requiresReply: true })];
} else if (kind === 'training') {
  messages = [msg('first-week', 'fitness', 'You’re currently doing two easy 3 km runs a week. Here’s a first week to review at that starting level; we can revisit your three-run target after you tell me how it felt.\n\nThe sub-two-hour finish is a goal, not a promise. Let’s establish a comfortable routine first.', {
    requiresReply: true,
    planProposals: [{ planId: 'fitness', planGoal: goal, planEmoji: '🏃', description: 'Your first week, with session instructions', status: null, patch: {
      plan: { outlineType: 'SPECIFIC' },
      sessions: { upsert: [
        { activityId: 'run', date: '2026-09-29', quantity: 3, descriptiveGuide: 'Easy run. Start with a short walk, keep a pace where you can speak in full sentences, and take walking breaks if needed. Record how it felt afterwards.' },
        { activityId: 'run', date: '2026-10-01', quantity: 3, descriptiveGuide: 'Repeat the comfortable effort from Tuesday. The aim is a manageable session, not a faster time. Tell your coach if it felt harder than expected.' }
      ] }
    } }]
  })];
} else {
  messages = [
    msg('meditation-review', 'scheduled', 'You logged two meditations this week. Keep the same goal.'),
    msg('difficulty-report', 'fitness', 'Both runs felt hard on the hills. Could we make next week easier?', { role: 'USER', createdAt: ago(6) }),
    msg('coach-plan-review', 'fitness', 'You said the hills felt too hard. Review a lighter week with two runs.', { requiresReply: true,
      planProposals: [{ planId: 'fitness', planGoal: goal, planEmoji: '🏃', description: 'Reduce the weekly target from three runs to two', patch: { plan: { timesPerWeek: 2 } }, status: null }]
    })
  ];
}
if (messages?.length) {
  const last = messages.at(-1);
  monitoring.requests = [{ id: 'visual-review', planIds: last.planIds || [last.planId], kind: 'review', chatId: last.chatId, messageId: last.id, requiresReply: true, createdAt: last.createdAt, ...(kind === 'paused' ? { closedAt: ago(1) } : {}) }];
}
await call('/__coaching-monitoring', { messages, monitoring, planOverrides: [{ id:'fitness', goal, emoji:'🏃', timesPerWeek:3, durationType:'CUSTOM', finishingDate:'2027-03-28T12:00:00Z', notes:null, sessions:[], milestones:[], activities:[{id:'run',title:'Running',emoji:'🏃',measure:'kilometers',userId:'test-user'}] }] });
const follow = await call('/follow-through', undefined, 'GET');
const support = follow.state.supports.fitness;
await call('/follow-through/plans/fitness', { ...support, mode: 'WEEKLY', weekdays: [], time: null, coaching: { role:'training', followUps:true, dataAccess:{workouts:true,sleep:false} } }, 'PUT');
await call('/follow-through/plans/scheduled', { ...support, planId:'scheduled', mode:'WEEKLY', weekdays:[], time:null, coaching:{role:'consistency',followUps:true,dataAccess:{workouts:false,sleep:false}} }, 'PUT');
console.log(`Prepared synthetic ${kind} example.`);
