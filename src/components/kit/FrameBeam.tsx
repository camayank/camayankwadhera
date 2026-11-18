import { BorderBeam } from "@/components/ui/border-beam"

/** Light travelling round the hero frame (Magic UI: Border Beam). */
export function FrameBeam() {
  return (
    <>
      <BorderBeam size={220} duration={9} borderWidth={2} colorFrom="#34d399" colorTo="#22d3ee" />
      <BorderBeam size={220} duration={9} delay={4.5} borderWidth={2} colorFrom="#22d3ee" colorTo="#34d399" />
    </>
  )
}
