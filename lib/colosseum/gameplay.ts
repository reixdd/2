import { z } from "zod"
import { getChallenge, CHALLENGES } from "./challenges"
import { ledgerFindings, SOLANA_DATA, scaleAmount } from "./solana"

export const GAME_VERSION = 1
export const eventTypes = ["champion_selected", "skill_equipped", "skill_removed", "build_saved", "mutation_sealed", "challenge_started", "battle_completed", "practice_completed", "mission_completed", "evidence_inspected"] as const
export type GameEvent = { id: string; type: typeof eventTypes[number]; at: number; subject: string; title: string; detail?: string }
export type Practice = { id: string; challengeId: string; challengeVersion: number; answer: string; correct: boolean; at: number }
export function gradePractice(challengeId: string, answer: string, at = Date.now()): Practice {
 const challenge = getChallenge(challengeId)
 if (!challenge?.available || !challenge.task) throw Error("This challenge has no deterministic checker.")
 if (answer.length > 8000) throw Error("Answer is too long.")
 const result = challenge.task.check(/^ANSWER:/i.test(answer.trim()) ? answer : `ANSWER: ${answer.trim()}`)
 return { id: crypto.randomUUID(), challengeId, challengeVersion: challenge.version ?? 1, answer, correct: result.correct, at }
}
export const MISSIONS = [
 { id: "supply", name: "The Supply Chamber", concept: "Decimals", question: "The documentation gives amount 100000 and decimals 2. What displayed amount does that represent?", hint: "Divide the integer amount by 10². No floating-point rounding is needed.", kind: "number", options: [] },
 { id: "mint", name: "The Mint Gate", concept: "Identity", question: "Do the supply and largest-account examples describe the same token mint?", hint: "Compare the complete mint addresses; the documentation examples use different mints.", kind: "choice", options: [{ value: "different", label: "Different mints — cannot combine" }, { value: "same", label: "Same mint — combine amounts" }] },
 { id: "holders", name: "The Holder Observatory", concept: "Accounts ≠ owners", question: "The example lists two token accounts without owner addresses. How many unique owners are proven?", hint: "Several token accounts can belong to one owner. Owner fields are absent.", kind: "choice", options: [{ value: "unknown", label: "Unknown from this evidence" }, { value: "two", label: "Exactly two unique owners" }, { value: "one", label: "Exactly one owner" }] },
 { id: "source", name: "The Evidence Archive", concept: "Provenance", question: "What kind of evidence are you inspecting on this island?", hint: "These are captured official documentation examples, not a current network observation.", kind: "choice", options: [{ value: "docs", label: "Official documentation examples" }, { value: "live", label: "Current live blockchain data" }] },
] as const
export function gradeMission(id: string, answer: string) {
 switch(id) { case "supply": return /^\d+(\.\d+)?$/.test(answer.trim()) && Number(answer) === Number(ledgerFindings().scaledSupply); case "mint": return answer === "different"; case "holders": return answer === "unknown"; case "source": return answer === "docs"; default: return false }
}
export function missionArtifact(id: string) {
 if(id === "supply") {const value=SOLANA_DATA.records[0].response.result.value as {amount:string;decimals:number};return `${value.amount} ÷ 10^${value.decimals} = ${scaleAmount(value.amount,value.decimals)}`}
 return id === "mint" ? "Supply mint ≠ account-list mint" : id === "holders" ? "Account A ─┐   ? owner\nAccount B ─┘   ? owner" : "Documentation → captured example → your interpretation"
}
export function dayKey(now = Date.now()) {return new Date(now).toISOString().slice(0,10)}
export function dailyContracts(events: GameEvent[], now = Date.now()) {
 const day = dayKey(now), today=events.filter(e=>dayKey(e.at)===day)
 const playable=CHALLENGES.filter(c=>c.available&&c.task), seed=Array.from(day).reduce((n,c)=>n+c.charCodeAt(0),0),challenge=playable[seed%playable.length]
 return {day,version:GAME_VERSION,challenge,items:[
  {id:"practice",name:"The Daily Challenge",route:`/?challenge=${challenge.id}#trial-heading`,done:today.some(e=>e.type==="practice_completed"&&e.subject===challenge.id)},
  {id:"relic",name:"The Relic Experiment",route:"/mutation-lab",done:today.some(e=>e.type==="mutation_sealed")},
  {id:"evidence",name:"The Evidence Quest",route:"/battle-archive",done:today.some(e=>e.type==="evidence_inspected")},
  {id:"ledger",name:"The Ledger Expedition",route:"/solana",done:today.some(e=>e.type==="mission_completed")},
 ]}
}
const eventSchema=z.object({id:z.string().min(1).max(200),type:z.enum(eventTypes),at:z.number().finite().nonnegative(),subject:z.string().max(200),title:z.string().max(200),detail:z.string().max(2000).optional()})
export function importJourney(raw: string): GameEvent[] {
 if(raw.length>1_000_000) throw Error("Journey file is too large.")
 const parsed=z.object({format:z.literal("colosseum-journey"),version:z.literal(1),events:z.array(eventSchema).max(2000)}).parse(JSON.parse(raw))
 return [...new Map(parsed.events.map(e=>[e.id,e])).values()]
}
export function exportJourney(events: GameEvent[]) { return JSON.stringify({format:"colosseum-journey",version:1,note:"Personal browser progress; client-controlled and not verified AI performance.",events},null,2) }
