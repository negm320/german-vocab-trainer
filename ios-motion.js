/* ============================================================
   IOSMotion — shared, dependency-free spring engine.

   The rest of this app's "animation" is CSS @keyframes and instant
   classList.toggle snaps. Those can't be interrupted, can't carry
   velocity, and can't respond to anything mid-flight — they're picked
   once and played back. This is the real thing: a damped-harmonic-
   oscillator spring, driven by requestAnimationFrame, parameterized the
   way Apple's own UIKit dynamics / "Designing Fluid Interfaces" talk
   describes it — damping ratio + response, not stiffness/mass constants.

   API:
     const s = IOSMotion.createSpring({ x: 0, opacity: 1 }, { damping: 1, response: 0.4 });
     s.onUpdate(values => { el.style.transform = `translateY(${values.x}px)`; el.style.opacity = values.opacity; });
     s.to({ x: 40, opacity: 0 });          // animate toward a new target
     s.to({ x: 0 }, { velocity: { x: 800 } }); // ...carrying an initial velocity (gesture handoff)
     s.set({ x: 0, opacity: 1 });          // jump instantly, no animation
     s.stop();

   - Every channel is independent (own value/velocity/target) but stepped
     off one shared rAF loop.
   - Calling .to() again on an in-flight spring does NOT reset velocity —
     it just retargets, so a re-triggered animation continues smoothly
     from wherever it actually is instead of snapping back to a start
     value ("no brick wall" on reversal).
   - Respects prefers-reduced-motion globally: .to() jumps straight to
     the target and fires onComplete, no motion.
   ============================================================ */
(function(){
  const REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  const MAX_DT = 1/30; // clamp huge gaps (tab backgrounded, etc.) so a spring doesn't lurch on return

  // "Settled" has to scale with the channel's own magnitude, not a fixed
  // absolute number — a fixed epsilon of 0.01 means an opacity channel
  // (range 0-1) settles almost instantly while a 100px position channel
  // waits for scientifically-exact convergence (measured: ~1s of a
  // response:0.4 spring spent crawling the last fraction of a pixel,
  // long after the motion was visually indistinguishable from arrived).
  function settledChannel(c) {
    const scale = Math.max(Math.abs(c.target), 1);
    const eps = Math.max(scale * 0.005, 0.01);
    return Math.abs(c.target - c.value) < eps && Math.abs(c.velocity) < eps;
  }

  function springParams(cfg) {
    const damping = cfg && cfg.damping != null ? cfg.damping : 1;
    const response = Math.max(cfg && cfg.response != null ? cfg.response : 0.4, 0.001);
    const mass = cfg && cfg.mass != null ? cfg.mass : 1;
    const omega0 = (2 * Math.PI) / response;
    return { stiffness: omega0 * omega0 * mass, damping: 2 * damping * omega0 * mass, mass };
  }

  function createSpring(initial, config) {
    const params = springParams(config || {});
    const channels = {}; // name -> { value, velocity, target }
    let rafId = null;
    let lastT = null;
    let onUpdateCb = null;
    let onCompleteCb = null;

    Object.keys(initial || {}).forEach(k => {
      channels[k] = { value: initial[k], velocity: 0, target: initial[k] };
    });

    function ensure(k, v) {
      if (!channels[k]) channels[k] = { value: v, velocity: 0, target: v };
      return channels[k];
    }

    function settled() {
      return Object.values(channels).every(settledChannel);
    }

    function currentValues() {
      const out = {};
      Object.keys(channels).forEach(k => { out[k] = channels[k].value; });
      return out;
    }

    function step(dt) {
      const substeps = 4; // symplectic Euler substeps for stability at low response/high damping
      const h = dt / substeps;
      Object.values(channels).forEach(c => {
        for (let i = 0; i < substeps; i++) {
          const accel = (-params.stiffness * (c.value - c.target) - params.damping * c.velocity) / params.mass;
          c.velocity += accel * h;
          c.value += c.velocity * h;
        }
      });
    }

    function loop(t) {
      if (lastT == null) lastT = t;
      const dt = Math.min((t - lastT) / 1000, MAX_DT);
      lastT = t;
      step(dt);
      if (onUpdateCb) onUpdateCb(currentValues());
      if (settled()) {
        Object.values(channels).forEach(c => { c.value = c.target; c.velocity = 0; });
        if (onUpdateCb) onUpdateCb(currentValues());
        rafId = null; lastT = null;
        if (onCompleteCb) onCompleteCb();
        return;
      }
      rafId = requestAnimationFrame(loop);
    }

    return {
      set(values) {
        Object.keys(values).forEach(k => {
          const c = ensure(k, values[k]);
          c.value = values[k]; c.target = values[k]; c.velocity = 0;
        });
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null; lastT = null;
        if (onUpdateCb) onUpdateCb(currentValues());
      },
      to(targets, opts) {
        opts = opts || {};
        Object.keys(targets).forEach(k => {
          const c = ensure(k, targets[k]);
          c.target = targets[k];
          if (opts.velocity && opts.velocity[k] != null) c.velocity = opts.velocity[k];
        });
        if (REDUCE && REDUCE.matches) { this.set(targets); if (onCompleteCb) onCompleteCb(); return; }
        if (!rafId) { lastT = null; rafId = requestAnimationFrame(loop); }
      },
      stop() { if (rafId) cancelAnimationFrame(rafId); rafId = null; lastT = null; },
      get(k) { return channels[k] ? channels[k].value : undefined; },
      onUpdate(cb) { onUpdateCb = cb; return this; },
      onComplete(cb) { onCompleteCb = cb; return this; },
    };
  }

  window.IOSMotion = {
    createSpring,
    get reducedMotion() { return !!(REDUCE && REDUCE.matches); },
  };
})();
