
/* The cart panel: a piece added from its page or a tile, and the header's bag, open what the cart holds beside the page. */
(() => {
  'use strict';
  const panel = document.getElementById('lm-cart');
  if (!panel || !window.fetch || !window.FormData) return;
  const body = panel.querySelector('[data-lm-cart-body]');
  const status = panel.querySelector('.lm-cart__status');
  const closer = panel.querySelector('.lm-cart__close');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const shade = document.createElement('div');
  shade.className = 'lm-drawer-shade lm-cart-shade';
  shade.hidden = true;
  shade.setAttribute('aria-hidden', 'true');
  panel.before(shade);
  panel.tabIndex = -1;
  let nonce = '', opened = false, revision = 0, opener = null, pageState = [];
  const motion = new Map();
  const animate = (node, frames, duration) => {
    motion.get(node)?.cancel();
    if (reduced.matches || !node.animate) return null;
    const animation = node.animate(frames, { duration, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
    motion.set(node, animation);
    animation.finished.catch(() => {});
    return animation;
  };
  const send = async fields => {
    if (nonce && fields.has('lm_remove')) fields.set('nonce', nonce);
    const response = await fetch(panel.dataset.endpoint, { method: 'POST', credentials: 'same-origin', cache: 'no-store', body: fields });
    const result = await response.json();
    if (!response.ok || typeof result.html !== 'string') throw new Error(result.error || panel.dataset.failed);
    return result;
  };
  // The header's number follows the cart (shop.js paints it); after an added piece it gives one short beat.
  const show = (result, beat = false) => {
    body.innerHTML = result.html;
    nonce = result.nonce || '';
    document.dispatchEvent(new CustomEvent('lm:cart', { detail: { count: result.count } }));
    if (!beat || reduced.matches) return;
    document.querySelectorAll('[data-lm-count="cart"]').forEach(node => {
      node.classList.remove('is-beat');
      void node.offsetWidth;
      node.classList.add('is-beat');
    });
  };
  const isolate = () => {
    let active = panel;
    while (active.parentElement && active !== document.body) {
      for (const sibling of active.parentElement.children) {
        if (sibling === active || sibling === shade || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) continue;
        pageState.push([sibling, sibling.inert]);
        sibling.inert = true;
      }
      active = active.parentElement;
    }
  };
  const set = async (open, from = null) => {
    if (open === opened) return;
    const turn = ++revision;
    const fromTransform = panel.hidden ? 'translateX(100%)' : getComputedStyle(panel).transform;
    const fromOpacity = shade.hidden ? 0 : getComputedStyle(shade).opacity;
    opened = open;
    if (open) {
      opener = from || document.activeElement;
      if (!pageState.length) isolate();
      panel.hidden = shade.hidden = false;
      document.documentElement.classList.add('lm-locked');
      animate(shade, [{ opacity: fromOpacity }, { opacity: 1 }], 360);
      animate(panel, [{ transform: fromTransform }, { transform: 'translateX(0)' }], 460);
      panel.focus({ preventScroll: true });
      return;
    }
    animate(shade, [{ opacity: fromOpacity }, { opacity: 0 }], 220);
    const exit = animate(panel, [{ transform: fromTransform }, { transform: 'translateX(100%)' }], 260);
    if (exit) await exit.finished.catch(() => {});
    if (turn !== revision) return;
    panel.hidden = shade.hidden = true;
    motion.forEach(animation => animation.cancel()); motion.clear();
    pageState.forEach(([node, inert]) => { node.inert = inert; });
    pageState = [];
    document.documentElement.classList.remove('lm-locked');
    status.textContent = '';
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  };
  closer.addEventListener('click', () => set(false));
  shade.addEventListener('click', () => set(false));
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); set(false); return; }
    if (event.key !== 'Tab') return;
    const stops = [...panel.querySelectorAll('a[href]:not([tabindex="-1"]), button')].filter(node => node.offsetParent && !node.disabled);
    const first = stops[0], last = stops[stops.length - 1];
    if (!first) return;
    if (event.shiftKey && (document.activeElement === first || !stops.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  // The header's bag opens the panel at once and fills it with the cart as it is now; a failed request leads to the cart page.
  document.querySelectorAll('a[data-lm-cart]').forEach(link => link.addEventListener('click', async event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
    event.preventDefault();
    if (!body.childElementCount) body.innerHTML = '<p class="lm-cart__wait">Loading…</p>';
    set(true, link);
    try { show(await send(new FormData())); } catch { location.href = link.href; }
  }));
  panel.addEventListener('click', async event => {
    const remove = event.target.closest('[data-lm-remove]');
    // Marked busy, not disabled: a disabled button would drop the focus out of the panel.
    if (!remove || remove.getAttribute('aria-busy') === 'true') return;
    remove.setAttribute('aria-busy', 'true');
    const fields = new FormData(); fields.set('lm_remove', remove.dataset.lmRemove);
    try { const result = await send(fields); show(result); status.textContent = result.error; panel.focus({ preventScroll: true }); }
    catch (error) { status.textContent = error.message; remove.removeAttribute('aria-busy'); }
  });
  let busy = false;
  const add = async (fields, from) => {
    busy = true; from.setAttribute('aria-busy', 'true');
    try { return await send(fields); }
    finally { busy = false; from.removeAttribute('aria-busy'); }
  };
  // A tile's bag: an error is said in the panel beside what the cart already holds.
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-lm-add]');
    if (!button || busy) return;
    const fields = new FormData(); fields.set('lm_add', button.dataset.lmAdd);
    let result;
    try { result = await add(fields, button); }
    catch { location.href = button.closest('.product')?.querySelector('a[href]')?.href || location.href; return; }
    show(result, result.added);
    set(true, button);
    status.textContent = result.added ? panel.dataset.added : result.error;
  });
  // A piece's own form: the choice goes as the page would send it; an error stays under the form, where the choice is made.
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (event.defaultPrevented || !(form instanceof HTMLFormElement) || !form.matches('form.cart')) return;
    event.preventDefault();
    if (busy) return;
    const submitter = event.submitter;
    const fields = new FormData(form);
    const id = submitter?.name === 'add-to-cart' ? submitter.value : fields.get('add-to-cart') || form.querySelector('button[name="add-to-cart"]')?.value;
    fields.delete('add-to-cart'); fields.set('lm_add', id);
    let note = form.nextElementSibling?.classList.contains('lm-cart-note') ? form.nextElementSibling : null;
    let result;
    try { result = await add(fields, submitter || form); }
    catch {
      // Without an answer the page sends the form itself, as it would without script.
      if (!form.querySelector('[name="add-to-cart"]')) { const field = document.createElement('input'); field.type = 'hidden'; field.name = 'add-to-cart'; field.value = id; form.append(field); }
      form.submit();
      return;
    }
    if (!result.added) {
      if (!note) { note = document.createElement('p'); note.className = 'lm-feedback lm-cart-note'; note.setAttribute('role', 'status'); form.after(note); }
      note.textContent = result.error;
      return;
    }
    if (note) note.textContent = '';
    show(result, true);
    set(true, submitter);
    status.textContent = panel.dataset.added;
  });
})();
