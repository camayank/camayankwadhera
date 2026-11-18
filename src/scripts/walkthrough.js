// CA4CPA walkthrough: the section pins while one illustrated return moves through
// four stages in 3D, driven by scroll. The CSS default is the finished state, so
// without this script (or with reduced motion) nothing is hidden.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const section = document.querySelector("[data-walk]");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

if (section && !reduceMotion) {
  const pick = (selector) => gsap.utils.toArray(section.querySelectorAll(selector));
  const desk = section.querySelector(".desk");
  const docs = pick(".doc"), bars = pick(".row span"), flags = pick(".flag");
  const sheet = pick(".sheet"), notes = pick(".notes"), stamp = pick(".stamp");
  const steps = pick(".walk-steps li");
  section.classList.add("walk-live");

  const setStep = (active) => steps.forEach((step, index) => step.classList.toggle("on", index === active));
  setStep(0);

  // where each source document starts, scattered around the desk
  const scatter = [
    { x: 300, y: -250, z: 160, r: -24 }, { x: 520, y: -60, z: 60, r: 18 }, { x: 180, y: -90, z: 240, r: 9 },
    { x: 620, y: -280, z: -40, r: -12 }, { x: 420, y: 40, z: 300, r: 30 }, { x: 60, y: -300, z: 90, r: -6 },
  ];
  const spread = Math.min(1, section.querySelector(".walk-stage").clientWidth / 760);

  const timeline = gsap.timeline({
    defaults: { ease: "power2.inOut" },
    scrollTrigger: { trigger: section, start: "top top", end: "+=2800", pin: true, scrub: 0.6 },
    // follow the animation itself (it eases behind the scroll position), not the raw scroll
    onUpdate: () => {
      const time = timeline.time();
      setStep(time < 1.1 ? 0 : time < 2.25 ? 1 : time < 3.6 ? 2 : 3);
    },
  });

  timeline
    .fromTo(desk, { rotationX: 20, rotationY: -26 }, { rotationX: 8, rotationY: -8, duration: 4.4, ease: "none" }, 0)
    // 1 → 2: documents gather into a stack, the prepared return rises
    .from(docs, {
      x: (index) => scatter[index].x * spread, y: (index) => scatter[index].y * spread, z: (index) => scatter[index].z,
      rotation: (index) => scatter[index].r, rotationY: (index) => scatter[index].r * 1.5,
      duration: 1, stagger: 0.05,
    }, 0.5)
    .from(sheet, { y: 180, z: -220, rotationX: -35, opacity: 0, duration: 0.9 }, 0.9)
    .from(bars, { scaleX: 0, transformOrigin: "left center", duration: 0.4, stagger: 0.06 }, 1.6)
    // 2 → 3: review flags appear, notes slide in, flags resolve
    .from(flags, { scale: 0, duration: 0.3, stagger: 0.14, ease: "back.out(3)" }, 2.3)
    .from(notes, { x: 140, z: 200, opacity: 0, duration: 0.6 }, 2.4)
    .fromTo(flags, { backgroundColor: "#e8694d" }, { backgroundColor: "#6fbf9a", duration: 0.3, stagger: 0.14 }, 3.1)
    // 3 → 4: the firm's sign-off lands
    .from(stamp, { scale: 2.6, opacity: 0, rotation: 24, duration: 0.45, ease: "power4.in" }, 3.7)
    .to({}, { duration: 0.4 });

  // If the browser is not rendering frames, show the finished state instead
  const startFrame = gsap.ticker.frame;
  setTimeout(() => {
    if (gsap.ticker.frame - startFrame > 3) return;
    timeline.scrollTrigger?.kill(true);
    timeline.kill();
    gsap.set([desk, ...docs, ...bars, ...flags, ...sheet, ...notes, ...stamp], { clearProps: "transform,opacity,backgroundColor" });
    section.classList.remove("walk-live");
  }, 2000);
}
