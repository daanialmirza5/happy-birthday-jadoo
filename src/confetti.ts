// Tiny canvas confetti: one shared canvas, runs only while particles are alive.

const COLORS = ['#f4a98a', '#e0707f', '#f7b6c0', '#c79a4b', '#e4c07a', '#a993dc', '#e7def9', '#ffd9c7'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  shape: 'rect' | 'circle' | 'heart';
  life: number;
  wobble: number;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let running = false;
let dpr = 1;

function ensureCanvas(): void {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize(): void {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}

function spawn(x: number, y: number, angle: number, spread: number, speed: number): Particle {
  const a = angle + (Math.random() - 0.5) * spread;
  const v = speed * (0.55 + Math.random() * 0.6);
  const r = Math.random();
  return {
    x,
    y,
    vx: Math.cos(a) * v,
    vy: Math.sin(a) * v,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 6,
    h: 4 + Math.random() * 5,
    color: COLORS[(Math.random() * COLORS.length) | 0],
    shape: r < 0.6 ? 'rect' : r < 0.85 ? 'circle' : 'heart',
    life: 0,
    wobble: Math.random() * 10,
  };
}

/** mode 'center' pops from the middle; 'sides' fires two cannons from the bottom corners. */
export function burst(mode: 'center' | 'sides' = 'center'): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  ensureCanvas();
  const W = window.innerWidth;
  const H = window.innerHeight;
  const scale = Math.min(1, W / 900) * 0.5 + 0.5;
  if (mode === 'center') {
    for (let i = 0; i < 130; i++) particles.push(spawn(W / 2, H * 0.55, -Math.PI / 2, Math.PI * 1.2, 15 * scale));
  } else {
    for (let i = 0; i < 80; i++) particles.push(spawn(0, H * 0.9, -Math.PI / 3, 0.7, 19 * scale));
    for (let i = 0; i < 80; i++) particles.push(spawn(W, H * 0.9, (-2 * Math.PI) / 3, 0.7, 19 * scale));
  }
  if (!running) {
    running = true;
    requestAnimationFrame(frame);
  }
}

function drawHeart(c: CanvasRenderingContext2D, s: number): void {
  c.beginPath();
  c.moveTo(0, s * 0.3);
  c.bezierCurveTo(-s, -s * 0.4, -s * 0.5, -s * 1.1, 0, -s * 0.45);
  c.bezierCurveTo(s * 0.5, -s * 1.1, s, -s * 0.4, 0, s * 0.3);
  c.fill();
}

function frame(): void {
  if (!ctx || !canvas) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  const H = window.innerHeight;
  particles = particles.filter((p) => p.life < 320 && p.y < H + 40);
  for (const p of particles) {
    p.life++;
    p.vy += 0.32;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.x += p.vx + Math.sin((p.life + p.wobble) / 9) * 0.6;
    p.y += p.vy;
    p.rot += p.vr;
    const fade = p.life > 240 ? 1 - (p.life - 240) / 80 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === 'rect') {
      ctx.scale(1, Math.cos(p.life / 6 + p.wobble));
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    } else if (p.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, p.h / 2 + 1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      drawHeart(ctx, p.w * 0.8);
    }
    ctx.restore();
  }
  if (particles.length) requestAnimationFrame(frame);
  else {
    running = false;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}
