import { DotPattern } from "@/components/ui/dot-pattern"

/** Dotted backdrop that fades toward the edges (Magic UI: Dot Pattern). */
export function HeroDots() {
  return (
    <DotPattern width={22} height={22} cr={1} className="text-ink/15 [mask-image:radial-gradient(620px_circle_at_30%_40%,#000,transparent)]" />
  )
}
