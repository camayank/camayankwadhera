import { useRef } from "react"
import { MonitorCheck, BadgeCheck, PenLine } from "lucide-react"

import { AnimatedBeam } from "@/components/ui/animated-beam"

const nodes = [
  { label: "We prepare", Icon: MonitorCheck },
  { label: "We review", Icon: BadgeCheck },
  { label: "You sign", Icon: PenLine },
]

/** Three checks joined by moving light (Magic UI: Animated Beam). */
export function ChecksBeam() {
  const container = useRef<HTMLDivElement>(null)
  const refs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]
  return (
    <div ref={container} className="relative mx-auto flex max-w-3xl items-start justify-between py-6">
      {nodes.map(({ label, Icon }, index) => (
        <div key={label} className="z-10 flex w-28 flex-col items-center gap-4 text-center md:w-40">
          <div ref={refs[index]} className={"flex size-16 items-center justify-center rounded-2xl border border-border bg-white shadow-[0_10px_30px_-12px_rgba(11,18,32,.35)] md:size-20 " + (index === 2 ? "bg-linear-to-br from-emerald-500 to-emerald-700 text-white border-transparent" : "text-ink")}>
            <Icon className="size-7 md:size-8" strokeWidth={1.6} />
          </div>
          <span className="text-base font-semibold leading-tight tracking-tight md:text-xl">{label}</span>
        </div>
      ))}
      <AnimatedBeam containerRef={container} fromRef={refs[0]} toRef={refs[1]} gradientStartColor="#10b981" gradientStopColor="#0891b2" pathColor="#94a3b8" pathOpacity={0.35} duration={4} />
      <AnimatedBeam containerRef={container} fromRef={refs[1]} toRef={refs[2]} gradientStartColor="#10b981" gradientStopColor="#0891b2" pathColor="#94a3b8" pathOpacity={0.35} duration={4} delay={1.2} />
    </div>
  )
}
