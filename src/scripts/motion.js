// Smooth scrolling (Lenis) and scroll-driven animation (GSAP + ScrollTrigger).
// Content is visible by default; this script only adds motion on top, and
// removes it again if the browser is not rendering frames.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const all = (selector, scope = document) => gsap.utils.toArray(scope.querySelectorAll(selector));

if (reduceMotion) {
  root.classList.add("ready");
} else {
  // --- Lenis, driven by GSAP's ticker so scroll and animation share one clock
  // Never run two smooth-scrollers at once (a second copy can appear when the dev server live-reloads)
  window.__lenis?.destroy();
  const lenis = new Lenis({ lerp: 0.1, anchors: true });
  window.__lenis = lenis;
  lenis.on("scroll", ScrollTrigger.update);
  const tick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  const animated = [];
  const from = (targets, vars) => {
    if (!targets.length) return;
    animated.push(...targets);
    gsap.from(targets, { ease: "power3.out", duration: 0.9, clearProps: "transform,opacity", ...vars });
  };

  // --- Hero: staggered entrance, then the outlined page number drifts as you scroll
  from(all(".hero .eyebrow, .hero h1, .hero .lede, .hero .hero-meta, .hero .actions, .hero .tiles"), {
    y: 32, opacity: 0, stagger: 0.09, delay: 0.05,
  });
  from(all(".hero .portrait"), { x: 40, opacity: 0, duration: 1.2, delay: 0.15 });
  root.classList.add("ready");

  all(".hero[data-no]").forEach((hero) => {
    gsap.to(hero, {
      "--shift": "140px", ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
    });
  });

  // --- Sections: groups stagger in item by item, single blocks rise as one
  const groups = ".tiles, .plates, .seals, .structure, .flow, .who, .lanes, .journey, .proof-row";
  all(".reveal, .proof-row, .band").forEach((el) => {
    const trigger = { trigger: el, start: "top 86%", once: true };
    if (el.matches(".vmap")) {
      // nodes are positioned with CSS transforms, so only fade them
      from(all(".vmap-lines, .vmap-core, .vnode", el), { opacity: 0, stagger: 0.12, duration: 0.7, scrollTrigger: trigger });
    } else if (el.matches(".band")) {
      from([el], { x: -28, opacity: 0, scrollTrigger: trigger });
    } else if (el.matches(groups)) {
      from(Array.from(el.children), { y: 30, opacity: 0, stagger: 0.07, scrollTrigger: trigger });
    } else {
      from([el], { y: 30, opacity: 0, scrollTrigger: trigger });
    }
  });

  // --- Journey line draws itself with the scroll position
  all(".journey").forEach((journey) => {
    gsap.fromTo(journey, { "--draw": 0 }, {
      "--draw": 1, ease: "none",
      scrollTrigger: { trigger: journey, start: "top 78%", end: "top 30%", scrub: 0.6 },
    });
  });

  // --- Safety net: if no frames are being rendered (throttled or background
  // page), drop all motion so nothing is left hidden mid-animation.
  const startFrame = gsap.ticker.frame;
  setTimeout(() => {
    if (gsap.ticker.frame - startFrame > 3) return;
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    gsap.killTweensOf(animated);
    gsap.set(animated, { clearProps: "transform,opacity" });
    all(".journey").forEach((journey) => journey.style.removeProperty("--draw"));
    all(".hero").forEach((hero) => hero.style.removeProperty("--shift"));
    gsap.ticker.remove(tick);
    lenis.destroy();
  }, 2000);
}
