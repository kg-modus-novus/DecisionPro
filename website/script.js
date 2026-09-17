/* DecisionPro marketing fork — progressive enhancement only.
   The page is fully readable without JavaScript. */
(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- sticky header state ---------- */
  const head = document.querySelector('[data-head]');
  const onScroll = () => head && head.classList.toggle('scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- scroll reveals ---------- */
  const revealItems = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('revealed'));
  }

  /* ---------- animated counters ---------- */
  const counters = document.querySelectorAll('[data-count]');
  const runCounter = (el) => {
    const target = Number(el.dataset.count || '0');
    const duration = 1400;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased).toLocaleString('en-US');
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ('IntersectionObserver' in window && !reducedMotion) {
    const counterObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            runCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.4 }
    );
    counters.forEach((el) => counterObserver.observe(el));
  } else {
    counters.forEach((el) => {
      el.textContent = Number(el.dataset.count || '0').toLocaleString('en-US');
    });
  }

  /* ---------- hero briefing rotator ---------- */
  const rotatorText = document.querySelector('[data-rotator-text]');
  const dotsHost = document.querySelector('[data-rotator-dots]');
  const briefingSamples = [
    '17 organizations funded through 4 federal awards that end within a year stand to lose $29.2M in pass-through funding unless those awards are renewed or replaced.',
    '17 chains run 66% of Kentucky’s nursing facilities; the largest, SIGNATURE HEALTHCARE, has 16 of its 38 rated facilities at 1–2 stars.',
    'United Healthcare Community Plan reports 63% of the overpayments Kentucky’s MCO contract plans identified while serving 6% of members. Is it counting the same way as the other 5?',
    'In 20 Kentucky counties every hospital or nursing facility that files a cost report is losing money; 15 of those counties have just one facility, together serving 60,778 Medicaid members.',
  ];
  if (rotatorText && dotsHost && !reducedMotion) {
    let index = 0;
    const dots = briefingSamples.map(() => {
      const dot = document.createElement('i');
      dotsHost.appendChild(dot);
      return dot;
    });
    const paint = () => {
      rotatorText.textContent = briefingSamples[index];
      dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    };
    paint();
    window.setInterval(() => {
      rotatorText.classList.add('fading');
      window.setTimeout(() => {
        index = (index + 1) % briefingSamples.length;
        paint();
        rotatorText.classList.remove('fading');
      }, 460);
    }, 6500);
  }

  /* ---------- KY / FL briefing toggle ---------- */
  const toggle = document.querySelector('[data-state-toggle]');
  if (toggle) {
    const buttons = toggle.querySelectorAll('[data-state-btn]');
    const lists = document.querySelectorAll('[data-state-list]');
    const activate = (state) => {
      toggle.dataset.active = state;
      buttons.forEach((btn) =>
        btn.setAttribute('aria-selected', btn.dataset.stateBtn === state ? 'true' : 'false')
      );
      lists.forEach((list) => {
        list.hidden = list.dataset.stateList !== state;
      });
    };
    buttons.forEach((btn) =>
      btn.addEventListener('click', () => activate(btn.dataset.stateBtn))
    );
    activate('KY');
  }

  /* ---------- hero constellation canvas ---------- */
  const canvas = document.querySelector('[data-constellation]');
  if (canvas && !reducedMotion) {
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let nodes = [];
    let raf = 0;
    const mouse = { x: -9999, y: -9999 };
    const DPR = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * DPR);
      canvas.height = Math.round(height * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const count = Math.min(110, Math.max(45, Math.round((width * height) / 16000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1 + Math.random() * 1.8,
      }));
    };

    const LINK = 130;
    const step = () => {
      ctx.clearRect(0, 0, width, height);
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;
        const dx = n.x - mouse.x;
        const dy = n.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 140 && dist > 0.01) {
          n.x += (dx / dist) * 0.35;
          n.y += (dy / dist) * 0.35;
        }
      }
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK) {
            const alpha = (1 - d / LINK) * 0.28;
            ctx.strokeStyle = `rgba(125, 216, 255, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        ctx.fillStyle = 'rgba(111, 240, 200, 0.75)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(step);
    };

    resize();
    step();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        step();
      }
    });
  }
})();
