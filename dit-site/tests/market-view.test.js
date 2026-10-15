import {test} from 'node:test';
import assert from 'node:assert/strict';
import {categoryOfMarketSignal,chooseVisibleSignals} from '../dist/market-view.js';
const now=Date.parse('2026-10-15T20:30:00Z');
const base={address:'So11111111111111111111111111111111111111112',
 observed_at:new Date(now-2000).toISOString(),source_observed_at:new Date(now-2000).toISOString()};
test('a recently traded old pair is not NEW even when a tape observation is 2 seconds old',()=>{
 const old={...base,pair_created_at:new Date(now-900_000).toISOString(),kind:'tape'};
 assert.equal(categoryOfMarketSignal(old,now),'RECENT');
 assert.equal(chooseVisibleSignals([old],'new',now).length,0);
 assert.equal(chooseVisibleSignals([old],'all',now).length,1);
});
test('verified pair creation within five minutes is NEW; token creation and first seen are not substitutes',()=>{
 const recent=new Date(now-50_000).toISOString();
 assert.equal(categoryOfMarketSignal({...base,pair_created_at:recent,kind:'tape'},now),'NEW');
 assert.equal(categoryOfMarketSignal({...base,token_created_at:recent,first_seen_at:recent,kind:'trenches'},now),'UNVERIFIED');
});
test('trending only includes provider-tagged trending, while all includes unknown age',()=>{
 const item={...base,kind:'trending',pair_created_at:null};
 assert.equal(chooseVisibleSignals([item],'trending',now).length,1);
 assert.equal(chooseVisibleSignals([item],'new',now).length,0);
});
