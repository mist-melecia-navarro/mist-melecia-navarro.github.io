// js/site.js
document.addEventListener('DOMContentLoaded', () => {
  /* Footer year */
  document.querySelectorAll('#year').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  /* Same-page anchor highlighting (only links that start with "#") */
  const anchorNavLinks = Array.from(document.querySelectorAll('.top-nav a[href^="#"]'));
  const anchorSections = anchorNavLinks
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  function updateAnchorActive() {
    if (!anchorSections.length) return;
    const scrollY = window.scrollY + window.innerHeight * 0.35;
    let current = anchorSections[0];
    for (const s of anchorSections) if (s.offsetTop <= scrollY) current = s;

    anchorNavLinks.forEach(a => {
      const target = document.querySelector(a.getAttribute('href'));
      const on = target === current;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }
  updateAnchorActive();
  window.addEventListener('scroll', updateAnchorActive, { passive: true });

  /* Cross-page highlighting (ignore #hash-only links) */
  (function highlightCurrentPage() {
    const currentFile = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.top-nav a[href]').forEach(a => {
      const raw = a.getAttribute('href') || '';
      if (raw.startsWith('#')) return;                 // ignore hash-only links
      const targetFile = raw.split('#')[0].toLowerCase();
      if (targetFile && targetFile === currentFile) {
        a.classList.add('is-active');
        a.setAttribute('aria-current', 'page');
      }
    });
  }());

  /* Optional: generic hover-swap for images */
  document.querySelectorAll('img.js-swap[data-swap-hover]').forEach(img => {
    const base = img.getAttribute('src');
    const hover = img.getAttribute('data-swap-hover');
    if (!hover) return;

    const pre = new Image(); pre.src = hover;

    const toHover = () => { img.src = hover; };
    const toBase  = () => { img.src = base;  };

    img.addEventListener('mouseenter', toHover);
    img.addEventListener('mouseleave', toBase);

    if (img.tabIndex < 0) img.tabIndex = 0;
    img.addEventListener('focus', toHover);
    img.addEventListener('blur',  toBase);

    window.addEventListener('touchstart', () => {
      img.src = (img.src === hover) ? base : hover;
    }, { passive: true });
  });

  /* Touch helper for ENTER overlay */
  window.addEventListener('touchstart', () => {
    document.body.classList.add('touching');
  }, { once: true, passive: true });

  /* === Slow “on arrival” scroll to content on all pages except index.html === */
  (function slowScrollOnArrival() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const isIndex = file === '' || file === 'index.html';
    if (isIndex) return;

    const hashId = location.hash && location.hash.slice(1);
    let target =
      (hashId && document.getElementById(hashId)) ||
      document.getElementById('home') ||
      document.getElementById('content');
    if (!target) return;

    const navHVar = getComputedStyle(document.documentElement).getPropertyValue('--nav-h').trim();
    const offset = parseInt(navHVar, 10) || 64;
    const targetY = Math.max(0, (target.offsetTop || 0) - (offset + 8));

    const root = document.documentElement;
    const prevBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    if (location.hash) window.scrollTo(0, 0);

    const duration = 1400; // ms
    const startY = window.pageYOffset;
    const delta  = targetY - startY;
    const start  = performance.now();
    const ease   = t => (t < .5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2);

    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      window.scrollTo(0, Math.round(startY + delta * ease(t)));
      if (t < 1) requestAnimationFrame(step);
      else root.style.scrollBehavior = prevBehavior;
    }
    requestAnimationFrame(step);
  })();

  /* === Persistent subnav: exclusive open (switches when you hover another group) === */
  (function persistentSubnav() {
    const CLOSE_DELAY = 7000; // ms
    const groups = Array.from(document.querySelectorAll('.has-submenu'));
    let openGroup = null;

    function closeGroup(group) {
      if (!group) return;
      clearTimeout(group._hideTimer);
      group.classList.remove('is-open');
      const t = group.querySelector(':scope > a');
      if (t) t.setAttribute('aria-expanded', 'false');
      if (openGroup === group) openGroup = null;
    }

    function openExclusive(group) {
      if (openGroup && openGroup !== group) closeGroup(openGroup);
      clearTimeout(group._hideTimer);
      group.classList.add('is-open');
      const t = group.querySelector(':scope > a');
      if (t) t.setAttribute('aria-expanded', 'true');
      openGroup = group;
    }

    groups.forEach(group => {
      const trigger = group.querySelector(':scope > a');
      const panel   = group.querySelector(':scope > .subnav');
      if (!trigger || !panel) return;

      // Open this group and close any other open one
      group.addEventListener('mouseenter', () => openExclusive(group));
      group.addEventListener('focusin',    () => openExclusive(group));

      // Start delayed close only when leaving this whole group
      group.addEventListener('mouseleave', () => {
        clearTimeout(group._hideTimer);
        group._hideTimer = setTimeout(() => {
          if (openGroup === group) closeGroup(group);
        }, CLOSE_DELAY);
      });
      group.addEventListener('focusout', () => {
        clearTimeout(group._hideTimer);
        group._hideTimer = setTimeout(() => {
          if (openGroup === group) closeGroup(group);
        }, CLOSE_DELAY);
      });

      // First click on parent opens; second click (while open) follows link
      trigger.addEventListener('click', (e) => {
        if (!group.classList.contains('is-open')) {
          e.preventDefault();
          openExclusive(group);
        }
      });

      // Clicking any submenu item closes immediately
      panel.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => closeGroup(group));
      });
    });

    // Click outside closes any open subnav
    document.addEventListener('pointerdown', (e) => {
      groups.forEach(g => { if (!g.contains(e.target)) closeGroup(g); });
    }, { passive: true });

    // ESC closes current
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeGroup(openGroup);
    });
  })();
});


/* Put subnav directly below the sticky nav (works on wrap/resize/scroll) */
(function subnavBelowNav() {
  const nav = document.querySelector('.top-nav');
  if (!nav) return;

  function setSubnavTop() {
    // fixed positioning uses viewport coordinates; getBoundingClientRect().bottom is perfect
    const bottom = Math.ceil(nav.getBoundingClientRect().bottom);
    document.documentElement.style.setProperty('--subnav-top', bottom + 'px');
  }

  setSubnavTop();
  window.addEventListener('resize', setSubnavTop);
  window.addEventListener('scroll', setSubnavTop, { passive: true });
})();