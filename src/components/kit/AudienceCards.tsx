import { Blocks, Globe2, GraduationCap, Mic, Users, ArrowUpRight } from "lucide-react"

import { MagicCard } from "@/components/ui/magic-card"

const audiences = [
  { label: "Accounting firm", href: "/work-with-me#accounting", Icon: Globe2 },
  { label: "Founder", href: "/work-with-me#founders", Icon: Blocks },
  { label: "Board or investor", href: "/work-with-me#boards", Icon: Users },
  { label: "College or employer", href: "/work-with-me#colleges", Icon: GraduationCap },
  { label: "Event organizer", href: "/work-with-me#speaking", Icon: Mic },
]

/** Audience entry points with a pointer-following spotlight (Magic UI: Magic Card). */
export function AudienceCards() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {audiences.map(({ label, href, Icon }) => (
        <a key={label} href={href} className="group block no-underline last:col-span-2 md:last:col-span-1">
          <MagicCard className="h-full rounded-2xl" gradientColor="#d1fae5" gradientFrom="#10b981" gradientTo="#0891b2" gradientOpacity={0.6}>
            <div className="flex h-full min-h-40 flex-col justify-between p-5">
              <div className="flex items-start justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="size-5" /></span>
                <ArrowUpRight className="size-4 text-neutral-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-600" />
              </div>
              <span className="text-[17px] font-semibold leading-tight tracking-tight text-ink">{label}</span>
            </div>
          </MagicCard>
        </a>
      ))}
    </div>
  )
}
