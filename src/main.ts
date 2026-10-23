import './style.css';
import { BirthdayMusic } from './music';
import { burst } from './confetti';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, reduceMotion ? 0 : ms));

const intro = $('intro');
const openBtn = $<HTMLButtonElement>('open-btn');
const stage = $('envelope-stage');
const envelope = stage.querySelector('.envelope') as HTMLElement;
const letter = $('letter');
const finale = $('finale');
const againBtn = $<HTMLButtonElement>('again-btn');
const toggle = $<HTMLButtonElement>('music-toggle');
const progressBar = $('progress').firstElementChild as HTMLElement;

// ---------- Floating hearts, sparkles and stars ----------
const SHAPES = {
  heart:
    '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.1 0 3.6 1.1 5.4 3.1 1.8-2 3.3-3.1 5.4-3.1 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l1.9 7.1L21 12l-7.1 1.9L12 22l-1.9-8.1L3 12l7.1-2.9z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/></svg>',
};
const FLOAT_COLORS = ['#f7b6c0', '#e98a8f', '#e4c07a', '#c9b6ee', '#f4a98a'];

function makeFloaters(): void {
  if (reduceMotion) return;
  const host = $('floaters');
  const count = window.innerWidth < 600 ? 14 : 22;
  const kinds = Object.keys(SHAPES) as (keyof typeof SHAPES)[];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    const kind = i % 3 === 0 ? 'heart' : kinds[(Math.random() * kinds.length) | 0];
    const size = 10 + Math.random() * (kind === 'heart' ? 16 : 12);
    el.className = 'floater';
    el.innerHTML = SHAPES[kind];
    el.style.cssText = [
      `left:${Math.random() * 100}%`,
      `width:${size}px`,
      `height:${size}px`,
      `color:${FLOAT_COLORS[i % FLOAT_COLORS.length]}`,
      `animation-duration:${14 + Math.random() * 14}s`,
      `animation-delay:${-Math.random() * 24}s`,
      `--dx:${(Math.random() - 0.5) * 120}px`,
      `--rot:${(Math.random() - 0.5) * 160}deg`,
      `--o:${0.35 + Math.random() * 0.4}`,
    ].join(';');
    host.appendChild(el);
  }
}
makeFloaters();

// ---------- Music ----------
const music = new BirthdayMusic();
music.onStateChange = (playing) => {
  toggle.setAttribute('aria-pressed', String(playing));
  toggle.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
  toggle.title = playing ? 'Pause music' : 'Play music';
};
toggle.addEventListener('click', () => music.toggle());

// ---------- Opening the surprise ----------
let opened = false;
openBtn.addEventListener('click', async () => {
  if (opened) return;
  opened = true;
  openBtn.disabled = true;

  // Audio must start synchronously inside the tap for mobile browsers to allow it.
  if (music.supported && music.start()) toggle.hidden = false;

  burst('center');
  intro.classList.add('leaving');
  await wait(750);
  intro.hidden = true;

  if (!reduceMotion) {
    stage.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.add('show')));
    await wait(750);
    envelope.classList.add('open');
    await wait(380);
    envelope.classList.add('flap-back');
    await wait(250);
    envelope.classList.add('rise');
    await wait(1100);
    stage.classList.add('out');
    await wait(450);
    stage.hidden = true;
  }

  document.body.classList.add('opened');
  letter.hidden = false;
  finale.hidden = false;
  window.scrollTo(0, 0);
  requestAnimationFrame(() => requestAnimationFrame(() => letter.classList.add('in')));
  setupReveals();
  onScroll();
});

// ---------- Letter paragraphs fade in as they scroll into view ----------
function setupReveals(): void {
  const items = document.querySelectorAll<HTMLElement>('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.12 },
    );
    items.forEach((el) => io.observe(el));
  }

  let celebrated = false;
  const finaleIO = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        finale.classList.add('show');
        if (!celebrated) {
          celebrated = true;
          setTimeout(() => burst('sides'), 500);
        }
      }
    },
    { threshold: 0.35 },
  );
  finaleIO.observe(finale);
}

// ---------- Reading progress ----------
let ticking = false;
function onScroll(): void {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    progressBar.style.transform = `scaleX(${p})`;
  });
}
window.addEventListener('scroll', onScroll, { passive: true });

// ---------- Read again ----------
againBtn.addEventListener('click', () => {
  letter.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
});
