import { AnimatedShinyText } from "@/components/ui/animated-shiny-text"

/** Pill badge with a moving sheen (Magic UI: Animated Shiny Text). */
export function HeroBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 inline-flex items-center rounded-full border border-border bg-white/70 px-3 py-1 text-xs font-medium shadow-sm backdrop-blur">
      <span className="mr-2 size-1.5 rounded-full bg-emerald-500" />
      <AnimatedShinyText className="mx-0 max-w-none text-neutral-600">{children}</AnimatedShinyText>
    </div>
  )
}
