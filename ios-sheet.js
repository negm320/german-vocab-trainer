/* ============================================================
   IOSSheet — shared bottom-sheet helper (dependency-free)
   Used by: top5k.html (phase 1). Reusable later for grammar/
   preps/ausdruck/chat sheets and confirm dialogs.

   API:
     IOSSheet.open(id)
     IOSSheet.close(id)
     IOSSheet.confirm(message, { title, confirmLabel, cancelLabel, danger, onConfirm })
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
    setTimeout(function(){
      el.classList.add('hidden');
      if(el.dataset.iosSheetTemp === '1') el.remove();
    }, 280);
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
    confirmBtn.addEventListener('click', function(){
      close(id);
      if(typeof opts.onConfirm === 'function') opts.onConfirm();
    });
    cancelBtn.addEventListener('click', function(){ close(id); });

    open(id);
  }

  window.IOSSheet = { open: open, close: close, confirm: confirm };
})();
