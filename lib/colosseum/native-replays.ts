import battle from "@/data/native-battle-phase4.json"
import {getChallenge} from "@/engines/original/shared/challenges/index.js"
import type {BattleRecord} from "./battle"
/** Complete actual CPU responses, preserved from this phase's fresh smoke test. */
export function nativeReplays(){
 const challenge=getChallenge(battle.challengeId) as ReturnType<typeof getChallenge> & {promptHash:string}
 if(!challenge||challenge.version!==battle.challenge.version||challenge.user!==battle.challenge.user||challenge.promptHash!==battle.challenge.promptHash)return []
 return battle.entries.flatMap(entry=>{
  if(entry.status!=="COMPLETED"||entry.error||!entry.verification||!entry.output.trim())return []
  const check=challenge.verify(entry.output)
  if(check.score!==entry.verification.score||check.passed!==entry.verification.passed)return []
  const contenderId=entry.model==="qwen3-0.6b-q8"?"capybara-sage":"qwen25-sage"
  const record:BattleRecord={mode:"recorded",contenderId,challengeTitle:`${battle.challenge.title} · original CPU challenge`,prompt:entry.messages.map(m=>`${m.role.toUpperCase()}: ${m.content}`).join("\n\n"),answer:entry.output,checker:`${battle.challengeId} v${battle.challenge.version} · original deterministic checker`,correct:check.passed,model:`${entry.label} / ${entry.modelIdentity.declaredVersion} / ${entry.modelArtifact.backend}`,recordedAt:entry.timestamps.completedAt,evidenceHref:"/evidence/native-battle-phase4.json"}
  return [{id:`${battle.battleId}:${entry.entryId}`,record,entry,check,challengeId:battle.challengeId}]
 })
}
export const NATIVE_REPLAYS=nativeReplays()
