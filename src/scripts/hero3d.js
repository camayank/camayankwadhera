// 3D hero: scattered tiles assemble into three ordered ledger sheets ("rules, made usable").
// They assemble on load and drift apart again as the hero scrolls away.
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const COLS = 6, ROWS = 8, LAYERS = 3;
const COUNT = COLS * ROWS * LAYERS;

export function mount(host) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return; // no WebGL: the static placeholder stays
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  host.classList.add("live");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  camera.position.set(0, 0, 14);
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(4, 6, 8);
  scene.add(key);

  const group = new THREE.Group();
  scene.add(group);
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.62, 0.36, 0.07),
    new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05 }),
    COUNT,
  );
  group.add(mesh);

  // Each tile has a scattered pose and an ordered pose
  const paper = new THREE.Color("#f1f5f9"), header = new THREE.Color("#6ee7b7"), accent = new THREE.Color("#10b981");
  const ordered = [], scattered = [], spin = [], delay = [];
  let i = 0;
  for (let layer = 0; layer < LAYERS; layer++) {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++, i++) {
        ordered.push(new THREE.Vector3((col - (COLS - 1) / 2) * 0.74, ((ROWS - 1) / 2 - row) * 0.48, (layer - 1) * 1.5));
        const direction = new THREE.Vector3().randomDirection();
        scattered.push(direction.multiplyScalar(2.6 + Math.random() * 3.6));
        spin.push(new THREE.Quaternion().random());
        delay.push(Math.random());
        mesh.setColorAt(i, row === 0 ? header : Math.random() < 0.07 ? accent : paper);
      }
    }
  }

  const state = { assemble: 0, scatter: 0 };
  const dummy = new THREE.Object3D();
  const upright = new THREE.Quaternion();
  let lastProgress = -1;
  function layout() {
    const progress = state.assemble * (1 - state.scatter * 0.85);
    if (progress === lastProgress) return;
    lastProgress = progress;
    for (let n = 0; n < COUNT; n++) {
      // staggered: each tile starts and finishes at a slightly different moment
      const local = THREE.MathUtils.clamp(progress * 1.5 - delay[n] * 0.5, 0, 1);
      const eased = local * local * (3 - 2 * local);
      dummy.position.lerpVectors(scattered[n], ordered[n], eased);
      dummy.quaternion.slerpQuaternions(spin[n], upright, eased);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  const pointer = { x: 0, y: 0 };
  window.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX / window.innerWidth - 0.5;
    pointer.y = event.clientY / window.innerHeight - 0.5;
  });

  function render(time = 0) {
    layout();
    const targetY = 0.55 + Math.sin(time * 0.35) * 0.14 + pointer.x * 0.5;
    const targetX = -0.22 + Math.cos(time * 0.28) * 0.05 + pointer.y * 0.3;
    group.rotation.y += (targetY - group.rotation.y) * 0.06;
    group.rotation.x += (targetX - group.rotation.x) * 0.06;
    renderer.render(scene, camera);
  }

  new ResizeObserver(() => {
    const { clientWidth: width, clientHeight: height } = host;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  }).observe(host);

  group.rotation.set(-0.22, 0.55, 0);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    state.assemble = 1; // one still frame of the ordered sheets
    render();
    return;
  }

  // Only draw frames while the hero is on screen
  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(host);
  gsap.ticker.add((time) => { if (visible) render(time); });

  gsap.to(state, { assemble: 1, duration: 2.8, ease: "power2.inOut", delay: 0.5 });
  gsap.to(state, {
    scatter: 1, ease: "none",
    scrollTrigger: { trigger: host.closest(".hero"), start: "top top", end: "bottom 20%", scrub: 0.8 },
  });
}
