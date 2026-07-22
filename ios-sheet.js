/* ============================================================
   IOSSheet — shared bottom-sheet helper (dependency-free)
   Used by: top5k.html (phase 1). Reusable later for grammar/
   preps/ausdruck/chat sheets and confirm dialogs.

   API:
     IOSSheet.open(id)
     IOSSheet.close(id)
     IOSSheet.confirm(message, { title, confirmLabel, cancelLabel, danger, onConfirm })

   Sheets can also be dragged down from their grab handle
   (.iosSheet-handle) to dismiss, like a native iOS sheet.
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

  function finishClose(el){
    el.classList.remove('show');
    el.classList.add('hidden');
    el.style.transition = '';
    el.style.transform = '';
    if(el.dataset.iosSheetTemp === '1') el.remove();
  }

  function open(id){
    const el = document.getElementById(id);
    if(!el) return;
    el.classList.remove('hidden');
    el.classList.add('iosSheet');
    // force reflow so the transform transition plays
    void el.offsetHeight;
    el.classList.add('show');

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
    el.classList.remove('show');
    const scrim = scrimEl();
    scrim.classList.remove('show');
    setTimeout(function(){ finishClose(el); }, 280);
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
    drag = { sheet: sheet, startY: e.clientY, lastY: e.clientY, lastT: Date.now(), dy: 0, velocity: 0 };
    sheet.style.transition = 'none';
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }

  function onPointerMove(e){
    if(!drag) return;
    const dy = e.clientY - drag.startY;
    const now = Date.now();
    const dt = now - drag.lastT;
    if(dt > 0) drag.velocity = (e.clientY - drag.lastY) / dt;
    drag.lastY = e.clientY;
    drag.lastT = now;
    drag.dy = dy;
    // Downward drag moves the sheet toward dismiss, same as before. Upward
    // drag doesn't move the sheet (it's already fully open) — it's only
    // tracked so onPointerUp can use it to expand a collapsed <details>.
    drag.sheet.style.transform = dy > 0 ? ('translateY(' + dy + 'px)') : '';
  }

  function onPointerUp(){
    if(!drag) return;
    const sheet = drag.sheet, dy = drag.dy, velocity = drag.velocity;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);

    if(dy < 0){
      // Upward swipe on the handle: expand a collapsed "Advanced" section
      // instead of requiring a tap on its <summary>.
      if(dy < -30 || velocity < -0.5){
        const details = sheet.querySelector('details');
        if(details && !details.open) details.open = true;
      }
      sheet.style.transition = 'transform .25s cubic-bezier(.25,.46,.45,.94)';
      sheet.style.transform = '';
      setTimeout(function(){ sheet.style.transition = ''; }, 260);
      drag = null;
      return;
    }

    const shouldDismiss = dy > sheet.offsetHeight * 0.3 || dy > 120 || velocity > 0.6;
    if(shouldDismiss){
      sheet.style.transition = 'transform .22s ease-out';
      sheet.style.transform = 'translateY(100%)';
      scrimEl().classList.remove('show');
      setTimeout(function(){ finishClose(sheet); }, 220);
      if(escHandler){ document.removeEventListener('keydown', escHandler); escHandler = null; }
      openId = null;
    } else {
      sheet.style.transition = 'transform .25s cubic-bezier(.25,.46,.45,.94)';
      sheet.style.transform = '';
      setTimeout(function(){ sheet.style.transition = ''; }, 260);
    }
    drag = null;
  }

  document.addEventListener('pointerdown', onPointerDown);

  window.IOSSheet = { open: open, close: close, confirm: confirm };
})();
