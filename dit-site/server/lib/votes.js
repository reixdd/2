import { StoreError, PG } from './store-core.js';
import { AGENT_IDS } from './agents.js';
import { agentId } from './validate.js';

export async function castVote(store, userId, agent) {
  agentId(agent);
  try { return await store.rpc('cast_vote', { p_user: userId, p_agent: agent, p_max_changes_per_hour: 5 }); }
  catch (e) {
    if (e instanceof StoreError && e.code === PG.RATE) { const err = new Error(e.message); err.status = 429; err.public = true; throw err; }
    throw e;
  }
}
export async function voteTotals(store) {
  const rows = await store.select('agent_vote_counts');
  const by = Object.fromEntries(rows.map(r => [r.agent_id, Number(r.votes)]));
  const total = AGENT_IDS.reduce((n, id) => n + (by[id] || 0), 0);
  const board = AGENT_IDS.map(id => ({ agent_id: id, votes: by[id] || 0, percent: total ? Math.round(((by[id] || 0) / total) * 1000) / 10 : 0 })).sort((a, b) => b.votes - a.votes || a.agent_id.localeCompare(b.agent_id));
  return { total, leaderboard: board.map((r, i) => ({ ...r, rank: i + 1 })) };
}
export async function currentVote(store, userId) { const [v] = await store.select('agent_votes', { filters: [['user_id', 'eq', userId]], limit: 1 }); return v ? { agent_id: v.agent_id, updated_at: v.updated_at } : null; }
