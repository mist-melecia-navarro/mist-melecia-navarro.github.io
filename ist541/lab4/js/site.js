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

/* Click-to-check quiz for stage cards */
(function quizCards(){
  document.querySelectorAll('.js-quiz').forEach(block => {
    const allow = (block.dataset.allow || 'single').toLowerCase();
    const cards = Array.from(block.querySelectorAll('.stage-card--image'));
    const feedback = block.querySelector('.quiz-feedback');
    const resetBtn = block.querySelector('.quiz-reset');

    function reset() {
      block.classList.remove('has-picked');
      cards.forEach(c => {
        c.classList.remove('is-correct','is-wrong','is-selected');
        c.removeAttribute('aria-pressed');
      });
      if (feedback) feedback.textContent = '';
    }

    block.addEventListener('click', (e) => {
      const card = e.target.closest('.stage-card--image');
      if (!card || !block.contains(card)) return;

      // Prevent navigation while in quiz mode
      e.preventDefault();

      const isRight = card.dataset.correct === 'true';

      if (allow === 'single') {
        cards.forEach(c => c.classList.remove('is-correct','is-wrong','is-selected'));
      }
      card.classList.add(isRight ? 'is-correct' : 'is-wrong', 'is-selected');
      card.setAttribute('aria-pressed', 'true');

      block.classList.add('has-picked');
      if (feedback) feedback.textContent = isRight ? 'Nice! That’s correct.' : 'Not quite — try again.';
    });

    if (resetBtn) resetBtn.addEventListener('click', reset);
  });
})();

/* -------- Flip-to-reveal (explore) -------- */
(function flipCards(){
  document.querySelectorAll('.js-flipgrid').forEach(grid => {
    const exclusive = (grid.dataset.exclusive || '').toLowerCase() === 'true';

    grid.addEventListener('click', e => {
      const btn = e.target.closest('.sc-btn');
      if (!btn || !grid.contains(btn)) return;
      e.preventDefault();

      if (exclusive) {
        grid.querySelectorAll('.sc-btn.is-flipped').forEach(other => {
          if (other !== btn) {
            other.classList.remove('is-flipped');
            other.setAttribute('aria-expanded','false');
          }
        });
      }
      const nowOn = btn.classList.toggle('is-flipped');
      btn.setAttribute('aria-expanded', nowOn ? 'true' : 'false');
    });

    // keyboard support
    grid.addEventListener('keydown', e => {
      const btn = e.target.closest('.sc-btn');
      if (!btn) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
      if (e.key === 'Escape') { btn.classList.remove('is-flipped'); btn.setAttribute('aria-expanded','false'); }
    });
  });

  // click outside closes all
  document.addEventListener('click', e => {
    document.querySelectorAll('.js-flipgrid').forEach(grid => {
      if (!grid.contains(e.target)) {
        grid.querySelectorAll('.sc-btn.is-flipped').forEach(btn => {
          btn.classList.remove('is-flipped');
          btn.setAttribute('aria-expanded','false');
        });
      }
    });
  }, { passive: true });
})();

/* -------- Quiz interactions -------- */
(function quizCards(){
  document.querySelectorAll('.js-quiz').forEach(quiz => {
    const exclusive = (quiz.dataset.exclusive || '').toLowerCase() === 'true';
    const feedbackEl = quiz.parentElement.querySelector('.quiz-feedback');

    function clearAll() {
      quiz.querySelectorAll('.quiz-card').forEach(c => c.classList.remove('is-correct','is-wrong'));
      if (feedbackEl) feedbackEl.textContent = '';
    }

    quiz.addEventListener('click', e => {
      const card = e.target.closest('.quiz-card');
      if (!card || !quiz.contains(card)) return;
      if (exclusive) {
        quiz.querySelectorAll('.quiz-card').forEach(c => { if (c !== card) c.classList.remove('is-correct','is-wrong'); });
      }
      const correct = (card.dataset.correct || 'false') === 'true';
      card.classList.toggle('is-correct', correct);
      card.classList.toggle('is-wrong', !correct);
      if (feedbackEl) feedbackEl.textContent = correct ? '✅ Correct!' : '❌ Try again.';
    });

    const resetBtn = quiz.parentElement.querySelector('.quiz-reset');
    if (resetBtn) resetBtn.addEventListener('click', clearAll);
  });
})();


  // Flip cards: click/tap toggles, button semantics handle keyboard
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.stage-card--flip').forEach(card => {
      // If it's not a <button>, make it behave like one
      if (card.tagName !== 'BUTTON') {
        card.setAttribute('role','button');
        card.tabIndex = card.tabIndex >= 0 ? card.tabIndex : 0;
      }
      card.addEventListener('click', () => {
        const on = card.classList.toggle('is-flipped');
        card.setAttribute('aria-expanded', String(on));
      });
    });
  });

// --- Random Scenario Image Quiz ---------------------------------------------
(function initRandomScenarioQuiz(){
  const root = document.querySelector('.js-random-quiz');
  if (!root) return;

  // TODO: Adjust file names to match your actual images
  // You told me your files are named like:
  // 1precontemplation.jpg, 2contemplation.jpg, 3plan.jpg, 4action.jpg, 5maintenance.jpg, 6relapse.jpg
  // For "Preparation" you said the file is "3plan.jpg".
  const SCENARIOS = [
    { stage:'Precontemplation', img:'img/1precontemplation.jpg', alt:'Precontemplation', caption:'Not yet acknowledging a problem; low/no intent to change.' },
    { stage:'Contemplation',    img:'img/2contemplation.jpg',    alt:'Contemplation',    caption:'Ambivalence; weighing pros/cons; “maybe someday.”' },
    { stage:'Preparation',      img:'img/3plan.jpg',             alt:'Preparation',      caption:'Intention to act; making small steps and gathering resources.' },
    { stage:'Action',           img:'img/4action.jpg',           alt:'Action',           caption:'Visible behavior change within the last 6 months.' },
    { stage:'Maintenance',      img:'img/5maintenance.jpg',      alt:'Maintenance',      caption:'Sustaining change; preventing relapse and building routines.' },
    { stage:'Relapse',          img:'img/6relapse.jpg',          alt:'Relapse', caption:'Returning to prior behavior; reflect, learn, and re-engage.' }
  ];

  // DOM
  const imgEl      = root.querySelector('.image-quiz__img');
  const capEl      = root.querySelector('.image-quiz__caption');
  const btns       = Array.from(root.querySelectorAll('.quiz-card'));
  const btnNext    = root.querySelector('.quiz-next');
  const btnReset   = root.querySelector('.quiz-reset');
  const feedbackEl = root.querySelector('.quiz-feedback');
  const scoreEl    = root.querySelector('.quiz-score');

  // State
  let order = [];
  let index = 0;
  let picked = false;
  let correctCount = 0;

  function shuffle(arr){
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function newOrder(){
    order = shuffle([...SCENARIOS.keys()]);
    index = 0; correctCount = 0;
  }

  function showScore(){
    scoreEl.textContent = `Score: ${correctCount} / ${index} ${index ? `(${Math.round((correctCount/index)*100)}%)` : ''}`;
  }

  function loadScenario(){
    const s = SCENARIOS[ order[index] ];
    // reset button states
    btns.forEach(b => b.classList.remove('is-correct','is-wrong'));
    // set image/caption
    imgEl.src = s.img;
    imgEl.alt = s.alt;
    capEl.textContent = s.caption || '';
    imgEl.hidden = false;

    // start in preview state (65% opacity) until a pick is made
    imgEl.classList.add('is-visible','is-preview');
    imgEl.classList.remove('is-correct','is-wrong');

    feedbackEl.textContent = '';
    btnNext.disabled = true;
    picked = false;
    showScore();
  }

  function lockButtons(){
    btns.forEach(b => b.disabled = true);
  }
  function unlockButtons(){
    btns.forEach(b => b.disabled = false);
  }

  // Hover preview (keeps image at 65% until answered)
  btns.forEach(b => {
    b.addEventListener('mouseenter', () => {
      if (!picked) {
        imgEl.classList.add('is-preview');
        imgEl.classList.remove('is-correct','is-wrong');
      }
    });
    b.addEventListener('mouseleave', () => {
      // keep preview while unanswered
      if (!picked) imgEl.classList.add('is-preview');
    });
  });

  // Click to answer
  btns.forEach(b => {
    b.addEventListener('click', () => {
      if (picked) return; // ignore extra clicks after selection

      const answer = b.getAttribute('data-stage');
      const s = SCENARIOS[ order[index] ];
      picked = true;

      // remove preview effect and mark result
      imgEl.classList.remove('is-preview');
      unlockButtons(); // ensure buttons enabled to show styles
      lockButtons();   // then lock after pick

      if (answer === s.stage) {
        b.classList.add('is-correct');
        imgEl.classList.add('is-correct');
        feedbackEl.textContent = 'Correct!';
        correctCount++;
      } else {
        b.classList.add('is-wrong');
        imgEl.classList.add('is-wrong');
        feedbackEl.textContent = `Not quite — this was ${s.stage}.`;
      }

      btnNext.disabled = false;
      index++;
      showScore();
    });
  });

  // Next scenario
  btnNext.addEventListener('click', () => {
    if (index >= order.length) {
      feedbackEl.textContent = 'You’ve seen all scenarios. Press Reset to play again.';
      btnNext.disabled = true;
      return;
    }
    unlockButtons();
    loadScenario();
  });

  // Reset
  btnReset.addEventListener('click', () => {
    newOrder();
    unlockButtons();
    loadScenario();
  });

  // init
  newOrder();
  loadScenario();
})();

// === Stage-of-Change: Goal Matching Quiz ===============================
(() => {
  const elPrompt  = document.getElementById('tq-prompt');
  const elStage   = document.getElementById('tq-stage');
  const elOptions = document.getElementById('tq-options');
  const elNext    = document.getElementById('tq-next');
  const elFB      = document.getElementById('tq-feedback');
  const elScore   = document.getElementById('tq-score');

  if (!elPrompt || !elOptions || !elNext) return; // quiz not on this page

  // Bank: one “signature” goal per stage (concise, teachable)
  const BANK = [
    {
      stage: 'Precontemplation',
      goal: 'Build rapport and increase awareness of impact; invite reflection — not action.',
    },
    {
      stage: 'Contemplation',
      goal: 'Resolve ambivalence by exploring pros/cons; tip toward change with discrepancy.',
    },
    {
      stage: 'Preparation',
      goal: 'Co-create a concrete plan (what/when/how), identify supports, set a start date.',
    },
    {
      stage: 'Action',
      goal: 'Implement skills/strategies, troubleshoot barriers, reinforce small wins.',
    },
    {
      stage: 'Maintenance',
      goal: 'Prevent relapse: strengthen routines, coping plans, and support systems.',
    },
    {
      stage: 'Relapse / Recycling',
      goal: 'Normalize lapse, analyze triggers, revise the plan, and re-engage supports.',
    },
  ];

  // Utility
  const randInt = n => Math.floor(Math.random() * n);
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  let score = 0, total = 0, current = null, locked = false;

  function newQuestion() {
    locked = false;
    elFB.textContent = '';

    // Pick a correct stage
    const correct = BANK[randInt(BANK.length)];

    // Build options: include correct + 3 distractors from other stages
    const distractors = shuffle(BANK.filter(b => b.stage !== correct.stage)).slice(0, 3);
    const opts = shuffle([correct, ...distractors]);

    current = {
      stage: correct.stage,
      correctGoal: correct.goal,
      options: opts
    };

    // Render prompt + stage pill
    elPrompt.textContent = `Which treatment goal best matches this stage?`;
    elStage.textContent = current.stage;

    // Render options
    elOptions.innerHTML = '';
    opts.forEach((o, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'quiz-card';
      card.setAttribute('role', 'listitem');
      card.dataset.correct = (o.goal === current.correctGoal) ? '1' : '0';
      card.innerHTML = `<p>${o.goal}</p>`;
      card.addEventListener('click', () => handlePick(card));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
      });
      elOptions.appendChild(card);
    });

    // Update score line
    elScore.textContent = total ? `Score: ${score}/${total}` : '';
  }

  function handlePick(card) {
    if (locked) return;
    locked = true;
    total++;

    // Mark everything; highlight correct/incorrect like your photo quiz
    const cards = Array.from(elOptions.querySelectorAll('.quiz-card'));
    const isCorrect = card.dataset.correct === '1';

    cards.forEach(c => {
      const correct = c.dataset.correct === '1';
      c.classList.remove('is-correct', 'is-wrong');
      c.classList.add(correct ? 'is-correct' : 'is-wrong');
      c.disabled = true;
    });

    if (isCorrect) {
      score++;
      elFB.textContent = '✔ Correct!';
    } else {
      elFB.textContent = '✖ Not quite — review the stage’s goal above.';
    }

    elScore.textContent = `Score: ${score}/${total}`;
  }

  elNext.addEventListener('click', newQuestion);

  // Start the first question
  newQuestion();
})();

// === Stage-of-Change: Goal Matching Quiz (definition + scenario mix) ===
(() => {
  const elPrompt  = document.getElementById('tq-prompt');
  const elStage   = document.getElementById('tq-stage');
  const elOptions = document.getElementById('tq-options');
  const elNext    = document.getElementById('tq-next');
  const elFB      = document.getElementById('tq-feedback');
  const elScore   = document.getElementById('tq-score');

  if (!elPrompt || !elOptions || !elNext) return; // quiz not on this page

  // ---- Keep your original bank (definitions) + add scenario-style therapist goals
  const BANK = [
    {
      stage: 'Precontemplation',
      defn:  'Build rapport and increase awareness of impact; invite reflection — not action.',
      scen:  'Client will increase awareness of alcohol-related impacts by completing two brief reflection journals per week and discussing at least one personal consequence in session.'
    },
    {
      stage: 'Contemplation',
      defn:  'Resolve ambivalence by exploring pros/cons; tip toward change with discrepancy.',
      scen:  'Client will prepare a decisional balance for anger outbursts (≥3 pros, ≥3 cons) and identify two personal values that conflict with “blowing up,” to be reviewed in session.'
    },
    {
      stage: 'Preparation',
      defn:  'Co-create a concrete plan (what/when/how), identify supports, set a start date.',
      scen:  'Client will co-create a morning-routine plan (two alarms, pack bag at night, lay out clothes), choose a start date within 7 days, and identify one accountability partner.'
    },
    {
      stage: 'Action',
      defn:  'Implement skills/strategies, troubleshoot barriers, reinforce small wins.',
      scen:  'Client will reduce cannabis use from 7 to ≤3 days/week for 4 consecutive weeks, track urges daily, and practice two coping skills (e.g., 4-7-8 breathing, 10-min walk) during cravings.'
    },
    {
      stage: 'Maintenance',
      defn:  'Prevent relapse: strengthen routines, coping plans, and support systems.',
      scen:  'Client will maintain daily hygiene (shower + teeth brushing) ≥5 days/week for 8 weeks using a checklist and a weekly self-reward when the goal is met.'
    },
    {
      stage: 'Relapse / Recycling',
      defn:  'Normalize lapse, analyze triggers, revise the plan, and re-engage supports.',
      scen:  'Following any binge episode, client will complete a lapse analysis within 48 hours, identify ≥2 triggers, update the meal plan with one replacement strategy, and schedule a support check-in.'
    },
  ];

  // Build two parallel item lists
  const DEFN_ITEMS = BANK.map(b => ({ stage: b.stage, goal: b.defn, kind: 'defn' }));
  const SCEN_ITEMS = BANK.map(b => ({ stage: b.stage, goal: b.scen, kind: 'scen' }));

  // Utils
  const randInt = n => Math.floor(Math.random() * n);
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  let score = 0, total = 0, locked = false;

  function newQuestion() {
    locked = false;
    elFB.textContent = '';

    // Randomly choose definition or scenario (50/50)
    const useScenario = Math.random() < 0.5;
    const SOURCE = useScenario ? SCEN_ITEMS : DEFN_ITEMS;

    // Pick one correct item + 3 distractors of the same type (from other stages)
    const correct = SOURCE[randInt(SOURCE.length)];
    const distractors = shuffle(SOURCE.filter(i => i.stage !== correct.stage)).slice(0, 3);
    const options = shuffle([correct, ...distractors]);

    // Render prompt + stage name
    elPrompt.textContent = 'Which treatment goal best matches this stage?';
    elStage.textContent = correct.stage;

    // Render options
    elOptions.innerHTML = '';
    options.forEach(o => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-card';
      btn.setAttribute('role', 'listitem');
      btn.dataset.correct = (o.goal === correct.goal) ? '1' : '0';
      btn.innerHTML = `<p>${o.goal}</p>`;
      btn.addEventListener('click', () => handlePick(btn));
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
      });
      elOptions.appendChild(btn);
    });

    // Update score display
    elScore.textContent = total ? `Score: ${score}/${total}` : '';
  }

  function handlePick(btn) {
    if (locked) return;
    locked = true;
    total++;

    const cards = Array.from(elOptions.querySelectorAll('.quiz-card'));
    const isCorrect = btn.dataset.correct === '1';

    cards.forEach(c => {
      const good = c.dataset.correct === '1';
      c.classList.toggle('is-correct', good);
      c.classList.toggle('is-wrong', !good);
      c.disabled = true;
    });

    if (isCorrect) {
      score++;
      elFB.textContent = '✔ Correct!';
    } else {
      elFB.textContent = '✖ Not quite — compare how the goal fits this stage.';
    }
    elScore.textContent = `Score: ${score}/${total}`;
  }

  elNext.addEventListener('click', newQuestion);
  newQuestion();
})();

// Equalize pill heights so they look consistent even with different text lengths
(function equalizeTgPills() {
  const grids = document.querySelectorAll('.tg-choices');
  if (!grids.length) return;

  const run = () => {
    grids.forEach(grid => {
      const pills = grid.querySelectorAll('.tg-pill, .quiz-card');
      if (!pills.length) return;
      // reset
      pills.forEach(p => { p.style.minHeight = ''; });
      // measure tallest
      let max = 0;
      pills.forEach(p => { max = Math.max(max, p.offsetHeight); });
      // apply
      pills.forEach(p => { p.style.minHeight = max + 'px'; });
    });
  };

  // initial + on resize/content changes
  run();
  const ro = new ResizeObserver(run);
  grids.forEach(g => ro.observe(g));
  window.addEventListener('resize', run, { passive: true });
})();