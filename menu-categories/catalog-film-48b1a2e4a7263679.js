(() => {
  if (!('IntersectionObserver' in window)) return;
  document.querySelectorAll('[data-lm-catalog-film]').forEach(strip => {
    const video = strip.querySelector('video');
    const button = strip.querySelector('button');
    const poster = strip.querySelector('img');
    let clips = [];
    try { const parsed = JSON.parse(strip.dataset?.lmClips || '[]'); if (Array.isArray(parsed)) clips = parsed.filter(clip => clip?.src); } catch { /* Keep the single HTML-selected clip. */ }
    let turn = clips.length ? Math.max(0, Number(strip.dataset.lmStart) || 0) % clips.length : 0;
    video.loop = clips.length < 2;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false, paused = false, blocked = false, failed = false, pending = false, attempt = 0;
    const eligible = () => !reduced.matches && !navigator.connection?.saveData && !failed;
    const mayPlay = () => eligible() && visible && !document.hidden && !paused && !blocked;
    const state = () => {
      button.hidden = !eligible();
      button.setAttribute('aria-pressed', String(!video.paused));
      button.textContent = pending ? 'Скасувати відтворення' : video.paused ? 'Відтворити відео' : 'Призупинити відео';
      strip.classList.toggle('is-playing', !video.paused && !pending);
    };
    const stop = (unload = false) => {
      attempt++; pending = false; video.pause();
      if (unload && video.hasAttribute('src')) { video.removeAttribute('src'); video.load(); }
      state();
    };
    const reconcile = async () => {
      state();
      if (!mayPlay()) { stop(!eligible()); return; }
      if (pending || !video.paused) return;
      const token = ++attempt;
      pending = true; video.muted = true; state();
      if (!video.hasAttribute('src')) video.src = video.dataset.src;
      try {
        await video.play();
        if (token !== attempt) return;
        pending = false;
        if (!mayPlay()) stop(); else state();
      } catch { if (token === attempt) { blocked = true; stop(); } }
    };
    video.addEventListener('playing', () => { if (!mayPlay()) stop(); else { pending = false; state(); } });
    video.addEventListener('pause', state);
    video.addEventListener('error', () => { failed = true; stop(true); });
    video.addEventListener('ended', () => {
      if (clips.length < 2 || !mayPlay()) return;
      stop(true);
      turn = (turn + 1) % clips.length;
      const clip = clips[turn];
      video.dataset.src = clip.src;
      const position = `50% ${clip.focus || '50'}%`;
      video.style.objectPosition = position;
      if (poster) {
        // WordPress supplies responsive candidates for the initial cover only.
        poster.removeAttribute('srcset');
        poster.removeAttribute('sizes');
        poster.src = clip.poster;
        poster.style.objectPosition = position;
      }
      reconcile();
    });
    button.addEventListener('click', () => {
      if (!eligible()) return;
      if (pending || !video.paused) { paused = true; stop(); }
      else { paused = false; blocked = false; reconcile(); }
    });
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; reconcile(); }, { threshold: 0.1 }).observe(strip);
    document.addEventListener('visibilitychange', reconcile);
    reduced.addEventListener('change', reconcile);
    navigator.connection?.addEventListener?.('change', reconcile);
    addEventListener('pagehide', () => stop(true));
    addEventListener('pageshow', reconcile);
    state();
  });
})();
