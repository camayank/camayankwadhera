import { Globe2, GraduationCap, ListChecks, Scale, FileCheck2, Landmark, ShieldCheck, TrendingUp } from "lucide-react"

import { BentoCard, BentoGrid } from "@/components/ui/bento-grid"
import { OrbitingCircles } from "@/components/ui/orbiting-circles"

function Orbit() {
  const chip = "flex size-10 items-center justify-center rounded-xl border border-border bg-white text-ink shadow-sm"
  return (
    <div className="absolute -right-24 -top-24 flex size-[340px] items-center justify-center opacity-50 [mask-image:linear-gradient(to_bottom,#000_55%,transparent)] lg:-right-6 lg:-top-6 lg:opacity-100">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-ink text-lg font-semibold text-white shadow-lg">C4</div>
      <OrbitingCircles radius={130} iconSize={40} duration={28}>
        <div className={chip}><FileCheck2 className="size-5" /></div>
        <div className={chip}><Landmark className="size-5" /></div>
        <div className={chip}><ShieldCheck className="size-5" /></div>
        <div className={chip}><TrendingUp className="size-5" /></div>
      </OrbitingCircles>
      <OrbitingCircles radius={74} iconSize={32} duration={18} reverse>
        <div className={chip + " size-8 rounded-lg"}><ListChecks className="size-4" /></div>
        <div className={chip + " size-8 rounded-lg"}><Scale className="size-4" /></div>
      </OrbitingCircles>
    </div>
  )
}

function Glow({ Icon }: { Icon: React.ElementType }) {
  return (
    <div className="absolute inset-0">
      <div className="absolute -right-10 -top-10 size-56 rounded-full bg-emerald-400/20 blur-3xl" />
      <Icon className="absolute right-5 top-5 size-28 text-ink/[.06]" strokeWidth={1} />
    </div>
  )
}

const cards = [
  { name: "CA4CPA", description: "Technology-first accounting and tax support for CPA firms.", href: "/ca4cpa", cta: "For CPA firms", Icon: Globe2, className: "lg:col-span-2", background: <Orbit /> },
  { name: "DigiComply", description: "Compliance workflows and reminders.", href: "/ventures#digicomply", cta: "Product walkthrough", Icon: ListChecks, className: "lg:col-span-1", background: <Glow Icon={ListChecks} /> },
  { name: "CorpReady", description: "Skills mapped to careers.", href: "/ventures#corpready", cta: "Colleges and employers", Icon: GraduationCap, className: "lg:col-span-1", background: <Glow Icon={GraduationCap} /> },
  { name: "MKW Advisors", description: "Valuation and cross-border advisory.", href: "/ventures#mkw", cta: "Scope discussion", Icon: Scale, className: "lg:col-span-1", background: <Glow Icon={Scale} /> },
  { name: "Legal Suvidha", description: "Startup and recurring compliance.", href: "/ventures#legal-suvidha", cta: "Enquire", Icon: FileCheck2, className: "lg:col-span-1", background: <Glow Icon={FileCheck2} /> },
]

/** Featured ventures (Magic UI: Bento Grid + Orbiting Circles). */
export function VentureBento() {
  return (
    <BentoGrid className="auto-rows-[17rem]">
      {cards.map((card) => (
        <BentoCard key={card.name} {...card} />
      ))}
    </BentoGrid>
  )
}
