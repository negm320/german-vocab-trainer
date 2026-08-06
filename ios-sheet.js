/* ============================================================
   IOSSheet — shared bottom-sheet helper (dependency-free except for
   IOSMotion, which must load before this file)

   API:
     IOSSheet.open(id)
     IOSSheet.close(id)
     IOSSheet.confirm(message, { title, confirmLabel, cancelLabel, danger, onConfirm })

   Sheets can also be dragged down from their grab handle
   (.iosSheet-handle) to dismiss, like a native iOS sheet.

   Motion: every state change (open, tap-to-close, drag-release) drives
   the sheet's transform through one IOSMotion spring per sheet element,
   never a CSS transition or a fixed setTimeout. That means:
     - Grabbing the handle at ANY point — mid-open, mid-close, mid-settle
       from a previous drag — interrupts whatever is currently happening
       and takes over from wherever the sheet actually is on screen, not
       wherever it was headed.
     - A drag release hands its real measured velocity to the spring, so
       a hard flick settles quickly and a slow drag settles unhurried,
       instead of every release animating for the same fixed duration.
   ============================================================ */
(function(){
  function scrimEl(){
    let el = document.getElementById('iosSheetScrim');
    if(!el){
      el = document.createElement('div');
      el.id = 'iosSheetScrim';
      el.className = 'iosSheetScrim';
      document.body.appendChild(el);
    }
    return el;
  }

  let openId = null;
  let escHandler = null;

  // One spring per sheet element. Apple's own figures for a drawer/sheet
  // (damping 0.8, response 0.3) — enough momentum-carry to feel thrown,
  // not so much it visibly overshoots and bounces on every open.
  const springs = new WeakMap();
  const SHEET_SPRING = { damping: 0.8, response: 0.3 };

  function liveY(sheet){
    const s = springs.get(sheet);
    if(s) return s.get('y');
    return sheet.classList.contains('show') ? 0 : sheet.offsetHeight;
  }

  // fromOverride lets a caller that was just doing raw 1:1 pointer
  // tracking (drag release) hand in the true last-rendered value
  // directly, instead of this function inferring it from a spring that
  // was never driving the sheet during that drag.
  function driveTo(sheet, targetY, opts, onDone, fromOverride){
    const prev = springs.get(sheet);
    const fromY = fromOverride != null ? fromOverride : liveY(sheet);
    if(prev) prev.stop();
    const s = IOSMotion.createSpring({ y: fromY }, SHEET_SPRING);
    s.onUpdate(v => { sheet.style.transform = v.y > 0.05 ? ('translateY(' + v.y + 'px)') : ''; });
    s.onComplete(() => { if(onDone) onDone(); });
    springs.set(sheet, s);
    s.to({ y: targetY }, opts || {});
  }

  function finishClose(el){
    el.classList.remove('show');
    el.classList.add('hidden');
    el.style.transform = '';
    springs.delete(el);
    if(el.dataset.iosSheetTemp === '1') el.remove();
  }

  function open(id){
    const el = document.getElementById(id);
    if(!el) return;
    const wasHidden = el.classList.contains('hidden');
    el.classList.remove('hidden');
    el.classList.add('iosSheet');
    if(wasHidden){
      void el.offsetHeight; // force layout so offsetHeight is measurable
      el.style.transform = 'translateY(' + el.offsetHeight + 'px)';
    }
    el.classList.add('show');
    driveTo(el, 0, {});

    const scrim = scrimEl();
    scrim.classList.add('show');
    scrim.onclick = function(){ close(id); };

    openId = id;
    escHandler = function(e){ if(e.key === 'Escape') close(id); };
    document.addEventListener('keydown', escHandler);
  }

  function close(id){
    const el = document.getElementById(id || openId);
    if(!el) return;
    // .show stays on until finishClose — same as a drag-dismiss already
    // did — so the handle stays grabbable for the whole close animation
    // instead of only some close paths being interruptible.
    scrimEl().classList.remove('show');
    driveTo(el, el.offsetHeight, {}, () => finishClose(el));
    if(escHandler){ document.removeEventListener('keydown', escHandler); escHandler = null; }
    openId = null;
  }

  function confirm(message, opts){
    opts = opts || {};
    const id = 'iosConfirmSheet_' + Date.now();
    const el = document.createElement('div');
    el.id = id;
    el.className = 'iosSheet hidden';
    el.dataset.iosSheetTemp = '1';
    el.innerHTML =
      '<div class="iosSheet-handle"></div>' +
      (opts.title ? '<div class="iosSheet-title">' + opts.title + '</div>' : '') +
      '<div class="muted small" style="text-align:center;margin-bottom:16px;font-family:var(--font-chrome);line-height:1.5;">' + message + '</div>' +
      '<button class="' + (opts.danger ? 'iosSheet-danger' : 'iosSheet-primary') + '" style="margin-bottom:8px;">' + (opts.confirmLabel || 'Confirm') + '</button>' +
      '<button class="iosSheet-cancel">' + (opts.cancelLabel || 'Cancel') + '</button>';
    document.body.appendChild(el);

    const buttons = el.querySelectorAll('button');
    const confirmBtn = buttons[buttons.length - 2];
    const cancelBtn = buttons[buttons.length - 1];

    // Returns a Promise<boolean> (in addition to the onConfirm callback) so
    // callers that need to gate follow-up logic on the user's choice — like
    // chat.html deciding whether to fire its own opener message — can just
    // `await` it instead of restructuring around a fire-and-forget callback.
    return new Promise(function(resolve){
      confirmBtn.addEventListener('click', function(){
        close(id);
        if(typeof opts.onConfirm === 'function') opts.onConfirm();
        resolve(true);
      });
      cancelBtn.addEventListener('click', function(){ close(id); resolve(false); });

      open(id);
    });
  }

  /* ---- drag-to-dismiss (from the grab handle) ---- */
  let drag = null;

  function onPointerDown(e){
    const handle = e.target.closest && e.target.closest('.iosSheet-handle');
    if(!handle) return;
    const sheet = handle.closest('.iosSheet');
    if(!sheet || !sheet.classList.contains('show')) return;
    const baseY = liveY(sheet);
    const prev = springs.get(sheet);
    if(prev) prev.stop(); // grabbing takes over from whatever was animating
    drag = { sheet: sheet, startY: e.clientY, lastY: e.clientY, lastT: Date.now(), dy: baseY, visualY: Math.max(0, baseY), velocity: 0, baseY: baseY };
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }

  function onPointerMove(e){
    if(!drag) return;
    // dy is the *unclamped* total offset from fully-open, used for the
    // dismiss/expand distance decisions below. visualY is what actually
    // renders — never above the fully-open resting position.
    const dy = drag.baseY + (e.clientY - drag.startY);
    const now = Date.now();
    const dt = now - drag.lastT;
    if(dt > 0) drag.velocity = (e.clientY - drag.lastY) / dt; // px/ms
    drag.lastY = e.clientY;
    drag.lastT = now;
    drag.dy = dy;
    drag.visualY = Math.max(0, dy);
    drag.sheet.style.transform = drag.visualY > 0.05 ? ('translateY(' + drag.visualY + 'px)') : '';
  }

  function onPointerUp(){
    if(!drag) return;
    const sheet = drag.sheet, dy = drag.dy, visualY = drag.visualY, velocityPxPerSec = drag.velocity * 1000;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);

    if(dy < 0){
      // Upward swipe on the handle: expand a collapsed "Advanced" section
      // instead of requiring a tap on its <summary>.
      if(dy < -30 || drag.velocity < -0.5){
        const details = sheet.querySelector('details');
        if(details && !details.open) details.open = true;
      }
      driveTo(sheet, 0, { velocity: { y: velocityPxPerSec } }, null, visualY);
      drag = null;
      return;
    }

    const shouldDismiss = dy > sheet.offsetHeight * 0.3 || dy > 120 || drag.velocity > 0.6;
    if(shouldDismiss){
      scrimEl().classList.remove('show');
      if(escHandler){ document.removeEventListener('keydown', escHandler); escHandler = null; }
      openId = null;
      driveTo(sheet, sheet.offsetHeight, { velocity: { y: velocityPxPerSec } }, () => finishClose(sheet), visualY);
    } else {
      driveTo(sheet, 0, { velocity: { y: velocityPxPerSec } }, null, visualY);
    }
    drag = null;
  }

  document.addEventListener('pointerdown', onPointerDown);

  /* ---- shared AI-request error classifier ----
     The 4 AI-backed screens (grammar/preps/ausdruck/chat) all throw errors
     shaped like `API ${status}: ${responseBodySlice}` from their fetch
     layer. That body is truncated to ~200 chars before it ever reaches
     here, so it's frequently cut off mid-JSON — classify by sniffing the
     raw text instead of relying on a clean JSON.parse. Each screen maps
     the returned category to its own (possibly localized) copy; this only
     centralizes "what kind of failure was this", not the wording. */
  function classifyError(err){
    const raw = String((err && err.message) || err || '');
    const status = (raw.match(/^API (\d+):/) || [])[1];
    const code = status ? parseInt(status, 10) : null;
    if(/api key/i.test(raw) || code === 400 || code === 403) return 'apikey';
    if(code === 429 || /quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(raw)) return 'quota';
    if(code && code >= 500) return 'server';
    if(/network|failed to fetch|networkerror/i.test(raw)) return 'network';
    return 'unknown';
  }

  window.IOSSheet = { open: open, close: close, confirm: confirm, classifyError: classifyError };
})();
