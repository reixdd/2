// Local-only demo: does not contact Circuit, wallets or Solana.
const secret=process.env.DIT_SIMULATION_SECRET;
if(!secret||secret.length<32)throw Error('Set DIT_SIMULATION_SECRET (32+ characters) for the local demo.');
const url='http://127.0.0.1:'+(process.env.PORT||4173)+'/api/simulations/creator-fees';
const res=await fetch(url,{method:'POST',headers:{authorization:'Bearer '+secret,'content-type':'application/json'},body:JSON.stringify({event_id:'local-demo-'+Date.now(),fee_amount_sol:'0.36'})});
console.log('status',res.status,JSON.stringify(await res.json(),null,2));
if(!res.ok)process.exitCode=1;
