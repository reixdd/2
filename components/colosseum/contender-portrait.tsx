import {sitePath} from "@/lib/colosseum/site-path"
import Image from "next/image"
import { cn } from "@/lib/utils"
import type { Contender } from "@/lib/colosseum/characters"

const SIZES = {
  sm: "h-12 w-12",
  md: "h-20 w-20",
  lg: "h-28 w-28",
}

export function ContenderPortrait({
  contender,
  size = "md",
}: {
  contender: Contender
  size?: keyof typeof SIZES
}) {
  if (!contender.portrait) {
    return (
      <div
        className={cn(
          SIZES[size],
          "flex shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-muted/60",
        )}
      >
        <span className="text-[10px] tracking-wider text-muted-foreground uppercase">N/A</span>
      </div>
    )
  }

  return (
    <div
      className={cn(SIZES[size], "edge-glow relative shrink-0 overflow-hidden rounded-full border border-border/60")}
    >
      <Image
        src={sitePath(contender.portrait || "/placeholder.svg")}
        alt={contender.name}
        fill
        sizes="112px"
        className="object-cover"
        style={{ objectPosition: contender.portraitPosition ?? "50% 15%" }}
      />
    </div>
  )
}
