/* ============================================================
   IOSDemo — run the whole app with no Gemini API key.

   Two jobs:
     1. Let someone open any screen without entering a key.
     2. Replace every AI-generated string with invented, plausible German
        placeholder content, so the app can be handed to a tester and still
        look and behave like the real thing.

   Each screen's fetch function short-circuits at the top with
   `if (IOSDemo.on) return IOSDemo.<something>(...)`. Everything here is
   canned data plus a small artificial delay so loading states still show.

   Turn on:  the "Ohne API testen" button on any API-key screen
   Turn off: Settings → the same key screen, or clear top5k_demo_mode
   ============================================================ */
(function () {
  const FLAG = 'top5k_demo_mode';

  const rand = arr => arr[Math.floor(Math.random() * arr.length)];
  // Cycle deterministically per session so a tester doesn't see the same
  // scenario twice in a row.
  let seq = 0;
  const next = arr => arr[seq++ % arr.length];
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  /* ── Chat: scenarios, replies, grading ── */
  const SCENARIOS = [
    {
      situation: 'Du bist in einer Bäckerei und möchtest für einen Geburtstag am Wochenende verschiedene Kuchen und Brötchen bestellen. Du sprichst mit der Verkäuferin über die Auswahl und den Abholtermin.',
      character: { name: 'Frau Wagner', role: 'Bäckereifachverkäuferin', manner: 'freundlich, aber etwas in Eile' },
      opening: 'Guten Tag! Was darf es denn sein?'
    },
    {
      situation: 'Dein Zug fällt aus und du stehst am Informationsschalter. Du willst wissen, wie du trotzdem heute noch nach Hamburg kommst und ob du das Geld zurückbekommst.',
      character: { name: 'Herr Brandt', role: 'Mitarbeiter am Info-Schalter', manner: 'ruhig und sachlich' },
      opening: 'Guten Tag, wie kann ich Ihnen helfen?'
    },
    {
      situation: 'Du hast eine Wohnung besichtigt und rufst den Vermieter an. Du möchtest wissen, ob Haustiere erlaubt sind und wann du einziehen könntest.',
      character: { name: 'Herr Özdemir', role: 'Vermieter', manner: 'gesprächig und locker' },
      opening: 'Ja bitte, Özdemir am Apparat?'
    },
    {
      situation: 'Du bringst eine Jacke zurück, weil der Reißverschluss nach zwei Wochen kaputtgegangen ist. Du hast den Kassenbon dabei und möchtest dein Geld zurück.',
      character: { name: 'Lena', role: 'Verkäuferin im Bekleidungsgeschäft', manner: 'höflich, aber zurückhaltend' },
      opening: 'Hallo! Kann ich Ihnen helfen?'
    },
    {
      situation: 'Du sitzt im Wartezimmer beim Arzt und kommst mit einer anderen Person ins Gespräch. Ihr redet über das Wetter und darüber, wie lange man hier immer warten muss.',
      character: { name: 'Frau Kellner', role: 'andere Patientin im Wartezimmer', manner: 'neugierig und redselig' },
      opening: 'Na, auch schon so lange hier?'
    }
  ];

  const REPLIES = [
    'Ah, verstehe. Das lässt sich bestimmt machen.',
    'Einen Moment bitte, ich schaue kurz nach.',
    'Das ist kein Problem. Wann bräuchten Sie es denn?',
    'Da muss ich Sie leider enttäuschen, das haben wir gerade nicht da.',
    'Klar, machen wir. Sonst noch etwas?',
    'Hmm, das ist ein bisschen ungewöhnlich, aber ich versuche es.',
    'Ja genau, so haben wir das hier immer gemacht.',
    'Kein Ding. Soll ich das gleich für Sie notieren?'
  ];

  const CLOSERS = [
    'Alles klar, dann machen wir das so. Schönen Tag noch!',
    'Super, dann sind wir uns einig. Bis dann!',
    'Gut, das war dann alles. Tschüss!'
  ];

  const DEMO_FEEDBACK_POOL = [
    { corrections: [{ original: 'ich habe gegangen', correction: 'ich bin gegangen', note: 'Movement verbs take "sein" in the Perfekt.' }],
      naturalness: [] },
    { corrections: [{ original: 'mit dem Auto fahren nach', correction: 'mit dem Auto nach … fahren', note: 'The destination comes before the verb at the end.' }],
      naturalness: [{ original: 'Das ist sehr gut für mich', better: 'Das passt mir gut', note: 'More idiomatic when agreeing to an arrangement.' }] },
    { corrections: [],
      naturalness: [{ original: 'Ich will das kaufen', better: 'Ich würde das gern nehmen', note: 'Softer and more natural in a shop.' }] }
  ];

  /* ── Grammar drills ── */
  const GRAMMAR_DRILLS = [
    { words: [ {w:'Ich',r:'other'},{w:'glaube,',r:'verb'},{w:'dass',r:'other'},{w:'er',r:'other'},{w:'den',r:'other'},{w:'Bus',r:'other'},{w:'verpasst',r:'verb'},{w:'hat.',r:'verb'} ],
      english: 'I think that he missed the bus.' },
    { words: [ {w:'Weil',r:'other'},{w:'es',r:'other'},{w:'stark',r:'other'},{w:'geregnet',r:'verb'},{w:'hat,',r:'verb'},{w:'sind',r:'verb'},{w:'wir',r:'other'},{w:'zu',r:'other'},{w:'Hause',r:'other'},{w:'geblieben.',r:'verb'} ],
      english: 'Because it rained heavily, we stayed home.' },
    { words: [ {w:'Ich',r:'other'},{w:'rufe',r:'verb'},{w:'dich',r:'other'},{w:'an,',r:'sep-prefix'},{w:'sobald',r:'other'},{w:'ich',r:'other'},{w:'angekommen',r:'verb'},{w:'bin.',r:'verb'} ],
      english: "I'll call you as soon as I've arrived." },
    { words: [ {w:'Gestern',r:'other'},{w:'wollte',r:'verb'},{w:'ich',r:'other'},{w:'dir',r:'other'},{w:'noch',r:'other'},{w:'schreiben,',r:'verb'},{w:'aber',r:'other'},{w:'ich',r:'other'},{w:'hatte',r:'verb'},{w:'keine',r:'other'},{w:'Zeit.',r:'other'} ],
      english: 'Yesterday I wanted to write to you, but I had no time.' },
    { words: [ {w:'Wenn',r:'other'},{w:'du',r:'other'},{w:'früher',r:'other'},{w:'losfährst,',r:'sep-prefix'},{w:'stehst',r:'verb'},{w:'du',r:'other'},{w:'nicht',r:'other'},{w:'im',r:'other'},{w:'Stau.',r:'other'} ],
      english: "If you leave earlier, you won't be stuck in traffic." }
  ];

  /* ── Preposition drills ── */
  const PREP_DRILLS = [
    { sentence: 'Es hängt ___ deiner Entscheidung ab.', gov: 'abhängen', govInSent: ['hängt','ab'], prep: 'von',
      gloss: 'It depends on your decision.', options: ['von','auf','über','mit'] },
    { sentence: 'Ich verlasse mich ___ dich.', gov: 'sich verlassen', govInSent: ['verlasse','mich'], prep: 'auf',
      gloss: 'I rely on you.', options: ['auf','an','für','zu'] },
    { sentence: 'Wir warten schon eine Stunde ___ den Bus.', gov: 'warten', govInSent: ['warten'], prep: 'auf',
      gloss: 'We have been waiting for the bus for an hour.', options: ['auf','nach','um','über'] },
    { sentence: 'Sie interessiert sich sehr ___ Geschichte.', gov: 'sich interessieren', govInSent: ['interessiert','sich'], prep: 'für',
      gloss: 'She is very interested in history.', options: ['für','an','auf','über'] },
    { sentence: 'Er hat sich ___ dem Lärm beschwert.', gov: 'sich beschweren', govInSent: ['hat','sich','beschwert'], prep: 'über',
      gloss: 'He complained about the noise.', options: ['über','von','mit','für'] }
  ];

  /* ── Ausdruck (free writing) ── */
  const TOPICS = [
    { topic: 'Erzähl von einem Tag, an dem alles schiefgegangen ist.', hints: ['Was ist zuerst passiert?','Wie hast du reagiert?','Was würdest du heute anders machen?'] },
    { topic: 'Beschreibe deinen Lieblingsort in deiner Stadt.', hints: ['Wie sieht es dort aus?','Wann gehst du hin?','Warum gefällt er dir?'] },
    { topic: 'Wie hat sich dein Alltag in den letzten Jahren verändert?', hints: ['Was war früher anders?','Was ist heute besser?','Was fehlt dir?'] },
    { topic: 'Ein Freund will Deutsch lernen. Was rätst du ihm?', hints: ['Womit sollte er anfangen?','Was war für dich schwer?','Was hat dir geholfen?'] }
  ];

  const AUSDRUCK_GRADE = {
    scores: { naturalness: 3, task: 4, range: 3, accuracy: 3, coherence: 4 },
    errors: [
      { original: 'Ich habe nach Hause gegangen', correction: 'Ich bin nach Hause gegangen', category: 'verb', note: 'Movement verbs form the Perfekt with "sein".' },
      { original: 'mit meine Freunde', correction: 'mit meinen Freunden', category: 'case', note: '"mit" takes the dative — plural adds -n.' },
      { original: 'Ich habe gedacht dass', correction: 'Ich habe gedacht, dass', category: 'spelling', note: 'A comma always precedes "dass".' }
    ],
    corrected: 'Gestern bin ich nach Hause gegangen und habe mich mit meinen Freunden getroffen. Ich hatte gedacht, dass wir ins Kino gehen, aber am Ende sind wir einfach spazieren gegangen. Das war eigentlich viel schöner.',
    stretch: {
      original: 'Das war eigentlich sehr gut.',
      better: 'Das war am Ende sogar viel schöner.',
      note: 'Adds a natural contrast instead of a flat evaluation.'
    }
  };

  window.IOSDemo = {
    get on() { try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; } },
    enable()  { try { localStorage.setItem(FLAG, '1'); } catch (e) {} },
    disable() { try { localStorage.removeItem(FLAG); } catch (e) {} },

    async scenario()      { await wait(700); return next(SCENARIOS); },
    async chatReply(turnCount, cap) {
      await wait(500 + Math.random() * 400);
      // Wrap the scene up near the turn cap so "scene end + grading" is
      // reachable in a demo instead of running forever.
      const ending = typeof turnCount === 'number' && typeof cap === 'number' && turnCount >= cap - 1;
      return { reply: ending ? rand(CLOSERS) : next(REPLIES), sceneComplete: ending };
    },
    async chatGrade(scene) {
      await wait(900);
      // Attach invented feedback to the learner's own turns only.
      const feedback = {};
      let n = 0;
      (scene?.turns || []).forEach((t, i) => {
        if (t.role !== 'user') return;
        const item = DEMO_FEEDBACK_POOL[n % DEMO_FEEDBACK_POOL.length];
        n++;
        if (!item.corrections.length && !item.naturalness.length) return;
        // Only mark spans that really occur, otherwise the highlighter no-ops.
        const corrections = item.corrections.filter(c => t.text.includes(c.original));
        const naturalness = item.naturalness.filter(c => t.text.includes(c.original));
        if (corrections.length || naturalness.length) feedback[i] = { corrections, naturalness };
      });
      return feedback;
    },

    /* grammar.html's fetchDrill doesn't just parse the model's JSON — it also
       derives `correct`, builds shuffled `pieces` and sets `_hasWords`. The
       demo bypasses that function, so it has to hand back the same finished
       shape or presentDrill() blows up on drill.pieces. */
    async grammarDrill() {
      await wait(600);
      const src = next(GRAMMAR_DRILLS);
      const cleaned = src.words.map(({ w, r }) => ({ w: w.trim(), r })).filter(x => x.w);
      const pieces = cleaned.map(({ w, r }) => ({ word: w, role: r }));
      for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
      }
      return {
        english: src.english,
        words: src.words,
        correct: cleaned.map(x => x.w).join(' '),
        pieces,
        _hasWords: true
      };
    },
    async prepDrill()     { await wait(600); return next(PREP_DRILLS); },
    async topic()         { await wait(600); return next(TOPICS); },
    async ausdruckGrade() { await wait(1100); return JSON.parse(JSON.stringify(AUSDRUCK_GRADE)); },

    /* Adds "Ohne API testen (Demo)" to whatever API-key screen the page has,
       so this doesn't need hand-wiring into five different markup blocks. */
    mountButton() {
      const card = document.querySelector('.iosSetupCard');
      if (!card || card.querySelector('.demoBtn')) return;
      const btn = document.createElement('button');
      btn.className = 'demoBtn';
      btn.type = 'button';
      btn.textContent = 'Ohne API testen (Demo)';
      btn.style.cssText = 'width:100%;margin-top:10px;padding:13px;background:transparent;border:1px solid var(--border-soft);color:var(--text);font-size:15px;border-radius:12px;font-family:var(--font-chrome);cursor:pointer;';
      btn.addEventListener('click', () => { window.IOSDemo.enable(); location.reload(); });
      const hint = document.createElement('p');
      hint.className = 'muted small';
      hint.style.cssText = 'margin-top:8px;text-align:center;line-height:1.45;';
      hint.textContent = 'Beispielinhalte statt echter KI — zum Ausprobieren ohne Schlüssel.';
      card.appendChild(btn);
      card.appendChild(hint);
    },

    /* Small persistent badge so a tester always knows the content is fake. */
    mountBadge() {
      if (!this.on || document.getElementById('demoBadge')) return;
      const b = document.createElement('button');
      b.id = 'demoBadge';
      b.type = 'button';
      b.textContent = 'DEMO';
      b.title = 'Demo-Modus beenden';
      b.style.cssText = 'position:fixed;top:calc(6px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);z-index:9500;background:rgba(255,159,10,.92);color:#000;font:600 10px/1 var(--font-chrome,sans-serif);letter-spacing:.08em;padding:4px 9px;border:none;border-radius:999px;cursor:pointer;';
      b.addEventListener('click', () => {
        if (confirm('Demo-Modus beenden und API-Schlüssel eingeben?')) { window.IOSDemo.disable(); location.reload(); }
      });
      document.body.appendChild(b);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.IOSDemo.mountButton();
    window.IOSDemo.mountBadge();
  });
})();
