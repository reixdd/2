import type {CSSProperties} from "react"
import {sitePath} from "@/lib/colosseum/site-path"
export function FloatingWorld() {
  return <div className="floating-world" aria-hidden="true" style={{"--world-image":`url("${sitePath("/world/floating-lands.svg")}")`} as CSSProperties}><div className="world-haze"/><div className="world-cloud cloud-one"/><div className="world-cloud cloud-two"/></div>
}
