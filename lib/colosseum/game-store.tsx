"use client"
import {createContext,useContext,useEffect,useState,useRef,type ReactNode} from "react"
import {CONTENDERS,getContender} from "./characters"
import {createBuild,cloneBuild,changeContender,equipSkill,unequipSkill,saveBuildEdit,validateBuild,configsEqual,configFingerprint,BUILD_LIMITS,type AgentBuild,type BuildConfig} from "./builds"
import {listBuilds,saveBuild,importBuild,exportBuild} from "./build-store"
import {readEvents,mergeEvents} from "./journey-store"
import {dayKey,type GameEvent} from "./gameplay"

function useGameState(){
 const [builds,setBuilds]=useState<AgentBuild[]>([]),[draft,setDraft]=useState<AgentBuild|null>(null),[events,setEvents]=useState<GameEvent[]>([]),[message,setMessage]=useState(""),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false)
 const undo=useRef<BuildConfig[]>([])
 const selected=builds.find(b=>b.id===draft?.id),dirty=!!draft&&(!selected||draft.name!==selected.name||!configsEqual(draft.config,selected.config)||JSON.stringify(draft.config.equipmentSlots)!==JSON.stringify(selected.config.equipmentSlots))
 async function refresh(){const [b,e]=await Promise.all([listBuilds(),readEvents()]);setBuilds(b);setEvents(e);return b}
 useEffect(()=>{let mounted=true;void refresh().then(b=>{if(!mounted)return;let active:AgentBuild|undefined;try{const raw=sessionStorage.getItem("colosseum:active-draft:v2")??localStorage.getItem("colosseum:active-build:v2");if(raw)active=importBuild(raw)}catch{}setDraft(active??b[0]??createBuild(CONTENDERS[0].id,"First experiment"));setLoaded(true)}).catch(()=>{if(!mounted)return;setLoaded(true);setDraft(createBuild(CONTENDERS[0].id,"First experiment"));setMessage("Storage unavailable. Keep your work with Export build; progress remains in this session.")});const update=()=>{void refresh().catch(()=>setMessage("Could not refresh browser saves. Export your draft before leaving."))};const cross=(e:StorageEvent)=>{if(e.key==="colosseum:build-notice"||e.key==="colosseum:journey-notice"){update();setMessage("Another tab updated saved work. Your draft remains intact; reload the saved build before overwriting it.")}};window.addEventListener("storage",cross);window.addEventListener("colosseum-builds-changed",update);return()=>{mounted=false;window.removeEventListener("storage",cross);window.removeEventListener("colosseum-builds-changed",update)}},[])
 useEffect(()=>{if(!loaded||!draft)return;try{sessionStorage.setItem("colosseum:active-draft:v2",exportBuild(draft))}catch{setMessage("Draft storage is full or disabled. Export build to keep your work.")}},[draft,loaded])
 useEffect(()=>{if(!dirty)return;const f=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=""};window.addEventListener("beforeunload",f);return()=>window.removeEventListener("beforeunload",f)},[dirty])
 async function event(type:GameEvent["type"],subject:string,title:string,id?:string,detail?:string){const e:GameEvent={id:id??crypto.randomUUID(),type,subject,title,at:Date.now(),detail};setEvents(old=>old.some(v=>v.id===e.id)?old:[e,...old]);try{await mergeEvents([e]);try{localStorage.setItem("colosseum:journey-notice",String(Date.now()))}catch{}}catch{setMessage("Progress could not be saved. Export the journal to keep this session.")}}
 function edit(config:BuildConfig){if(!draft)return;undo.current.push(structuredClone(draft.config));setDraft({...draft,config})}
 function place(skillId:string,index?:number){
  if(!draft)return
  const config=draft.config,slots=[...(config.equipmentSlots??Array.from({length:Math.max(3,config.skillIds.length)},(_,i)=>config.skillIds[i]??null))]
  const original=slots.indexOf(skillId),destination=index??slots.indexOf(null)
  if(destination<0||destination>2){setMessage('Choose one of the three sockets to replace a relic.');return}
  if(original>=0){const displaced=slots[destination];slots[destination]=skillId;slots[original]=original===destination?skillId:displaced;edit({...config,skillIds:slots.filter((id):id is string=>!!id),equipmentSlots:slots});return}
  const displaced=slots[destination],base={...config,skillIds:config.skillIds.filter(id=>id!==displaced)},result=equipSkill(base,skillId)
  if(!result.ok){setMessage(result.reason);return}
  slots[destination]=skillId;const next={...result.config,skillIds:slots.filter((id):id is string=>!!id),equipmentSlots:slots};edit(next);setMessage('Relic equipped. Configuration changed; performance remains untested.');void event('skill_equipped',skillId,'Relic equipped',`equip:${draft.id}:${skillId}:${configFingerprint(next)}`)
 }
 function remove(id:string){if(!draft)return;edit(unequipSkill(draft.config,id));void event("skill_removed",id,"Relic removed")}
 function confirmChampion(id:string){if(!getContender(id))return;if(draft&&draft.config.contenderId===id)return;const next=createBuild(id,`${getContender(id)?.family} experiment`);if(draft){const changed=changeContender(draft.config,id);next.config=changed.config}setDraft(next);setMessage("Model selected. The previous saved build remains unchanged.");void event("champion_selected",id,"Model selected")}
 async function persist(next?:AgentBuild){const current=next??draft;if(!current)return false;const validation=validateBuild(current);if(!validation.valid){setMessage(validation.issues.find(i=>i.severity==="error")?.message??"Invalid build");return false}const prior=builds.find(b=>b.id===current.id);if(!prior&&builds.length>=BUILD_LIMITS.maxBuilds){setMessage("Saved build limit reached. Export an existing build first.");return false}const saved=prior?saveBuildEdit(prior,{name:current.name,config:current.config}):{...current,name:current.name.trim()};setBusy(true);try{await saveBuild(saved,prior?current.updatedAt:undefined);setBuilds(old=>[saved,...old.filter(b=>b.id!==saved.id)]);setDraft(saved);try{localStorage.setItem("colosseum:active-build:v2",exportBuild(saved))}catch{}setMessage(`Saved revision v${saved.version}. CONFIGURED — NOT TESTED.`);void event("build_saved",saved.id,"Build saved",`save:${saved.id}:${saved.version}`);return true}catch(e){setMessage(e instanceof Error?e.message:"Save failed; export the draft.");return false}finally{setBusy(false)}}
 return {builds,draft,events,message,setMessage,loaded,busy,dirty,setDraft,edit,place,remove,persist,event,refresh,confirmChampion,select:(b:AgentBuild)=>{setDraft(structuredClone(b));undo.current=[]},create:()=>setDraft(createBuild(draft?.config.contenderId??CONTENDERS[0].id,"New experiment")),undo:()=>{const config=undo.current.pop();if(config&&draft)setDraft({...draft,config})},clone:()=>{if(draft)setDraft(cloneBuild(draft))},mergeJourney:async(incoming:GameEvent[])=>{await mergeEvents(incoming);await refresh()},evidenceInspected:(id:string)=>event("evidence_inspected",id,"Evidence inspected",`inspect:${dayKey()}:${id}`)}
}
const Context=createContext<ReturnType<typeof useGameState>|null>(null)
export function GameProvider({children}:{children:ReactNode}){const game=useGameState();return <Context.Provider value={game}>{children}</Context.Provider>}
export function useGame(){const value=useContext(Context);if(!value)throw Error("GameProvider missing");return value}
