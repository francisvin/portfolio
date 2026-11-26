/* ==========================================================================
   gallery.js — Pixelverse Design Gallery
   Builds the gallery from the images in img/pixelverse/. Nothing is written per
   image: every image found gets the same card, reveal animation and full view.

   How new designs are picked up:
   - When the site is served by a server that lists folders (VS Code Live Server,
     `python -m http.server`, Apache/nginx with autoindex …), the gallery reads the
     folder listing, so any image you drop into img/pixelverse/ appears automatically.
   - Where folders can't be listed (opening the file directly, GitHub Pages …), it
     falls back to the design list in designs.js.
   ========================================================================== */

(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const grid = document.querySelector('.dg-grid');
  const countEl = document.querySelector('.dg-count');
  const viewer = document.querySelector('.dg-viewer');
  const viewerImg = viewer.querySelector('.dg-viewer-img');
  const backdrop = viewer.querySelector('.dg-viewer-backdrop');
  const closeBtn = viewer.querySelector('.dg-viewer-close');

  /* ---------- build the grid ---------- */

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  function render(designs) {
    grid.innerHTML = '';
    if (!designs.length) {
      grid.innerHTML = '<p class="dg-empty">No designs yet.</p>';
      return;
    }
    const frag = document.createDocumentFragment();
    designs.forEach((design, i) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'dg-item';
      item.style.setProperty('--d', `${(i % 6) * 0.07}s`);
      item.setAttribute('aria-label', `View ${design.title}`);
      const img = new Image();
      img.alt = '';
      img.loading = i < 6 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.draggable = false;
      // light copy when available; a design whose image can't load at all is left out
      setPixelverseImage(img, design, 'thumb', () => { item.remove(); updateCount(); });
      item.appendChild(img);
      item.addEventListener('click', () => openViewer(img, design));
      frag.appendChild(item);
    });
    grid.appendChild(frag);
    grid.querySelectorAll('.dg-item').forEach(el => revealObserver.observe(el));
    updateCount();
  }

  function updateCount() {
    const n = grid.querySelectorAll('.dg-item').length;
    countEl.textContent = `${String(n).padStart(2, '0')} ${n === 1 ? 'design' : 'designs'}`;
  }

  /* ---------- full view: only the selected image ---------- */

  let source = null, opener = null, animating = false;
  const EASE = 'cubic-bezier(.2,.8,.2,1)';
  const DURATION = reduceMotion ? 1 : 520;

  // fit inside the visible screen (measured from the fixed full-screen viewer itself)
  function fitRect(natW, natH) {
    const box = viewer.getBoundingClientRect();
    const vw = box.width || document.documentElement.clientWidth;
    const vh = box.height || document.documentElement.clientHeight;
    const pad = vw < 640 ? 16 : 56;
    const maxW = vw - pad * 2, maxH = vh - pad * 2;
    const s = Math.min(maxW / natW, maxH / natH, 1.6);
    const w = natW * s, h = natH * s;
    return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
  }

  // animate the image between two on-screen rectangles using transforms only
  function fly(from, to, done) {
    viewerImg.style.width = `${to.width}px`;
    viewerImg.style.height = `${to.height}px`;
    viewerImg.style.left = `${to.left}px`;
    viewerImg.style.top = `${to.top}px`;
    const sx = from.width / to.width, sy = from.height / to.height;
    const anim = viewerImg.animate([
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`, borderRadius: '18px' },
      { transform: 'none', borderRadius: '14px' }
    ], { duration: DURATION, easing: EASE, fill: 'both' });
    anim.onfinish = done;
    return anim;
  }

  function openViewer(img, design) {
    if (animating || !img.naturalWidth) return;
    animating = true;
    source = img;
    opener = img.closest('.dg-item');
    viewerImg.src = img.currentSrc || img.src;
    // swap in the sharp copy once it has loaded
    if (design.web) {
      const sharp = new Image();
      sharp.onload = () => { if (source === img) viewerImg.src = sharp.src; };
      sharp.src = pixelverseImage(design.src, 'full');
    }
    const from = img.getBoundingClientRect();
    const to = fitRect(img.naturalWidth, img.naturalHeight);
    viewer.classList.add('open');
    viewer.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('viewer-open');
    opener.style.visibility = 'hidden';
    fly(from, to, () => { animating = false; closeBtn.focus({ preventScroll: true }); });
  }

  function closeViewer() {
    if (!viewer.classList.contains('open') || animating || !source) return;
    animating = true;
    const current = viewerImg.getBoundingClientRect();
    const target = source.getBoundingClientRect();
    viewer.classList.remove('open');
    // fly back into the thumbnail
    viewerImg.style.width = `${current.width}px`;
    viewerImg.style.height = `${current.height}px`;
    viewerImg.style.left = `${current.left}px`;
    viewerImg.style.top = `${current.top}px`;
    viewerImg.getAnimations().forEach(a => a.cancel());
    const sx = target.width / current.width, sy = target.height / current.height;
    const anim = viewerImg.animate([
      { transform: 'none', borderRadius: '14px' },
      { transform: `translate(${target.left - current.left}px, ${target.top - current.top}px) scale(${sx}, ${sy})`, borderRadius: '18px' }
    ], { duration: DURATION * 0.85, easing: EASE, fill: 'both' });
    anim.onfinish = () => {
      if (opener) opener.style.visibility = '';
      viewerImg.getAnimations().forEach(a => a.cancel());
      viewerImg.removeAttribute('src');
      viewer.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('viewer-open');
      if (opener) opener.focus({ preventScroll: true });
      animating = false;
    };
  }

  backdrop.addEventListener('click', closeViewer);
  viewerImg.addEventListener('click', closeViewer);
  closeBtn.addEventListener('click', closeViewer);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeViewer(); });
  window.addEventListener('resize', () => {
    if (!viewer.classList.contains('open') || animating || !source) return;
    const r = fitRect(source.naturalWidth, source.naturalHeight);
    Object.assign(viewerImg.style, { width: `${r.width}px`, height: `${r.height}px`, left: `${r.left}px`, top: `${r.top}px` });
  });

  /* ---------- page transition back to the portfolio ---------- */

  document.querySelectorAll('a.dg-back').forEach(link => {
    link.addEventListener('click', e => {
      if (reduceMotion || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      document.documentElement.classList.add('page-leaving');
      setTimeout(() => { window.location.href = link.href; }, 420);
    });
  });
  window.addEventListener('pageshow', () => document.documentElement.classList.remove('page-leaving'));

  loadPixelverse().then(render);
})();
