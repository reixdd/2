"use client"
import { useRef } from "react"
import { ChevronLeft,ChevronRight } from "lucide-react"
import {modelTitle,localModel} from "@/lib/colosseum/models"
import type { Contender } from "@/lib/colosseum/characters"
import { ContenderPortrait } from "./contender-portrait"
export function ChampionCarousel({contenders,selectedId,recordedCounts,onSelect}:{contenders:Contender[];selectedId:string;recordedCounts:Record<string,number>;onSelect:(id:string)=>void}){
 const start=useRef<{x:number;y:number}|null>(null);const index=Math.max(0,contenders.findIndex(c=>c.id===selectedId));const step=(delta:number)=>onSelect(contenders[(index+delta+contenders.length)%contenders.length].id)
 return <div className="champion-selector" role="group" aria-label="Champion selection" tabIndex={0} style={{touchAction:"pan-y"}} onKeyDown={e=>{if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();step(e.key==="ArrowRight"?1:-1)}}} onPointerDown={e=>{start.current={x:e.clientX,y:e.clientY}}} onPointerCancel={()=>{start.current=null}} onPointerUp={e=>{const p=start.current;start.current=null;if(p&&Math.abs(e.clientX-p.x)>45&&Math.abs(e.clientX-p.x)>Math.abs(e.clientY-p.y)*1.3)step(e.clientX<p.x?1:-1)}}>
 <button className="selector-arrow tactile" aria-label="Previous champion" onClick={()=>step(-1)}><ChevronLeft/></button>
 {[-1,0,1].map(offset=>{const c=contenders[(index+offset+contenders.length)%contenders.length];return <button key={offset} aria-label={`Reveal ${modelTitle(c)}`} aria-pressed={offset===0} className={`champion-preview tactile ${offset===0?"selected":""}`} onClick={()=>onSelect(c.id)}><ContenderPortrait contender={c} size="sm"/><span>{localModel(c.id)?.title.split(" ").slice(0,2).join(" ")??c.family}</span><small>{offset===0?(recordedCounts[c.id]?`${recordedCounts[c.id]} recorded`:"Untested"):c.family}</small></button>})}
 <button className="selector-arrow tactile" aria-label="Next champion" onClick={()=>step(1)}><ChevronRight/></button></div>
}
