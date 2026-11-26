const characterImage = 'img/Bleach (side).png';
document.querySelectorAll('.profile').forEach(profileImage => {
  profileImage.src = characterImage;
});

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

/* ---------- Navigation (sections now scroll; nav scrolls to them) ---------- */

function showSection(section) {
  const target = document.getElementById(section);
  if (!target) return;
  target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
}

const navItems = document.querySelectorAll('nav li[data-section]');
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s === entry.target));
    navItems.forEach(li => li.classList.toggle('active', li.dataset.section === entry.target.id));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('.section').forEach(s => sectionObserver.observe(s));

/* ---------- Home -> About scroll transition ---------- */

const homeSection = document.getElementById('home');
const zoomSections = ['about', 'designs', 'contacts'].map(id => document.getElementById(id)).filter(Boolean);
let homeTick = false;

// Zoom-in transitions (Home -> About, About -> Pixelverse): the incoming section
// scales up from slightly smaller, fades in and settles as it reaches the top.
function updateZoomTransitions() {
  const vh = window.innerHeight;
  zoomSections.forEach(section => {
    const top = section.offsetTop - window.scrollY;
    const p = Math.min(1, Math.max(0, 1 - top / vh));
    if (p >= 1 || prefersReducedMotion) {
      section.style.transform = '';
      section.style.opacity = '';
      return;
    }
    const e = 1 - Math.pow(1 - p, 3);
    section.style.transform = `translate3d(0, ${((1 - e) * 50).toFixed(1)}px, 0) scale(${(0.86 + 0.14 * e).toFixed(4)})`;
    section.style.opacity = (0.2 + 0.8 * e).toFixed(3);
  });
}

function updateHomeScroll() {
  homeTick = false;
  const progress = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.9)));
  homeSection.style.setProperty('--hp', progress.toFixed(3));
  updateZoomTransitions();
}
window.addEventListener('resize', updateZoomTransitions);
updateZoomTransitions();
window.addEventListener('scroll', () => {
  if (!homeTick) {
    homeTick = true;
    requestAnimationFrame(updateHomeScroll);
  }
}, { passive: true });

/* ---------- Scroll-triggered reveals ---------- */

const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.18 });
document.querySelectorAll('.reveal, .tools-pop').forEach(el => revealObserver.observe(el));

/* ---------- Socials / contact options ---------- */

const socialToggles = document.querySelectorAll('.social-toggle');
socialToggles.forEach(toggle => {
  toggle.addEventListener('click', () => {
    const container = toggle.closest('.socials');
    if (!container) return;
    const isOpen = container.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen.toString());
  });
});

const gmailAddress = document.querySelector('.gmail-address');
if (gmailAddress) {
  gmailAddress.addEventListener('click', () => openBizcard());
}

/* ---------- Resume modal ---------- */

const resumeToggle = document.querySelector('.resume-toggle');
const resumeModal = document.getElementById('resume-modal');

function openResume() {
  if (!resumeModal) return;
  resumeModal.classList.add('open');
  resumeModal.setAttribute('aria-hidden', 'false');
  if (resumeToggle) resumeToggle.setAttribute('aria-expanded', 'true');
  document.documentElement.classList.add('modal-open');
  const closeButton = resumeModal.querySelector('.resume-close');
  if (closeButton) closeButton.focus({ preventScroll: true });
}

function closeResume() {
  if (!resumeModal || !resumeModal.classList.contains('open')) return;
  resumeModal.classList.remove('open');
  resumeModal.setAttribute('aria-hidden', 'true');
  if (resumeToggle) {
    resumeToggle.setAttribute('aria-expanded', 'false');
    resumeToggle.focus({ preventScroll: true });
  }
  document.documentElement.classList.remove('modal-open');
}

if (resumeToggle && resumeModal) {
  resumeToggle.addEventListener('click', openResume);
  resumeModal.querySelectorAll('[data-close-resume]').forEach(el => el.addEventListener('click', closeResume));
}

/* ---------- Marquee: duplicate cards for a seamless loop ---------- */

document.querySelectorAll('.marquee-track').forEach(track => {
  Array.from(track.children).forEach(card => {
    const clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  });
});

/* ---------- Hanging student ID: lanyard physics, drag, swing, flip ---------- */

function initIdCard() {
  const home = document.getElementById('home');
  const zone = document.querySelector('.id-card-zone');
  const card = zone && zone.querySelector('.id-card');
  const svg = document.querySelector('.lanyard');
  if (!home || !zone || !card || !svg) return;
  const strap = svg.querySelector('.lanyard-strap');
  const stripe = svg.querySelector('.lanyard-stripe');

  const GRAVITY = 2600;            // px/s²
  const STEP = 1 / 120;            // fixed physics step
  const pos = { x: 0, y: 0 }, prev = { x: 0, y: 0 };
  const anchor = { x: 0, y: -10 };
  let L = 200, zoneW = 230;
  let angle = 0, angVel = 0;
  let dragging = false, moved = 0, pointerId = null;
  const grab = { x: 0, y: 0 }, pointer = { x: 0, y: 0 };
  let hoverRx = 0, hoverRy = 0;
  let dropped = false, raf = 0, last = 0, acc = 0;

  function measure() {
    const W = home.clientWidth, H = home.clientHeight;
    zoneW = zone.offsetWidth;
    const mobile = W < 720;
    anchor.x = mobile ? Math.max(zoneW / 2 + 14, W * 0.26) : Math.max(zoneW / 2 + 24, W * 0.17);
    L = Math.max(110, Math.min(260, H * (mobile ? 0.14 : 0.24)));
  }

  function toLocal(event) {
    const r = home.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }

  function step(dt) {
    if (dragging) {
      prev.x = pos.x; prev.y = pos.y;
      pos.x += (pointer.x - grab.x - pos.x) * 0.5;
      pos.y += (pointer.y - grab.y - pos.y) * 0.5;
    } else {
      let vx = (pos.x - prev.x) * 0.996, vy = (pos.y - prev.y) * 0.996;
      const speed = Math.hypot(vx, vy);
      if (speed > 40) { vx *= 40 / speed; vy *= 40 / speed; }
      prev.x = pos.x; prev.y = pos.y;
      pos.x += vx;
      pos.y += vy + GRAVITY * dt * dt;
    }
    // inextensible lanyard (slack allowed, slight give while pulled)
    const dx = pos.x - anchor.x, dy = pos.y - anchor.y;
    const d = Math.hypot(dx, dy) || 1;
    const maxL = dragging ? L * 1.06 : L;
    if (d > maxL) {
      pos.x = anchor.x + dx / d * maxL;
      pos.y = anchor.y + dy / d * maxL;
    }
    // the card swings on its clip with a little rotational lag
    const ropeAngle = Math.atan2(pos.x - anchor.x, pos.y - anchor.y);
    const taut = d > L * 0.97 ? 1 : 0.5;
    angVel += ((-ropeAngle * taut - angle) * 90 - angVel * 7) * dt;
    angle += angVel * dt;
  }

  function render() {
    const vx = (pos.x - prev.x) / STEP, vy = (pos.y - prev.y) / STEP;
    const ry = hoverRy + Math.max(-22, Math.min(22, vx * 0.025));
    const rx = hoverRx + Math.max(-14, Math.min(14, -vy * 0.015));
    zone.style.transform = `translate3d(${(pos.x - zoneW / 2).toFixed(2)}px, ${pos.y.toFixed(2)}px, 0) rotate(${angle.toFixed(4)}rad)`;
    card.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
    card.style.setProperty('--ry', `${ry.toFixed(2)}deg`);

    // lanyard strap from above the screen down to the clip, sagging when slack
    const top = { x: anchor.x, y: -60 };
    const d = Math.hypot(pos.x - anchor.x, pos.y - anchor.y);
    const sag = Math.max(0, L - d) * 0.7;
    const mx = (top.x + pos.x) / 2, my = (top.y + pos.y) / 2 + sag;
    const path = `M ${top.x.toFixed(1)} ${top.y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${pos.x.toFixed(1)} ${(pos.y + zoneW * 0.04).toFixed(1)}`;
    strap.setAttribute('d', path);
    stripe.setAttribute('d', path);
  }

  function drop() {
    dropped = true;
    measure();
    // enter from above the screen: falls until the lanyard catches it, then swings
    pos.x = anchor.x + L * 0.45;
    pos.y = -card.offsetHeight - 80;
    prev.x = pos.x + 2; prev.y = pos.y - 2;
    angle = -0.35; angVel = 0;
    zone.classList.add('is-hanging');
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!dropped) {
      if (document.documentElement.classList.contains('intro-running')) return;
      drop();
    }
    const dt = Math.min(0.05, last ? (now - last) / 1000 : STEP);
    last = now;
    acc += dt;
    while (acc >= STEP) { step(STEP); acc -= STEP; }
    render();
  }

  function flip() {
    const flipped = card.classList.toggle('flipped');
    card.setAttribute('aria-pressed', flipped.toString());
  }

  card.addEventListener('pointerdown', event => {
    if (!dropped) return;
    dragging = true;
    moved = 0;
    pointerId = event.pointerId;
    card.setPointerCapture(event.pointerId);
    const p = toLocal(event);
    pointer.x = p.x; pointer.y = p.y;
    grab.x = p.x - pos.x; grab.y = p.y - pos.y;
    zone.classList.add('is-dragging');
  });
  card.addEventListener('pointermove', event => {
    const p = toLocal(event);
    if (dragging && event.pointerId === pointerId) {
      moved += Math.hypot(p.x - pointer.x, p.y - pointer.y);
      pointer.x = p.x; pointer.y = p.y;
      return;
    }
    const r = card.getBoundingClientRect();
    const px = (event.clientX - r.left) / r.width;
    const py = (event.clientY - r.top) / r.height;
    hoverRy = (px - 0.5) * 18;
    hoverRx = (0.5 - py) * 14;
    card.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
    card.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
  });
  const release = event => {
    if (!dragging || event.pointerId !== pointerId) return;
    dragging = false;
    zone.classList.remove('is-dragging');
    if (moved < 6) flip();
  };
  card.addEventListener('pointerup', release);
  card.addEventListener('pointercancel', release);
  card.addEventListener('pointerleave', () => { hoverRx = 0; hoverRy = 0; });
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      flip();
    }
  });

  measure();
  window.addEventListener('resize', measure);
  new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      } else if (!entry.isIntersecting && raf && dropped) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
  }).observe(home);
}
initIdCard();

/* ---------- Designs data + lightbox ---------- */
/* The collection comes from designs.js (loadPixelverse): the same list the Design
   Gallery page uses, so both always show the same designs. */

let pixelverseDesigns = designItems;
const escapeHtml = text => String(text == null ? '' : text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const designMeta = design => [design.category, design.details].filter(Boolean).join(' · ');


function openLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
}

function openDesignLibrary() {
  renderDesignLibrary();
  openLightbox();
}

function openDesign(index) {
  renderDesignLibrary();
  openDesignDetail(index);
  openLightbox();
}

function renderDesignLibrary() {
  const lightbox = document.getElementById('lightbox');
  const grid = lightbox && lightbox.querySelector('.design-library-grid');
  if (!grid) return;
  grid.innerHTML = '';
  pixelverseDesigns.forEach((design, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'design-library-item';
    const img = document.createElement('img');
    img.alt = design.title;
    img.loading = 'lazy';
    img.decoding = 'async';
    setPixelverseImage(img, design, 'thumb');
    const label = document.createElement('span');
    label.textContent = design.title;
    button.append(img, label);
    button.addEventListener('click', () => openDesignDetail(index));
    grid.appendChild(button);
  });
  lightbox.querySelector('.design-library-view').hidden = false;
  const detail = lightbox.querySelector('.design-detail-view');
  detail.innerHTML = '';
  detail.hidden = true;
}

function openDesignDetail(index) {
  const lightbox = document.getElementById('lightbox');
  const detail = lightbox && lightbox.querySelector('.design-detail-view');
  const design = pixelverseDesigns[index];
  if (!detail || !design) return;
  detail.innerHTML = `<button type="button" class="back-to-designs">← All designs</button><div class="design-detail-media"><img alt="${escapeHtml(design.title)}"></div><div class="design-detail-copy"><span class="viewer-kicker">${escapeHtml(design.category || 'DESIGN DETAIL')}</span><h2>${escapeHtml(design.title)}</h2>${design.description ? `<p>${escapeHtml(design.description)}</p>` : ''}<span class="design-meta">${escapeHtml(designMeta(design))}</span></div>`;
  setPixelverseImage(detail.querySelector('.design-detail-media img'), design, 'full');
  detail.querySelector('.back-to-designs').addEventListener('click', renderDesignLibrary);
  lightbox.querySelector('.design-library-view').hidden = true;
  detail.hidden = false;
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
}

const viewAllDesigns = document.querySelector('.pixelverse-all');
if (viewAllDesigns) viewAllDesigns.addEventListener('click', () => leaveTo('gallery.html'));

/* page-to-page transition: fade the page out, then navigate */
function leaveTo(url) {
  if (prefersReducedMotion) { window.location.href = url; return; }
  document.documentElement.classList.add('page-leaving');
  setTimeout(() => { window.location.href = url; }, 420);
}
// coming back with the browser's back button: undo the fade
window.addEventListener('pageshow', () => document.documentElement.classList.remove('page-leaving'));

/* ---------- Shared: curved-strip 3D carousel geometry ---------- */
/* Cards sit side by side on the inside of a gently flattened cylinder: the centre card
   faces the viewer straight on, and the cards beside it turn inward with their outer
   edges closer to the viewer, forming one continuous curved strip with thin gaps. */
const CURVE_STEP = 0.62;    // angle between neighbouring cards (radians)
const CURVE_FLATTEN = 0.6;  // 1 = true cylinder, lower = shallower curve

function curveRadius(cardW, gap) {
  return (cardW + gap) / CURVE_STEP;
}

function curveTransform(off, radius, cardW = 0, stretch = 1) {
  const t = Math.max(-1.5, Math.min(1.5, off * CURVE_STEP));
  let x = radius * Math.sin(t);
  let z = CURVE_FLATTEN * radius * (1 - Math.cos(t));               // sides come toward the viewer
  const rotRad = -Math.atan(CURVE_FLATTEN * Math.tan(t));            // follow the curve
  if (stretch !== 1 && cardW) {
    // the widened card grows outward along its own surface, away from its neighbour
    const shift = Math.sign(off) * (stretch - 1) * cardW / 2;
    x += shift * Math.cos(rotRad);
    z -= shift * Math.sin(rotRad);
  }
  const sx = stretch !== 1 ? ` scaleX(${stretch.toFixed(3)})` : '';
  return `translate3d(${x.toFixed(1)}px, 0, ${z.toFixed(1)}px) rotateY(${(rotRad * 180 / Math.PI).toFixed(2)}deg)${sx}`;
}

/* ---------- Pixelverse: 3D carousel ---------- */
/* The designs sit on a 3D ring. The active design faces the viewer at full size; the
   others recede around the ring. Navigate with the arrows, drag/swipe, the keyboard
   (Left/Right when focused) or by clicking a side design; it also advances on its own
   every few seconds while nobody is interacting. Click the front design to open it. */

function initPixelverse(designs) {
  const stage = document.querySelector('.carousel-stage');
  if (!stage || !designs.length) return;
  const ring = stage.querySelector('.carousel-ring');
  const caption = document.querySelector('.carousel-caption');
  const prevBtn = document.querySelector('.carousel-prev');
  const nextBtn = document.querySelector('.carousel-next');
  const count = designs.length;

  let pos = 0;      // current (animated) position, in items
  let target = 0;   // where pos is heading
  let dragMoved = false;

  let flipped = null; // the design currently showing its back
  function setFlip(item, on) {
    item.classList.toggle('is-flipped', on);
    item.setAttribute('aria-pressed', on ? 'true' : 'false');
    const back = item.querySelector('.carousel-back');
    back.setAttribute('aria-hidden', on ? 'false' : 'true');
    item.querySelector('.carousel-open').tabIndex = on ? 0 : -1;
    flipped = on ? item : (flipped === item ? null : flipped);
  }
  function unflipAll() { if (flipped) setFlip(flipped, false); }

  const nodes = designs.map((design, index) => {
    const item = document.createElement('div');
    item.className = 'carousel-item';
    item.setAttribute('role', 'button');
    item.setAttribute('aria-pressed', 'false');
    item.setAttribute('aria-label', `${design.title}: flip for details`);
    item.innerHTML =
      `<span class="carousel-flip">` +
        `<span class="carousel-card carousel-front"><img alt="" loading="lazy" decoding="async" draggable="false"></span>` +
        `<span class="carousel-card carousel-back" aria-hidden="true">` +
          `<span class="viewer-kicker">${escapeHtml(design.category || 'PIXELVERSE')}</span>` +
          `<strong class="carousel-back-title">${escapeHtml(design.title)}</strong>` +
          (design.description ? `<span class="carousel-back-desc">${escapeHtml(design.description)}</span>` : '') +
          (design.details ? `<span class="carousel-back-meta">${escapeHtml(design.details)}</span>` : '') +
          `<button type="button" class="carousel-open" tabindex="-1">View full design</button>` +
        `</span>` +
      `</span>`;
    setPixelverseImage(item.querySelector('.carousel-front img'), design, 'thumb');
    item.addEventListener('click', event => {
      if (dragMoved) return;
      if (event.target.closest('.carousel-open')) { openDesign(index); return; }
      const offset = wrapOffset(index - target);
      if (Math.abs(offset) < 0.5) {
        const on = !item.classList.contains('is-flipped');
        if (on) unflipAll();
        setFlip(item, on);
      } else {
        goTo(target + offset);
      }
    });
    item.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('.carousel-open')) {
        event.preventDefault();
        item.click();
      }
    });
    ring.appendChild(item);
    return item;
  });

  const wrapOffset = d => { d = ((d % count) + count) % count; return d > count / 2 ? d - count : d; };
  const activeIndex = () => ((Math.round(target) % count) + count) % count;

  let size = 220, radius = 360;
  function measure() {
    const w = stage.clientWidth;
    size = w < 600 ? Math.min(250, w * 0.62) : w < 900 ? 290 : 340;
    radius = curveRadius(size, size * 0.05);
    stage.style.setProperty('--item', `${size}px`);
    stage.style.perspective = `${Math.round(radius * 3)}px`;
    render(true);
  }

  let lastPos = null;
  function render(force) {
    if (!force && lastPos !== null && Math.abs(pos - lastPos) < 0.0005) return;
    lastPos = pos;
    nodes.forEach((node, i) => {
      const off = wrapOffset(i - pos);
      const a = Math.abs(off);
      const near = Math.max(0, 1 - a); // 1 at the front
      const fade = a < 1.9 ? 1 : Math.max(0, 1 - (a - 1.9) / 0.5);
      // the two outermost designs are stretched wider than the rest
      const stretch = 1 + 0.42 * Math.min(1, Math.max(0, a - 1));
      node.style.transform = curveTransform(off, radius, size, stretch);
      node.style.zIndex = String(100 - Math.round(a * 10));
      node.style.opacity = fade.toFixed(3);
      node.style.pointerEvents = fade < 0.3 ? 'none' : 'auto';
      node.style.filter = near > 0.98 ? 'none' : `brightness(${(0.84 + 0.16 * near).toFixed(3)})`;
      node.classList.toggle('is-active', Math.abs(off) < 0.5);
      node.tabIndex = Math.abs(off) < 0.5 ? 0 : -1;
    });
  }

  function updateCaption() {
    if (caption) caption.textContent = designs[activeIndex()].title;
  }

  // animation: critically-damped approach toward the target; idle when settled
  let raf = 0, last = 0, visible = false, dragging = false;
  function frame(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    if (!dragging) pos += (target - pos) * (1 - Math.exp(-dt * (prefersReducedMotion ? 30 : 6.5)));
    if (!dragging && Math.abs(target - pos) < 0.0008) pos = target;
    render(false);
    raf = (dragging || pos !== target) && visible ? requestAnimationFrame(frame) : 0;
  }
  function kick() {
    if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); }
  }
  function goTo(t) {
    if (t !== target) unflipAll();
    target = t;
    updateCaption();
    kick();
    restartAuto();
  }

  // gentle autoplay, paused on hover/focus/drag and while off-screen
  let autoTimer = 0, paused = false;
  function restartAuto() {
    clearInterval(autoTimer);
    if (prefersReducedMotion) return;
    autoTimer = setInterval(() => {
      if (!paused && !flipped && !dragging && visible && !document.hidden) { target += 1; updateCaption(); kick(); }
    }, 4200);
  }
  stage.addEventListener('pointerenter', () => { paused = true; });
  stage.addEventListener('pointerleave', () => { paused = false; });
  stage.addEventListener('focusin', () => { paused = true; });
  stage.addEventListener('focusout', () => { paused = false; });

  if (prevBtn) prevBtn.addEventListener('click', () => goTo(target - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(target + 1));
  stage.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(target - 1); focusActive(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); goTo(target + 1); focusActive(); }
  });
  function focusActive() {
    requestAnimationFrame(() => { const n = nodes[activeIndex()]; n.tabIndex = 0; n.focus({ preventScroll: true }); });
  }

  // drag / swipe: horizontal movement rotates the ring, release snaps to the nearest design
  let startX = 0, startY = 0, startPos = 0, pointerId = null, axis = null;
  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX; startY = event.clientY;
    startPos = pos;
    axis = null;
    dragMoved = false;
  });
  window.addEventListener('pointermove', event => {
    if (event.pointerId !== pointerId) return;
    const dx = event.clientX - startX, dy = event.clientY - startY;
    if (!axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axis === 'y') { pointerId = null; return; } // let vertical swipes scroll the page
      dragging = true;
      dragMoved = true;
      unflipAll();
      stage.classList.add('is-dragging');
    }
    pos = startPos - dx / (size * 1.1);
    kick();
  });
  const endDrag = event => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    if (dragging) {
      dragging = false;
      stage.classList.remove('is-dragging');
      goTo(Math.round(pos));
    }
    setTimeout(() => { dragMoved = false; }, 0);
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  new IntersectionObserver(entries => {
    entries.forEach(entry => {
      visible = entry.isIntersecting;
      if (visible) kick();
    });
  }).observe(stage);

  window.addEventListener('resize', measure);
  measure();
  updateCaption();
  restartAuto();
}
loadPixelverse().then(list => {
  pixelverseDesigns = list;
  initPixelverse(list);
});

/* ---------- Gmail: flippable business card ---------- */

const bizcardModal = document.getElementById('bizcard-modal');
const bizcard = bizcardModal && bizcardModal.querySelector('.bizcard');
let bizcardOpener = null;

function openBizcard() {
  if (!bizcardModal) return;
  bizcardOpener = document.activeElement;
  bizcard.classList.remove('flipped');
  bizcard.setAttribute('aria-pressed', 'false');
  bizcardModal.classList.add('open');
  bizcardModal.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('modal-open');
  bizcard.focus({ preventScroll: true });
}

function closeBizcard() {
  if (!bizcardModal || !bizcardModal.classList.contains('open')) return;
  bizcardModal.classList.remove('open');
  bizcardModal.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('modal-open');
  if (bizcardOpener) bizcardOpener.focus({ preventScroll: true });
}

if (bizcardModal) {
  const flipBizcard = () => {
    const flipped = bizcard.classList.toggle('flipped');
    bizcard.setAttribute('aria-pressed', flipped.toString());
  };
  bizcard.addEventListener('click', event => {
    if (event.target.closest('a')) return; // links on the back stay clickable
    flipBizcard();
  });
  bizcard.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('a')) {
      event.preventDefault();
      flipBizcard();
    }
  });
  bizcardModal.querySelectorAll('[data-close-bizcard]').forEach(el => el.addEventListener('click', closeBizcard));
  const copyButton = bizcardModal.querySelector('[data-copy]');
  if (copyButton) {
    copyButton.addEventListener('click', () => {
      const address = copyButton.dataset.copy;
      const done = () => {
        copyButton.textContent = 'Copied!';
        setTimeout(() => { copyButton.textContent = 'Copy address'; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(address).then(done, () => window.prompt('Copy the email address:', address));
      } else {
        window.prompt('Copy the email address:', address);
      }
    });
  }
}

/* ---------- Contacts: symbiote living on the Let's Connect button ---------- */

function initContactsSymbiote() {
  const section = document.getElementById('contacts');
  if (prefersReducedMotion) return; // respect reduced-motion preferences
  if (!section || !window.Symbiote || !window.Symbiote.supported()) return;
  window.Symbiote.contact({
    section,
    canvas: section.querySelector('.symbiote-canvas'),
    button: section.querySelector('.social-toggle')
  });
}

/* ---------- Intro: glitch name transformation -> VIN -> logo -> zoom into Home ---------- */
/* Darkness -> 프랜시스 빈 glitches in -> reconstructs into フランシス・ヴィン -> reconstructs
   into FRANCIS VIN with smaller layered copies around it -> the letters dissolve one by
   one until only VIN remains -> VIN glitch-reconstructs into the logo -> the logo becomes
   a window onto Home and zooms toward the viewer. */

function startIntro() {
  const intro = document.getElementById('intro');
  const html = document.documentElement;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    html.classList.remove('intro-running');
    if (intro) intro.remove();
    initContactsSymbiote();
  };
  const canvas = intro && intro.querySelector('.intro-pixels');
  const ctx = canvas && canvas.getContext('2d');
  if (!intro || !ctx) { finish(); return; }
  // returning to a section (e.g. from the Design Gallery): go straight there, no intro
  const returnTo = location.hash && document.getElementById(location.hash.slice(1));
  if (returnTo) {
    finish();
    requestAnimationFrame(() => returnTo.scrollIntoView({ block: 'start' }));
    return;
  }
  window.scrollTo(0, 0);

  const names = [
    { text: '프랜시스 빈', font: '"Noto Sans KR", "Malgun Gothic", sans-serif', spacing: 0.16 },
    { text: 'フランシス・ヴィン', font: '"Noto Sans JP", "Yu Gothic", "Hiragino Sans", sans-serif', spacing: 0.1 },
    { text: 'FRANCIS VIN', font: 'Poppins, sans-serif', spacing: 0.32 }
  ];
  const KEEP = [8, 9, 10]; // V, I, N of "FRANCIS VIN"
  // the logo, pre-cut as a white mark on transparency, and the point inside its thickest
  // stroke that the camera flies into (fractions of the image)
  const LOGO_SRC = 'img/My logo mask.png';
  const LOGO_ORIGIN = { x: 0.4993, y: 0.5922 };
  const T = prefersReducedMotion
    ? { kr: [0, 1], toJp: [2, 3], toEn: [4, 5], copies: 1e9, drop: [400, 500], gather: [500, 600], toLogo: [600, 700], zoom: [1500, 2300] }
    : {
      kr: [500, 1300],      // Korean glitches in out of the dark
      toJp: [2300, 3100],   // Korean -> Japanese reconstruction
      toEn: [4000, 4800],   // Japanese -> English reconstruction
      copies: 4500,         // smaller layered copies flicker in around the name
      drop: [6300, 7400],   // letters dissolve one by one until only VIN remains
      gather: [7200, 7900], // VIN draws into the centre
      toLogo: [8100, 8900], // VIN glitch-reconstructs into the logo
      zoom: [9500, 10900]   // the logo becomes a window onto Home and zooms past the viewer
    };

  let W = 0, H = 0, dpr = 1, fontSize = 48, box = null;
  let layers = [], vinLayer = null, logoLayer = null, copies = [], vin = null, logoImg = null;
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const ease = v => { v = clamp01(v); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
  const prog = (e, [a, b]) => clamp01((e - a) / (b - a));
  // deterministic noise per time-slot so glitch frames hold for a few ms instead of strobing
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  function layoutName(n) {
    ctx.font = `600 ${fontSize}px ${n.font}`;
    const gap = fontSize * n.spacing;
    const chars = Array.from(n.text).map(ch => ({ ch, w: ctx.measureText(ch).width }));
    const total = chars.reduce((s, c) => s + c.w, 0) + gap * (chars.length - 1);
    let x = W / 2 - total / 2;
    chars.forEach(c => { c.x = x + c.w / 2; x += c.w + gap; });
    n.chars = chars;
    n.width = total;
  }

  // a layer = white + red + cyan copies of something, drawn into its own box
  function makeLayer(lbox, paint) {
    const make = color => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(lbox.w * dpr));
      c.height = Math.max(1, Math.round(lbox.h * dpr));
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(g, color);
      return c;
    };
    return { box: lbox, white: make('#f4f4f4'), red: make('#ff2a55'), cyan: make('#22e6ff') };
  }

  function textPainter(font, chars) {
    return (g, color) => {
      g.font = `600 ${fontSize}px ${font}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = color;
      chars.forEach(ch => g.fillText(ch.ch, ch.x - box.x, H / 2 - box.y));
    };
  }

  function buildLayers() {
    const pad = Math.round(fontSize * 0.7);
    const widest = Math.max(...names.map(n => n.width));
    box = { x: Math.floor(W / 2 - widest / 2 - pad), y: Math.floor(H / 2 - fontSize), w: Math.ceil(widest + pad * 2), h: Math.ceil(fontSize * 2) };
    layers = names.map(n => makeLayer(box, textPainter(n.font, n.chars)));

    // VIN, centred, with the same letter spacing as the full name
    const en = names[2];
    const gap = fontSize * en.spacing;
    const kept = KEEP.map(k => en.chars[k]);
    const total = kept.reduce((s, c) => s + c.w, 0) + gap * (kept.length - 1);
    let x = W / 2 - total / 2;
    vin = kept.map(c => { const t = { ch: c.ch, from: c.x, x: x + c.w / 2 }; x += c.w + gap; return t; });
    vinLayer = makeLayer(box, textPainter(en.font, vin));

    // the logo, tinted into the same three layers
    if (logoImg) {
      const lh = Math.min(fontSize * 3.4, H * 0.42);
      const lw = lh * (logoImg.naturalWidth / logoImg.naturalHeight);
      const lbox = { x: Math.round(W / 2 - lw / 2), y: Math.round(H / 2 - lh / 2), w: Math.round(lw), h: Math.round(lh) };
      logoLayer = makeLayer(lbox, (g, color) => {
        g.drawImage(logoImg, 0, 0, lbox.w, lbox.h);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = color;
        g.fillRect(0, 0, lbox.w, lbox.h);
        g.globalCompositeOperation = 'source-over';
      });
      logoLayer.origin = { x: lbox.x + lbox.w * LOGO_ORIGIN.x, y: lbox.y + lbox.h * LOGO_ORIGIN.y };
    } else {
      // fallback if the logo image is unavailable: zoom through the stem of the "I"
      logoLayer = vinLayer;
      logoLayer.origin = { x: vin[1].x, y: H / 2 };
    }
  }

  function buildCopies() {
    const en = names[2];
    const left = W / 2 - en.width / 2, right = W / 2 + en.width / 2;
    const fs = fontSize;
    const s1 = Math.max(9, fs * 0.24), s2 = Math.max(8, fs * 0.17);
    copies = [
      { x: left, y: H / 2 - fs * 0.98, size: s1, align: 'left', alpha: 0.6, spacing: 0.5, rot: 0 },
      { x: right, y: H / 2 + fs * 0.98, size: s1, align: 'right', alpha: 0.6, spacing: 0.5, rot: 0 },
      { x: Math.max(s2 + 4, left - fs * 0.7), y: H / 2, size: s2, align: 'center', alpha: 0.32, spacing: 0.6, rot: -Math.PI / 2 },
      { x: Math.min(W - s2 - 4, right + fs * 0.7), y: H / 2, size: s2, align: 'center', alpha: 0.32, spacing: 0.6, rot: Math.PI / 2 },
      { x: W / 2, y: H / 2 - fs * 2.2, size: s2, align: 'center', alpha: 0.22, spacing: 1.1, rot: 0 },
      { x: W / 2, y: H / 2 + fs * 2.2, size: s2, align: 'center', alpha: 0.22, spacing: 1.1, rot: 0 }
    ];
  }

  function build() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    fontSize = Math.max(26, Math.min(72, W * 0.06));
    names.forEach(layoutName);
    const widest = Math.max(...names.map(n => n.width));
    if (widest > W * 0.8) {
      fontSize *= (W * 0.8) / widest;
      names.forEach(layoutName);
    }
    buildLayers();
    buildCopies();
  }

  /* glitched transition between two layers (a may be null = darkness).
     p: 0 shows a, 1 shows b; g: glitch strength. Each horizontal slice flips from a to b
     at its own moment, so the image looks like it is digitally reconstructing itself. */
  function drawGlitch(a, b, p, g, e) {
    const slot = Math.floor(e / 55);
    const slices = 10;
    let alpha = 1;
    if (g > 0.05 && hash(slot + 7) < 0.18 * g) alpha *= 0.3 + 0.5 * hash(slot + 3); // flicker
    const split = fontSize * 0.12 * g * (0.6 + 0.8 * hash(slot + 11));
    for (let i = 0; i < slices; i++) {
      const th = hash(i * 7.31 + 1.7) * 0.8 + 0.1;
      const L = p > th + (hash(slot * 3 + i) - 0.5) * 0.35 * g ? b : a;
      if (!L) continue;
      const lb = L.box;
      const sliceH = lb.h / slices;
      const sw = L.white.width;
      const sy = Math.round(i * sliceH * dpr), sh = Math.max(1, Math.round(sliceH * dpr));
      const off = hash(slot * 13 + i) > 1 - 0.5 * g ? (hash(slot * 7 + i * 3) - 0.5) * fontSize * 0.9 * g : 0;
      const dy = lb.y + i * sliceH;
      if (split > 0.4) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * 0.8;
        ctx.drawImage(L.red, 0, sy, sw, sh, lb.x + off - split, dy, lb.w, sliceH);
        ctx.drawImage(L.cyan, 0, sy, sw, sh, lb.x + off + split, dy, lb.w, sliceH);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = alpha;
      ctx.drawImage(L.white, 0, sy, sw, sh, lb.x + off, dy, lb.w, sliceH);
    }
    // displaced pixel blocks
    const blocks = Math.round(6 * g);
    const src = (p > 0.5 ? b : a) || b;
    const sb = src.box;
    for (let i = 0; i < blocks; i++) {
      const bx = hash(slot * 5 + i * 17) * sb.w * 0.9;
      const by = hash(slot * 9 + i * 23) * sb.h * 0.8;
      const w = Math.min(sb.w - bx, fontSize * (0.3 + hash(slot + i * 29) * 0.9));
      const h = Math.min(sb.h - by, fontSize * (0.05 + hash(slot + i * 31) * 0.16));
      const dx = (hash(slot + i * 37) - 0.5) * fontSize * 1.2 * g;
      ctx.globalAlpha = alpha * 0.85;
      ctx.drawImage(src.white, bx * dpr, by * dpr, w * dpr, h * dpr, sb.x + bx + dx, sb.y + by, w, h);
    }
    ctx.globalAlpha = 1;
  }

  const glitchCurve = p => (p <= 0 || p >= 1 ? 0 : Math.pow(Math.sin(Math.PI * p), 0.7));
  const aftershock = (p, e, chance) => (p >= 1 && hash(Math.floor(e / 90)) > chance ? 0.2 : 0);

  function drawCopies(e) {
    if (e < T.copies) return;
    const out = 1 - ease(prog(e, [T.drop[0], T.drop[0] + 700]));
    if (out <= 0) return;
    ctx.fillStyle = '#f4f4f4';
    ctx.textBaseline = 'middle';
    copies.forEach((c, k) => {
      const start = T.copies + k * 140;
      const pin = clamp01((e - start) / 420);
      if (pin <= 0) return;
      const slot = Math.floor(e / 60) + k * 31;
      let a = c.alpha * pin * out;
      if (pin < 1 && hash(slot) < 0.45) a *= 0.2; // flicker in
      const jitter = pin < 1 ? (hash(slot + 5) - 0.5) * fontSize * 0.25 : 0;
      ctx.save();
      ctx.translate(c.x + jitter, c.y);
      ctx.rotate(c.rot);
      ctx.globalAlpha = a;
      ctx.font = `600 ${c.size}px Poppins, sans-serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${(c.size * c.spacing).toFixed(1)}px`;
      ctx.textAlign = c.align;
      ctx.fillText('FRANCIS VIN', 0, 0);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  // the full name drawn letter by letter: letters dissolve one at a time (F R A N C I S),
  // then V I N glide into the centre
  function drawDissolve(e) {
    const en = names[2];
    const m = ease(prog(e, T.gather));
    ctx.fillStyle = '#f4f4f4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${fontSize}px ${en.font}`;
    en.chars.forEach((c, k) => {
      if (c.ch === ' ') return;
      const keepIdx = KEEP.indexOf(k);
      let alpha = 1, x = c.x, dy = 0, blur = 0;
      if (keepIdx >= 0) {
        x = vin[keepIdx].from + (vin[keepIdx].x - vin[keepIdx].from) * m;
      } else {
        const q = ease((e - T.drop[0] - k * 140) / 520); // one by one, left to right
        alpha = 1 - q;
        dy = -q * fontSize * 0.3;
        blur = q * 9;
        const slot = Math.floor(e / 50) + k * 17;
        if (q > 0 && q < 1 && hash(slot) < 0.35) alpha *= 0.25;
      }
      if (alpha <= 0.01) return;
      ctx.globalAlpha = alpha;
      ctx.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none';
      ctx.fillText(c.ch, x, H / 2 + dy);
    });
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  }

  let start = 0, raf = 0, revealed = false;
  function skip() {
    if (!start) return;
    const e = performance.now() - start;
    if (e < T.zoom[0]) start = performance.now() - T.zoom[0];
  }
  const onKey = event => { if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') skip(); };
  const skipButton = intro.querySelector('.intro-skip');
  if (skipButton) skipButton.addEventListener('click', skip);
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', build);

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const e = now - start;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    if (e < T.zoom[0]) {
      ctx.shadowColor = 'rgba(255,255,255,0.22)';
      ctx.shadowBlur = 16;
      if (e < T.toJp[0]) {
        const p = prog(e, T.kr);
        drawGlitch(null, layers[0], p, glitchCurve(p) + aftershock(p, e, 0.97), e);
      } else if (e < T.toEn[0]) {
        const p = prog(e, T.toJp);
        drawGlitch(layers[0], layers[1], p, glitchCurve(p) + aftershock(p, e, 0.97), e);
      } else if (e < T.drop[0]) {
        const p = prog(e, T.toEn);
        drawGlitch(layers[1], layers[2], p, glitchCurve(p) + aftershock(p, e, 0.975), e);
      } else if (e < T.toLogo[0]) {
        drawDissolve(e);
      } else {
        const p = prog(e, T.toLogo);
        drawGlitch(vinLayer, logoLayer, p, glitchCurve(p), e);
      }
      ctx.shadowBlur = 0;
      drawCopies(e);
      return;
    }

    // zoom: the logo becomes a window onto Home and flies toward the viewer
    if (!revealed) {
      revealed = true;
      intro.classList.add('is-zooming');
      html.classList.remove('intro-running');
    }
    const p = prog(e, T.zoom);
    const hole = ease(clamp01(p / 0.16));
    const z = Math.exp(Math.log(prefersReducedMotion ? 1.0001 : 260) * Math.pow(ease(p), 1.6));
    const o = logoLayer.origin, lb = logoLayer.box;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(z, z);
    ctx.translate(-o.x, -o.y);
    if (hole > 0) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = hole;
      ctx.drawImage(logoLayer.white, lb.x, lb.y, lb.w, lb.h);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (hole < 1) {
      ctx.globalAlpha = 1 - hole;
      ctx.drawImage(logoLayer.white, lb.x, lb.y, lb.w, lb.h);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // the remaining darkness fades out as the logo passes the viewer
    intro.style.opacity = String(1 - ease(clamp01((p - 0.55) / 0.45)));

    if (p >= 1) {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', build);
      finish();
    }
  }

  // wait (briefly) for the fonts and the logo so the canvas uses them
  const fontsReady = document.fonts && document.fonts.load
    ? Promise.all(names.map(n => document.fonts.load(`600 48px ${n.font}`, n.text))).catch(() => {})
    : Promise.resolve();
  const logoReady = new Promise(resolve => {
    const img = new Image();
    img.onload = () => { logoImg = img; resolve(); };
    img.onerror = () => resolve();
    img.src = LOGO_SRC;
  });
  Promise.race([Promise.all([fontsReady, logoReady]), new Promise(resolve => setTimeout(resolve, 1500))]).then(() => {
    build();
    start = performance.now();
    raf = requestAnimationFrame(frame);
  });
}
startIntro();

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeLightbox();
    closeResume();
    closeBizcard();
  }
});
