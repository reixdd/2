"use client"
import {useState} from "react"
import {DndContext,PointerSensor,TouchSensor,KeyboardSensor,useSensor,useSensors,useDraggable,useDroppable,type DragEndEvent} from "@dnd-kit/core"
import {CSS} from "@dnd-kit/utilities"
import {SKILLS,getSkill,type Skill} from "@/lib/colosseum/skills"
import {useGame} from "@/lib/colosseum/game-store"
import {RelicIcon} from "./skill-art"
function Relic({skill,onPick,onInspect,equipped}:{skill:Skill;onPick:()=>void;onInspect:()=>void;equipped:boolean}){
 const {attributes,listeners,setNodeRef,transform,isDragging}=useDraggable({id:skill.id,disabled:!skill.available})
 return <article className={`relic-tile ${equipped?'is-equipped':''} ${!skill.available?'locked':''}`} data-skill={skill.id}><button ref={setNodeRef} {...attributes} {...listeners} className="relic-handle" aria-label={`Drag ${skill.name}`} style={{transform:CSS.Translate.toString(transform),opacity:isDragging?.6:1,zIndex:isDragging?100:undefined}} onClick={onPick}><RelicIcon skillId={skill.id} wing={skill.wing} size={48} dim={!skill.available}/></button><strong>{skill.name}</strong><small>{equipped?'Equipped':skill.available?'Instruction relic':'Offline tool'}</small><div><button onClick={onPick} disabled={!skill.available}>Select relic</button><button onClick={onInspect}>Inspect</button></div></article>
}
function Socket({index,skillId,onPlace,onRemove,picked}:{index:number;skillId?:string;onPlace:()=>void;onRemove:()=>void;picked:boolean}){
 const {setNodeRef,isOver}=useDroppable({id:`slot-${index}`}),skill=getSkill(skillId)
 const drag=useDraggable({id:`equipped-${index}`,disabled:!skill})
 return <div ref={setNodeRef} className={`forge-socket ${skill?'filled':''} ${isOver?'over':''}`}><button className="socket-target" aria-label={`Equipment slot ${index+1}${skill?': '+skill.name:''}`} onClick={onPlace}>{skill?<RelicIcon skillId={skill.id} wing={skill.wing} size={38}/>:<span className="empty-rune" aria-hidden>◇</span>}<span><small>SOCKET {index+1}</small><strong>{skill?.name??(picked?'Place selected relic':'Empty socket')}</strong></span></button>{skill&&<><button ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners} aria-label={`Move ${skill.name}`} className="move-relic" style={{transform:CSS.Translate.toString(drag.transform)}}>⠿</button><button aria-label={`Remove ${skill.name}`} onClick={onRemove}>×</button></>}</div>
}
export function EquipmentForge({onInspect}:{onInspect:(skill:Skill)=>void}){
 const game=useGame(),[picked,setPicked]=useState<string|null>(null)
 const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}),useSensor(TouchSensor,{activationConstraint:{delay:240,tolerance:8}}),useSensor(KeyboardSensor))
 const config=game.draft?.config
 const slots=config?.equipmentSlots??config?.skillIds??[]
 function place(id:string,index?:number){game.place(id,index);setPicked(null)}
 function dragEnd(event:DragEndEvent){if(!event.over||!config)return;const match=String(event.over.id).match(/^slot-(\d)$/);if(!match)return;const id=String(event.active.id);const skill=id.startsWith('equipped-')?slots[Number(id.slice(9))]:id;if(skill)place(skill,Number(match[1]))}
 return <DndContext sensors={sensors} onDragEnd={dragEnd} onDragCancel={()=>setPicked(null)}><section className="forge-tools" aria-label="Relic equipment"><div className="equipment-dock" aria-label="Equipped abilities">{Array.from({length:Math.max(3,slots.length)},(_,i)=><Socket key={i} index={i} skillId={slots[i]??undefined} picked={!!picked} onPlace={()=>{if(picked)place(picked,i)}} onRemove={()=>{const id=slots[i];if(id)game.remove(id)}}/>)}</div>{(slots.length)>3&&<p className="notice">Legacy fourth relic retained. New loadouts use three sockets.</p>}<div className="relic-selection"><p role="status">{picked?`${getSkill(picked)?.name} selected. Choose a socket or equip to the next empty socket.`:'Drag a relic into a socket, or select it and choose where it belongs.'}</p>{picked&&<><button className="action" onClick={()=>place(picked)}>Equip selected relic</button><button className="action" onClick={()=>setPicked(null)}>Cancel selection</button></>}</div><div className="relic-inventory" aria-label="Relic inventory">{SKILLS.map(s=><Relic key={s.id} skill={s} equipped={config?.skillIds.includes(s.id)??false} onPick={()=>setPicked(s.id)} onInspect={()=>onInspect(s)}/>)}</div></section></DndContext>
}
