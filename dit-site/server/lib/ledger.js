// Creator-fee accounting. Integer lamports only. Observed != confirmed != allocated != transferred.
import { StoreError, PG, summarizeTreasury } from './store-core.js';
import { solAddress, solSignature } from './validate.js';
import { normalizeFeeEvent } from './circuit.js';

export const PUMP_PROGRAMS = new Set(['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA', 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ']);   // Pump, Pump AMM, Pump Fees (pump-fun-skills/coin-fees)

export function treasuryConfig(env) {
  const bps = env.TREASURY_BPS == null || env.TREASURY_BPS === '' ? 2500 : Number(env.TREASURY_BPS);
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000) throw new Error('TREASURY_BPS must be an integer 0-10000');
  const mechanism = env.TREASURY_TRANSFER_MECHANISM && env.TREASURY_TRANSFER_MECHANISM !== 'none' ? env.TREASURY_TRANSFER_MECHANISM : null;
  // Until a real transfer adapter verifies destination and amount from a finalized tx, a label in env cannot enable it.
  return { bps, treasuryWallet: env.TREASURY_WALLET || null, remainderWallet: env.REMAINDER_WALLET || null, mechanism, transferSupported: false };
}

// Net SOL received by `wallet` in one finalized transaction. Used as the AUTHORITATIVE received amount.
export function walletDelta(tx, wallet) {
  if (!tx?.meta || tx.meta.err !== null) return null;
  const keys = tx.transaction.message.accountKeys.map(k => (typeof k === 'string' ? k : k.pubkey)); const i = keys.indexOf(wallet); if (i < 0) return null;
  const d = tx.meta.postBalances[i] - tx.meta.preBalances[i] + (i === 0 ? tx.meta.fee : 0);
  return Number.isSafeInteger(d) ? d : null;
}
export function invokesPumpFeeProgram(tx) {
  const keys = tx.transaction.message.accountKeys.map(k => (typeof k === 'string' ? k : k.pubkey));
  const ixs = [...tx.transaction.message.instructions, ...(tx.meta.innerInstructions || []).flatMap(x => x.instructions)];
  return ixs.some(ix => PUMP_PROGRAMS.has(ix.programId || keys[ix.programIdIndex]));
}

export async function auditLog(store, actor, action, subject_type, subject_id, details = {}) { await store.insert('audit_logs', { actor, action, subject_type, subject_id: subject_id == null ? null : String(subject_id), details }); }

// Record a verified-authentic webhook. Never trusts the payload's amount: it only creates an OBSERVED receipt.
export async function ingestCircuitEvent(store, env, payload, { signatureValid }) {
  let ev; try { ev = normalizeFeeEvent(payload); } catch (e) { await auditLog(store, 'circuit', 'event_rejected', 'circuit_event', null, { reason: e.message }); throw Object.assign(new Error(e.message), { status: 422, public: true }); }
  let row;
  try { row = await store.insert('circuit_events', { source: 'circuit', external_id: ev.id, event_type: ev.type, payload, signature_valid: signatureValid }); }
  catch (e) { if (e instanceof StoreError && e.code === PG.UNIQUE) return { duplicate: true, event_id: ev.id }; throw e; }   // replayed delivery: acknowledged, not re-processed
  if (ev.kind !== 'creator_fee') { await store.update('circuit_events', [['id', 'eq', row.id]], { status: 'processed', processed_at: new Date().toISOString() }); return { ignored: true, type: ev.type }; }
  try { solAddress(ev.wallet, 'wallet'); solSignature(ev.signature); } catch (e) { await store.update('circuit_events', [['id', 'eq', row.id]], { status: 'rejected', error: e.message }); throw Object.assign(new Error(e.message), { status: 422, public: true }); }
  const r = await store.rpc('ingest_fee_receipt', { p_source: 'circuit', p_external_id: ev.id, p_mint: ev.mint, p_wallet: ev.wallet, p_signature: ev.signature, p_claimed: ev.lamports, p_simulated: false, p_event_id: row.id });
  await store.update('circuit_events', [['id', 'eq', row.id]], { status: 'processed', processed_at: new Date().toISOString() });
  return { receipt_id: r.receipt_id, created: r.created, status: 'observed' };
}

// Retry-safe reconciliation: observed receipts -> confirmed on chain -> allocation calculated. Failures leave the receipt observed for retry.
export async function reconcileReceipts(store, env, { getTransaction, maxPerRun = 20, now = () => new Date() }) {
  const cfg = treasuryConfig(env); const out = { confirmed: 0, failed: 0, retry: 0, skipped: 0 };
  const open = await store.select('fee_receipts', { filters: [['status', 'eq', 'observed']], order: ['observed_at', 'asc'], limit: maxPerRun });
  for (const r of open) {
    if (r.simulated) { out.skipped++; continue; }
    if (!r.tx_signature) { out.skipped++; continue; }
    let tx; try { tx = await getTransaction(r.tx_signature); } catch (e) { out.retry++; await store.insert('activity_events', { event_type: 'fee_reconcile_retry', severity: 'warn', title: 'Fee receipt confirmation deferred', detail: e.message, payload: { receipt_id: r.id } }); continue; }
    if (!tx) { out.retry++; continue; }                     // not finalized (yet)
    const fail = async note => { await store.update('fee_receipts', [['id', 'eq', r.id]], { status: 'failed', note }); await auditLog(store, 'worker', 'receipt_failed', 'fee_receipt', r.id, { note }); out.failed++; };
    if (tx.meta?.err !== null) { await fail('transaction failed on chain'); continue; }
    if (!invokesPumpFeeProgram(tx)) { await fail('transaction does not invoke a Pump fee program'); continue; }
    const d = walletDelta(tx, r.wallet);
    if (d == null || d <= 0) { await fail('referenced wallet received no SOL in this transaction'); continue; }
    await store.rpc('confirm_fee_receipt', { p_receipt: r.id, p_confirmed: d, p_treasury_bps: cfg.bps, p_treasury_dest: cfg.treasuryWallet, p_remainder_dest: cfg.remainderWallet, p_mechanism: cfg.mechanism, p_transfer_supported: cfg.transferSupported });
    out.confirmed++;
  }
  return out;
}

export async function recordExpense(store, { jobId, agentId, usdMicros }) {   // AI operating cost, recorded from provider-reported token usage; separate unit (never mixed with lamports)
  if (!Number.isSafeInteger(usdMicros) || usdMicros <= 0) return null;
  try { return await store.insert('treasury_ledger', { idempotency_key: 'expense:' + jobId, entry_type: 'expense_recorded', bucket: 'operating', unit: 'usd_micros', amount: usdMicros, job_id: jobId, memo: `LLM usage for ${agentId} (estimated from provider-reported tokens)` }); }
  catch (e) { if (e instanceof StoreError && e.code === PG.UNIQUE) return null; throw e; }
}

export async function treasuryView(store, env) {
  const cfg = treasuryConfig(env);
  const [ledger, allocations, receipts] = await Promise.all([store.select('treasury_ledger', { order: ['id', 'desc'], limit: 500 }), store.select('treasury_allocations', { order: ['created_at', 'desc'], limit: 100 }), store.select('fee_receipts', { order: ['observed_at', 'desc'], limit: 100 })]);
  const all = await store.select('treasury_ledger');
  const s = summarizeTreasury(all);
  const pendingTreasury = allocations.filter(a => !a.simulated && ['pending', 'unsupported', 'calculated'].includes(a.status)).reduce((n, a) => n + a.treasury_lamports, 0);
  return {
    target_bps: cfg.bps, target_percent: cfg.bps / 100, destinations: { treasury: cfg.treasuryWallet, remainder: cfg.remainderWallet },
    transfer: { mechanism: cfg.mechanism, supported: cfg.transferSupported, limitation: cfg.transferSupported ? null : 'No documented, authorised transfer mechanism is configured. Allocations are calculated and held as records only; nothing has been moved.' },
    totals: { ...s, pending_treasury_lamports: pendingTreasury, available_treasury_lamports: s.transferred_lamports + s.funding_lamports - s.expense_lamports },
    labels: { observed: 'Reported by an integration, not yet checked on chain', confirmed: 'Finalized transaction shows the wallet received this amount', allocation: 'Calculated split of confirmed fees', transferred: 'Recorded transfer; independently validate its on-chain signature before calling it verified' },
    receipts, allocations, ledger
  };
}
