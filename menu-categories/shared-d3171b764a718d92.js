
/* Header menu, search and the second photograph of a tile. */
(() => {
  'use strict';

  const drawer = document.getElementById('lm-drawer');
  const burger = document.querySelector('.lm-top__burger');
  if (drawer && burger) {
    const close = drawer.querySelector('.lm-drawer__close');
    const sections = [...drawer.querySelectorAll('[data-lm-nav-panel]')];
    const toggles = [...drawer.querySelectorAll('[data-lm-open-section]')];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    drawer.querySelectorAll('.lm-drawer__sections a, .lm-drawer__service a').forEach(link => {
      const text = [...link.childNodes].find(node => node.nodeType === 3 && node.textContent.trim());
      if (!text) return;
      const label = document.createElement('span');
      label.className = 'lm-drawer__label';
      label.textContent = text.textContent;
      text.replaceWith(label);
    });
    const shade = document.createElement('div');
    shade.className = 'lm-drawer-shade';
    shade.hidden = true;
    shade.setAttribute('aria-hidden', 'true');
    drawer.before(shade);
    drawer.tabIndex = -1;
    let opened = false, closing = false, revision = 0;
    const motion = new Map();
    let pageState = [], scrollState = null;
    const lockPage = () => {
      if (scrollState) return;
      const body = document.body;
      const properties = ['position', 'top', 'left', 'right', 'width'];
      scrollState = { x: window.scrollX, y: window.scrollY,
        styles: properties.map(name => [name, body.style.getPropertyValue(name), body.style.getPropertyPriority(name)]) };
      body.style.setProperty('position', 'fixed');
      body.style.setProperty('top', -scrollState.y + 'px');
      body.style.setProperty('left', '0');
      body.style.setProperty('right', '0');
      body.style.setProperty('width', '100%');
      document.documentElement.classList.add('lm-locked');
    };
    const unlockPage = () => {
      if (!scrollState) return;
      const saved = scrollState;
      scrollState = null;
      saved.styles.forEach(([name, value, priority]) => {
        if (value) document.body.style.setProperty(name, value, priority);
        else document.body.style.removeProperty(name);
      });
      document.documentElement.classList.remove('lm-locked');
      // Do not animate the document back from its fixed-body origin.
      window.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' });
    };
    const stopMotion = node => {
      if (node) { motion.get(node)?.cancel(); motion.delete(node); }
      else { motion.forEach(animation => animation.cancel()); motion.clear(); }
    };
    const animate = (node, frames, duration, hold = false) => {
      stopMotion(node);
      if (reduced.matches || !node.animate) return null;
      // Hold the last exit frame until the entire drawer is hidden: the backdrop
      // finishes first and must not flash back to its underlying opacity of 1.
      const animation = node.animate(frames, { duration, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
      motion.set(node, animation);
      if (!hold) animation.finished.then(() => {
        if (motion.get(node) === animation) stopMotion(node);
      }, () => {});
      else animation.finished.catch(() => {});
      return animation;
    };
    const fitDrawer = () => {
      // With a stable root gutter, CSS viewport units can exclude the gutter.
      // The modal and backdrop must still cover the complete visible screen.
      drawer.style.setProperty('--lm-menu-viewport-width', innerWidth + 'px');
      shade.style.width = innerWidth + 'px';
    };
    const focusView = view => { view.tabIndex = -1; view.focus({ preventScroll: true }); };
    const collapseSections = () => {
      sections.forEach(panel => { stopMotion(panel); panel.hidden = true; });
      toggles.forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
    };
    toggles.forEach(toggle => toggle.addEventListener('click', () => {
      const panel = sections.find(item => item.dataset.lmNavPanel === toggle.dataset.lmOpenSection);
      if (!panel || closing) return;
      const expand = panel.hidden;
      collapseSections();
      if (expand) {
        toggle.setAttribute('aria-expanded', 'true');
        panel.hidden = false;
        animate(panel, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'translateY(0)' }], 220);
      }
      // The trigger and the other groups remain in the same vertical menu.
      // Keep keyboard focus on the trigger so Tab reaches its first archive link.
      toggle.focus({ preventScroll: true });
      // Reveal only inside the drawer. scrollIntoView can also scroll the page
      // and Safari's toolbar, fighting the finger after a group collapses.
      const box = toggle.getBoundingClientRect();
      const bar = drawer.querySelector('.lm-drawer__bar');
      const upper = bar ? bar.getBoundingClientRect().bottom : drawer.getBoundingClientRect().top;
      const lower = drawer.getBoundingClientRect().bottom;
      if (box.top < upper) drawer.scrollTop += box.top - upper;
      else if (box.bottom > lower) drawer.scrollTop += box.bottom - lower;
    }));
    const isolate = () => {
      // Follow the ancestor chain too: static previews wrap the storefront in a div.
      let active = drawer;
      while (active.parentElement && active !== document.body) {
        for (const sibling of active.parentElement.children) {
          if (sibling === active || sibling === shade || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) continue;
          pageState.push([sibling, sibling.inert]);
          sibling.inert = true;
        }
        active = active.parentElement;
      }
    };
    const set = async open => {
      if (open === opened) return;
      const turn = ++revision;
      // Capture the rendered position before cancelling an interrupted entrance.
      // Content transitions never cancel the independent drawer/backdrop motion.
      const fromTransform = drawer.hidden ? 'translateX(-100%)' : getComputedStyle(drawer).transform;
      const fromOpacity = shade.hidden ? 0 : getComputedStyle(shade).opacity;
      opened = open;
      closing = !open;
      burger.setAttribute('aria-expanded', String(open));
      if (open) {
        fitDrawer();
        if (!pageState.length) isolate();
        drawer.hidden = shade.hidden = false;
        lockPage();
        animate(shade, [{ opacity: fromOpacity }, { opacity: 1 }], 360);
        animate(drawer, [{ transform: fromTransform }, { transform: 'translateX(0)' }], 460);
        focusView(drawer);
      } else {
        animate(shade, [{ opacity: fromOpacity }, { opacity: 0 }], 220, true);
        const exit = animate(drawer, [{ transform: fromTransform }, { transform: 'translateX(-100%)' }], 260, true);
        if (exit) await exit.finished.catch(() => {});
        if (turn !== revision) return;
        drawer.hidden = shade.hidden = true;
        stopMotion();
        collapseSections();
        drawer.scrollTop = 0;
        pageState.forEach(([node, inert]) => { node.inert = inert; });
        pageState = [];
        unlockPage();
        closing = false;
        burger.focus({ preventScroll: true });
      }
    };
    burger.addEventListener('click', () => set(!opened));
    close.addEventListener('click', () => set(false));
    shade.addEventListener('click', () => set(false));
    // A browser back/forward-cache restore must never revive an open, locked menu.
    addEventListener('pagehide', () => {
      ++revision;
      opened = closing = false;
      drawer.hidden = shade.hidden = true;
      stopMotion(); collapseSections(); drawer.scrollTop = 0;
      pageState.forEach(([node, inert]) => { node.inert = inert; });
      pageState = [];
      burger.setAttribute('aria-expanded', 'false');
      unlockPage();
    });
    drawer.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!closing) set(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const stops = [...drawer.querySelectorAll('a[href], button, input, summary')].filter(node => node.offsetParent && !node.disabled);
      const first = stops[0], last = stops[stops.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !stops.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    // The sections stay in the drawer at every width, as in the chosen reference.
    const top = document.querySelector('.lm-top');
    const fitNav = () => {
      if (!drawer.hidden) fitDrawer();
      if (top) top.dataset.lmNav = 'burger';
    };
    fitNav(); addEventListener('resize', fitNav); document.fonts?.ready.then(fitNav);
  }

  const search = document.querySelector('.lm-top__search');
  if (search) {
    search.addEventListener('toggle', () => { if (search.open) search.querySelector('input').focus(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && search.open) { search.open = false; search.querySelector('summary').focus(); }
    });
    document.addEventListener('click', event => { if (search.open && !search.contains(event.target)) search.open = false; });
  }

  // Front page films follow the owner's order, starting from the first film on every visit.
  // The photograph stays where motion is turned down or data is being saved.
  const plate = document.querySelector('[data-lm-films]');
  if (plate && !matchMedia('(prefers-reduced-motion: reduce)').matches && !navigator.connection?.saveData) {
    const films = JSON.parse(plate.dataset.lmFilms);
    let turn = 0;
    // The photograph is the resting state: a film covers it only once it is really playing,
    // and the film before it holds its last frame until the next one has started.
    let current = null, failed = 0;
    // The same picture in a newer encoding weighs a third as much; a browser that cannot play it gets the usual file.
    const probe = document.createElement('video');
    const playable = type => Boolean(probe.canPlayType?.(type));
    const source = film => (film.av1 && playable('video/mp4; codecs="av01.0.08M.08"')) ? film.av1
      : (film.hevc && playable('video/mp4; codecs="hvc1.1.6.L120.90"')) ? film.hevc : film.src;
    // Out of sight the film rests and the next one is not fetched; it carries on when the visitor comes back.
    let seen = true, waiting = false, newest = null;
    const resume = () => {
      if (!seen || document.hidden) { newest?.pause(); return; }
      if (waiting) { waiting = false; start(); return; }
      newest?.play().catch(() => {});
    };
    const next = () => {
      turn = (turn + 1) % films.length;
      if (!seen || document.hidden) { waiting = true; return; }
      start();
    };
    const start = () => {
      const film = films[turn];
      const chosen = source(film);
      const video = document.createElement('video');
      for (const name of ['muted', 'playsinline', 'autoplay']) video.setAttribute(name, '');
      video.muted = true;
      video.preload = 'auto';
      video.setAttribute('aria-hidden', 'true');
      video.tabIndex = -1;
      video.loop = films.length === 1;
      video.style.objectPosition = film.focus;
      video.addEventListener('playing', () => {
        failed = 0;
        video.classList.add('is-playing');
        const before = current;
        current = video;
        if (before && before !== video) setTimeout(() => before.remove(), 1200);
      }, { once: true });
      video.addEventListener('ended', next);
      video.addEventListener('error', () => {
        video.remove();
        // A lighter encoding the device turned down after all: the same film again in the usual file.
        if (chosen !== film.src) { film.av1 = film.hevc = ''; start(); return; }
        failed += 1;
        if (failed < films.length) { turn = (turn + 1) % films.length; start(); return; }
        // No film can be shown: the photograph returns.
        current?.classList.remove('is-playing');
      }, { once: true });
      video.src = chosen;
      newest = video;
      plate.append(video);
      // A refused autoplay (power saving) leaves the photograph; the first touch may start the film.
      // A pause while the film was still loading turns the promise down too, but that is no refusal.
      video.play().catch(error => {
        if (error?.name === 'NotAllowedError') addEventListener('pointerdown', () => { if (video === newest) resume(); }, { once: true });
      });
    };
    if (typeof IntersectionObserver === 'function') {
      new IntersectionObserver(entries => { seen = entries[entries.length - 1].isIntersecting; resume(); }).observe(plate);
    }
    document.addEventListener?.('visibilitychange', resume);
    start();
  }

  // New pieces stay still until the visitor turns them. The existing photo strip is independent.
  const arrivals = document.querySelector('.lm-arrivals');
  if (arrivals) {
    const track = arrivals.querySelector('.lm-arrivals__track');
    const controls = arrivals.querySelector('.lm-arrivals__controls');
    const dots = arrivals.querySelector('.lm-arrivals__dots');
    const prev = arrivals.querySelector('.lm-arrivals__prev');
    const next = arrivals.querySelector('.lm-arrivals__next');
    let pages = [0], current = 0, scheduled = false;
    const sync = () => {
      current = pages.reduce((best, left, i) => Math.abs(left - track.scrollLeft) < Math.abs(pages[best] - track.scrollLeft) ? i : best, 0);
      [...dots.children].forEach((button, i) => button.setAttribute('aria-current', String(i === current)));
      prev.disabled = current === 0;
      next.disabled = current === pages.length - 1;
    };
    const go = index => track.scrollTo({ left: pages[Math.max(0, Math.min(index, pages.length - 1))], behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    const measure = () => {
      const cards = [...track.children];
      const style = getComputedStyle(track);
      const gap = parseFloat(style.columnGap) || 0;
      const step = (cards[0]?.getBoundingClientRect().width || 1) + gap;
      const visible = Math.max(1, Math.floor((track.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) + gap + 1) / step));
      const end = Math.max(0, track.scrollWidth - track.clientWidth);
      pages = [0];
      for (let left = step * visible; left < end - 2; left += step * visible) pages.push(left);
      if (end > 2) pages.push(end);
      controls.hidden = end <= 2;
      if (dots.childElementCount !== pages.length) {
        dots.replaceChildren(...pages.map((_, i) => {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.setAttribute('aria-label', [i + 1, pages.length].reduce((out, value) => out.replace('%s', value), (window.lmStore?.i18n || {})['Новинки: сторінка %s з %s'] || 'Новинки: сторінка %s з %s'));
          dot.setAttribute('aria-controls', track.id);
          dot.addEventListener('click', () => go(i));
          return dot;
        }));
      }
      sync();
    };
    prev.addEventListener('click', () => go(current - 1));
    next.addEventListener('click', () => go(current + 1));
    track.addEventListener('keydown', event => {
      if (event.target !== track) return;
      const destination = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: pages.length - 1 }[event.key];
      if (destination !== undefined) { event.preventDefault(); go(destination); }
    });
    track.addEventListener('scroll', () => {
      if (!scheduled) { scheduled = true; requestAnimationFrame(() => { sync(); scheduled = false; }); }
    }, { passive: true });
    new ResizeObserver(measure).observe(track);
    measure();
  }

  // The strip of photographs moves on by one every few seconds, and starts again from the first.
  // It waits while out of view or under the pointer, and stops for good once the visitor moves it.
  const strip = document.querySelector('[data-lm-pace]');
  if (strip && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let seen = false;
    let taken = false;
    new IntersectionObserver(([entry]) => { seen = entry.isIntersecting; }, { threshold: .4 }).observe(strip);
    ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(name => strip.addEventListener(name, () => { taken = true; }, { passive: true }));
    const turn = setInterval(() => {
      if (taken) { clearInterval(turn); return; }
      if (!seen || document.hidden || strip.matches(':hover')) return;
      const step = strip.children[1].offsetLeft - strip.children[0].offsetLeft;
      const ended = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4;
      strip.scrollTo({ left: ended ? 0 : strip.scrollLeft + step, behavior: 'smooth' });
    }, Number(strip.dataset.lmPace) * 1000);
  }

  // «Назад до каталогу» returns to the very list the visitor came from, at the same place: a section, a type, a search.
  // From anywhere else — the cart, the front page, another piece or site, no referrer — the link leads to the piece's section,
  // and so it does once the page has moved to an anchor of its own (going back would only leave the anchor).
  const back = document.querySelector('[data-lm-back]');
  if (back) {
    let moved = false;
    addEventListener('hashchange', () => { moved = true; }, { once: true });
    const lists = (back.dataset.lmLists || '').split(' ').filter(Boolean);
    back.addEventListener('click', event => {
      // A click asking for a new tab or window keeps the browser's own way.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || moved || history.length < 2) return;
      let from;
      try { from = new URL(document.referrer); } catch { return; }
      const list = ['lm_metal', 'lm_section', 'lm_search', 'product_cat'].some(key => from.searchParams.has(key)) || lists.some(path => from.pathname.startsWith(path));
      // The admin's own product lists (filtered by a category, say) are not the shop's catalogue.
      if (from.origin !== location.origin || from.href === location.href || from.pathname.includes('/wp-admin/') || !list) return;
      event.preventDefault();
      history.back();
    });
  }

  // On a phone the front page line keeps to one row: it shrinks until it fits.
  const line = document.querySelector('.lm-hero h1');
  if (line) {
    const fit = () => {
      line.style.fontSize = '';
      line.style.whiteSpace = '';
      if (getComputedStyle(line).whiteSpace !== 'nowrap') return;
      let size = parseFloat(getComputedStyle(line).fontSize);
      while (size > 15 && line.scrollWidth > line.clientWidth) { size = Math.max(15, size - .5); line.style.fontSize = size + 'px'; }
      // At 15px a longer line goes onto a second row rather than off the screen.
      if (line.scrollWidth > line.clientWidth) line.style.whiteSpace = 'normal';
    };
    fit(); addEventListener('resize', fit); document.fonts?.ready.then(fit);
  }

  // The row of jewellery types scrolls sideways: a mark on its line shows how much of it is in view, and the open type starts in view.
  const row = document.querySelector('.lm-categories');
  if (row) {
    const meter = document.createElement('span');
    meter.className = 'lm-meter';
    meter.setAttribute('aria-hidden', 'true');
    row.after(meter);
    const draw = () => {
      const more = row.scrollWidth - row.clientWidth > 1;
      meter.hidden = !more;
      if (!more) return;
      meter.style.setProperty('--lm-meter-size', String(row.clientWidth / row.scrollWidth));
      meter.style.setProperty('--lm-meter-at', String(row.scrollLeft / row.scrollWidth));
    };
    const current = row.querySelector('[aria-current]');
    if (current) row.scrollLeft = Math.max(0, current.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft - (row.clientWidth - current.offsetWidth) / 2);
    row.addEventListener('scroll', draw, { passive: true });
    addEventListener('resize', draw);
    document.fonts?.ready.then(draw);
    draw();
  }

  // One variant leaves nothing to choose: show its value as text, and nothing at all for the placeholder.
  const selects = [...document.querySelectorAll('.variations select')];
  const single = selects.filter(select => [...select.options].filter(option => option.value).length === 1);
  for (const select of single) {
    const only = [...select.options].find(option => option.value);
    if (only.value === 'Стандартний') { select.closest('tr').hidden = true; continue; }
    const value = document.createElement('span');
    value.className = 'lm-single-value';
    value.textContent = only.textContent;
    select.hidden = true;
    select.after(value);
  }
  if (selects.length && single.length === selects.length) document.querySelector('.reset_variations')?.remove();

  // One image node per tile: fade out, swap a decoded source, fade back in.
  // A transparent or multiply-blended alternate must never expose a second angle underneath.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('li.product .lm-card-alt[data-src]').forEach(slot => {
      const card = slot.closest('li.product');
      const image = slot.parentElement.querySelector(':scope > img');
      if (!image) return;
      const original = Object.fromEntries(['src', 'srcset', 'sizes', 'class', 'style'].map(key => [key, image.getAttribute(key)]));
      const alternate = { src: slot.dataset.src, srcset: null, sizes: null,
        class: slot.dataset.lift ? 'lm-packshot' : null,
        style: slot.dataset.lift ? `filter:brightness(${slot.dataset.lift})` : null };
      let ready = false, requested = false, inside = false, showingAlt = false;
      let revision = 0, animation = null;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)');
      const fade = async (from, to, duration) => {
        if (reduced.matches || !image.animate) return;
        const effect = image.animate([{ opacity: from }, { opacity: to }], {
          duration, easing: 'ease-out', fill: 'both',
        });
        animation = effect;
        await effect.finished.catch(() => {});
      };
      const sync = async () => {
        const wanted = inside && ready;
        const turn = ++revision;
        const opacity = getComputedStyle(image).opacity;
        animation?.cancel();
        if (showingAlt !== wanted) {
          await fade(opacity, 0, 90);
          if (turn !== revision) return;
          const source = wanted ? alternate : original;
          // Remove stale responsive candidates before assigning the replacement src.
          for (const key of ['srcset', 'sizes', 'class', 'style', 'src']) {
            if (source[key] === null) image.removeAttribute(key);
            else image.setAttribute(key, source[key]);
          }
          showingAlt = wanted;
          animation?.cancel();
          await fade(0, 1, 150);
        } else {
          await fade(opacity, 1, 100);
        }
        if (turn === revision) { animation?.cancel(); animation = null; }
      };
      card.addEventListener('pointerenter', () => {
        inside = true;
        if (ready) { sync(); return; }
        if (requested) return;
        requested = true;
        const preload = new Image();
        preload.decoding = 'async';
        preload.onload = async () => {
          try { if (preload.decode) await preload.decode(); } catch { requested = false; return; }
          ready = true;
          if (inside) sync();
        };
        preload.onerror = () => { requested = false; };
        preload.src = alternate.src;
      });
      card.addEventListener('pointerleave', () => { inside = false; sync(); });
    });
  }
})();

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
      button.textContent = pending ? 'Cancel playback' : video.paused ? 'Play video' : 'Pause video';
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

(() => {
  const metalOf = text => {
    const name = text.trim().toLocaleLowerCase('uk').replace(/\s+/g, ' ');
    if (/^(біле|белое|white)( золото| gold)?$/.test(name)) return 'white';
    if (/^(жовте|желтое|жёлтое|yellow)( золото| gold)?$/.test(name)) return 'yellow';
    if (/^(червоне|рожеве|красное|розовое|rose|red|pink)( золото| gold)?$/.test(name)) return 'rose';
    return null;
  };
  document.querySelectorAll('.variations_form select').forEach(select => {
    const label = select.labels?.[0];
    if (!label || !/^(колір золота|цвет золота|gold colou?r)$/i.test(label.textContent.trim())) return;
    const original = select.cloneNode(true);
    const savedOptions = window.jQuery?.(select).data('attribute_html');
    if (typeof savedOptions === 'string') original.innerHTML = savedOptions;
    const choices = [...original.options].filter(option => option.value);
    if (!choices.length || choices.some(option => !metalOf(option.textContent))) return;
    const group = document.createElement('div');
    group.className = 'lm-metal-swatches';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label.textContent.trim());
    const selectedName = document.createElement('span');
    selectedName.className = 'lm-metal-swatches__name';
    selectedName.setAttribute('aria-live', 'polite');
    const buttons = choices.map(option => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lm-metal-swatch';
      button.dataset.metal = metalOf(option.textContent);
      button.dataset.value = option.value;
      button.setAttribute('aria-label', option.textContent.trim());
      button.title = option.textContent.trim();
      button.addEventListener('click', () => {
        if (button.disabled) return;
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        sync();
      });
      group.append(button);
      return button;
    });
    const sync = () => {
      buttons.forEach(button => {
        const option = [...select.options].find(item => item.value === button.dataset.value);
        button.disabled = select.disabled || !option || option.disabled;
        button.setAttribute('aria-pressed', String(select.value === button.dataset.value));
      });
      selectedName.textContent = choices.find(option => option.value === select.value)?.textContent.trim() || 'Choose a colour';
    };
    group.append(selectedName);
    select.after(group);
    select.hidden = true;
    // Keep WooCommerce's select as the source of values, availability and pricing.
    select.addEventListener('change', sync);
    select.form?.addEventListener('reset', () => setTimeout(sync, 0));
    if (window.jQuery) window.jQuery(select.closest('.variations_form')).on('woocommerce_update_variation_values found_variation reset_data', sync);
    label.addEventListener('click', event => {
      event.preventDefault();
      (buttons.find(button => !button.disabled && button.getAttribute('aria-pressed') === 'true') || buttons.find(button => !button.disabled))?.focus();
    });
    sync();
  });
})();

(() => {
  document.querySelectorAll('.variations_form').forEach(form => {
    const data = form.querySelector('[data-lm-metal-photos]');
    if (!data) return;
    let config;
    try { config = JSON.parse(data.dataset.lmMetalPhotos); } catch { return; }
    const select = [...form.querySelectorAll('select')].find(field => field.name === config.attribute);
    const product = form.closest('.product');
    const gallery = product?.querySelector('.woocommerce-product-gallery');
    const image = gallery?.querySelector('.wp-post-image');
    if (!select || !image || !config.photos) return;
    const original = Object.fromEntries(['src', 'srcset', 'sizes', 'alt', 'width', 'height', 'style'].map(key => [key, image.getAttribute(key)]));
    let frame, note, timer;
    const uncrop = () => {
      if (frame) { frame.replaceWith(image); frame = null; }
      if (note) { note.remove(); note = null; }
      if (original.style === null) image.removeAttribute('style'); else image.setAttribute('style', original.style);
    };
    const restore = () => {
      uncrop();
      for (const [key, value] of Object.entries(original)) {
        if (value === null) image.removeAttribute(key); else image.setAttribute(key, value);
      }
    };
    const update = () => {
      const photo = config.photos[select.value];
      if (!photo) { if (!window.jQuery) restore(); return; }
      // A complete WooCommerce choice owns its exact photo, price and availability.
      if (window.jQuery && form.querySelector('[name=variation_id]')?.value > 0) return;
      uncrop();
      if (window.jQuery?.fn?.wc_variations_image_update) {
        window.jQuery(form).wc_variations_image_update({ image: photo.image });
      } else {
        image.src = photo.image.src;
        for (const key of ['srcset', 'sizes']) {
          if (photo.image[key]) image.setAttribute(key, photo.image[key]); else image.removeAttribute(key);
        }
        image.alt = photo.image.alt || '';
        if (photo.image.src_w) image.setAttribute('width', photo.image.src_w);
        if (photo.image.src_h) image.setAttribute('height', photo.image.src_h);
      }
      // Only the approved static example supplies a crop; the source picture is never recoloured.
      if (photo.crop?.length === 6 && photo.crop.every(Number.isFinite)) {
        const [x, y, width, height, sheetWidth, sheetHeight] = photo.crop;
        if (width > 0 && height > 0 && x >= 0 && y >= 0 && x + width <= sheetWidth && y + height <= sheetHeight) {
          frame = document.createElement('span'); frame.className = 'lm-metal-photo-frame';
          image.replaceWith(frame); frame.append(image); frame.style.aspectRatio = `${width}/${height}`;
          Object.assign(image.style, { position:'absolute', width:`${sheetWidth / width * 100}%`, height:'auto', maxWidth:'none', maxHeight:'none', left:`${-x / width * 100}%`, top:`${-y / height * 100}%` });
        }
      }
      if (photo.caption) {
        note = document.createElement('p'); note.className = 'lm-metal-photo-note'; note.textContent = photo.caption;
        gallery.append(note);
      }
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(update, 0); };
    select.addEventListener('change', schedule);
    gallery.addEventListener('click', event => {
      if (event.target.tagName === 'IMG' && event.target !== image) uncrop();
    }, true);
    if (window.jQuery) {
      window.jQuery(form).on('reset_data woocommerce_update_variation_values', schedule)
        .on('found_variation', () => { clearTimeout(timer); uncrop(); });
    } else {
      form.querySelector('.reset_variations')?.addEventListener('click', event => {
        event.preventDefault();
        form.querySelectorAll('select').forEach(field => { field.value = ''; field.dispatchEvent(new Event('change', {bubbles:true})); });
      });
    }
    schedule();
  });
})();

