import { Marquee } from "@/components/ui/marquee"

/** Scrolling strip of names (Magic UI: Marquee). */
export function LogoMarquee({ items }: { items: { name: string; note: string }[] }) {
  return (
    <div className="dark relative bg-night py-6 text-white">
      <Marquee pauseOnHover className="[--duration:36s] [--gap:3.5rem]">
        {items.map((item) => (
          <div key={item.name} className="flex items-baseline gap-3 whitespace-nowrap">
            <span className="text-2xl font-semibold tracking-tight md:text-3xl">{item.name}</span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-emerald-300">{item.note}</span>
          </div>
        ))}
      </Marquee>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-linear-to-r from-night" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-linear-to-l from-night" />
    </div>
  )
}
