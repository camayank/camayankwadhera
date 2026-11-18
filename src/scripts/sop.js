// SOP exploded view: four stacked plates separate as you scroll, then each layer
// lights up in turn and its procedures rise from the plate.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const section = document.querySelector("[data-sop]");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

if (section && !reduceMotion) {
  const pick = (selector, scope = section) => gsap.utils.toArray(scope.querySelectorAll(selector));
  const stack = section.querySelector(".sop-stack");
  const plates = pick(".plate3d"), steps = pick(".sop-steps li"), legends = pick(".sop-legend");
  const chips = plates.map((plate) => pick(".chip", plate));
  section.classList.add("sop-live");

  const setLayer = (active) => {
    [plates, steps, legends].forEach((group) => group.forEach((el, index) => el.classList.toggle("on", index === active)));
    section.classList.toggle("sop-all", active < 0);
  };
  setLayer(-1);

  const gap = Math.min(130, section.querySelector(".sop-stage").clientHeight / (window.innerWidth < 820 ? 5.6 : 4.2));
  const timeline = gsap.timeline({
    defaults: { ease: "power2.inOut" },
    scrollTrigger: { trigger: section, start: "top top", end: "+=3600", pin: true, scrub: 0.6 },
    onUpdate: () => {
      const time = timeline.time();
      setLayer(time < 1 || time >= 5 ? -1 : Math.min(3, Math.floor(time - 1)));
    },
  });

  timeline
    .fromTo(stack, { "--rz": "-52deg" }, { "--rz": "-30deg", duration: 5.6, ease: "none" }, 0)
    // closed block opens into four separate layers
    .fromTo(plates, { z: (index) => index * 12 }, { z: (index) => index * gap, duration: 1 }, 0);
  // each layer's procedures stand up while it is lit
  chips.forEach((group, index) => {
    timeline.from(group, { scale: 0, duration: 0.35, stagger: 0.07, ease: "back.out(2.5)" }, 1.05 + index);
  });
  timeline.to({}, { duration: 0.6 }, 5);

  // If the browser is not rendering frames, show the finished state instead
  const startFrame = gsap.ticker.frame;
  setTimeout(() => {
    if (gsap.ticker.frame - startFrame > 3) return;
    timeline.scrollTrigger?.kill(true);
    timeline.kill();
    // clear only what was animated: the plates keep their own inline layer index
    gsap.set([...plates, ...chips.flat()], { clearProps: "transform" });
    stack.style.removeProperty("--rz");
    section.classList.remove("sop-live", "sop-all");
  }, 2000);
}
