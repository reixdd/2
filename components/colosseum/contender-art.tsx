import {sitePath} from "@/lib/colosseum/site-path"
import Image from "next/image"
import type {Contender} from "@/lib/colosseum/characters"
export function ContenderArt({contender,eager=false}:{contender:Contender;eager?:boolean}){return <div className="standee-art">{contender.portrait?<Image src={sitePath(contender.portrait)} alt={`${contender.name}, fictional ${contender.family} avatar`} fill priority={eager} sizes="(max-width:640px) 40vw, 280px" style={{objectFit:"contain",objectPosition:contender.portraitPosition??"50% 50%"}}/>:<span>{contender.family} avatar</span>}</div>}
