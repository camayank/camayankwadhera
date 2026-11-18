import type { COBEOptions } from "cobe"

import { Globe } from "@/components/ui/globe"

const config: COBEOptions = {
  width: 800, height: 800, onRender: () => {}, devicePixelRatio: 2,
  phi: 4.6, theta: 0.25, dark: 1, diffuse: 1.1, mapSamples: 16000, mapBrightness: 5,
  baseColor: [0.18, 0.24, 0.32], markerColor: [52 / 255, 211 / 255, 153 / 255], glowColor: [0.06, 0.45, 0.34],
  // one marker: where the work is delivered from
  markers: [{ location: [28.6139, 77.209], size: 0.09 }],
}

/** Interactive globe (Magic UI: Globe). */
export function WorldGlobe() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[460px]">
      <Globe config={config} className="top-0" />
    </div>
  )
}
