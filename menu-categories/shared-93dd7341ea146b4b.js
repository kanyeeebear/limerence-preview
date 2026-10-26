
(() => {
  'use strict';
  const panel = document.getElementById('lm-cart');
  if (!panel) return;
  const T = JSON.parse(panel.dataset.lmPreviewText);
  const KEY = 'lm-preview-cart';
  // One cart for both languages: a line keeps its name in each language and its page without the en/ prefix.
  const lang = document.documentElement.lang === 'en' ? 'en' : 'uk';
  const root = new URL('./', document.baseURI).href;
  const pathOf = url => { try { const at = new URL(url, document.baseURI).href.split('#')[0]; return at.startsWith(root) ? at.slice(root.length).replace(/^en\//, '') : ''; } catch { return ''; } };
  const urlOf = line => line.path ? root + (lang === 'en' ? 'en/' : '') + line.path : '';
  const nameOf = line => (line.names && (line.names[lang] || line.names.uk)) || '';
  let kept = [];
  const load = () => { try { const lines = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(lines) ? lines : []; } catch { return kept; } };
  const save = lines => { kept = lines; try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch {} };
  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const money = amount => String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₴';
  const count = lines => lines.reduce((sum, line) => sum + line.qty, 0);
  const body = lines => {
    if (!lines.length) return `<p class="lm-cart__empty">${esc(T.empty)}</p><p class="lm-cart__empty-way"><a class="button" href="${esc(T.catalog)}">${esc(T.toCatalog)}</a></p>`;
    const items = lines.map(line => {
      const photo = `<img src="${esc(line.img)}" alt="">`, url = urlOf(line), name = nameOf(line);
      return '<li class="lm-cart__item">'
        + (url ? `<a class="lm-cart__photo" href="${esc(url)}" tabindex="-1" aria-hidden="true">${photo}</a>` : `<span class="lm-cart__photo">${photo}</span>`)
        + `<div class="lm-cart__info"><p class="lm-cart__name">${url ? `<a href="${esc(url)}">${esc(name)}</a>` : esc(name)}</p>`
        + (line.qty > 1 ? `<p class="lm-cart__qty">${esc(T.qty)} ${line.qty}</p>` : '')
        + `<button type="button" class="lm-cart__remove" data-lm-remove="${esc(line.key)}" aria-label="${esc(T.removeFrom + name)}">${esc(T.remove)}</button></div>`
        + `<p class="lm-cart__price">${money(line.price * line.qty)}</p></li>`;
    }).join('');
    const total = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
    return `<ul class="lm-cart__items">${items}</ul><div class="lm-cart__foot"><p class="lm-cart__sum"><span>${esc(T.sum)}</span><span>${money(total)}</span></p>`
      + `<p class="lm-cart__note">${esc(T.note)}</p><a class="button checkout-button lm-cart__checkout" href="#" data-off>${esc(T.checkout)}</a>`
      + `<a class="lm-cart__view" href="#" data-off>${esc(T.view)}</a></div>`;
  };
  const absolute = url => { try { return url ? new URL(url, document.baseURI).href : ''; } catch { return ''; } };
  const names = json => { try { return JSON.parse(json || '{}'); } catch { return {}; } };
  // A line is keyed by what the cart holds, the variant (or the piece without variants), whichever way it was added.
  // A tile's bag: its name, price and photograph as the tile shows them.
  const fromTile = button => {
    const tile = button.closest('li');
    const link = tile?.querySelector('a[href]:not([data-off])');
    return { key: 'i' + button.dataset.lmAdd, names: names(button.dataset.lmNames), price: Number(button.dataset.lmPrice), img: absolute(tile?.querySelector('.lm-card-media img')?.getAttribute('src')), path: link ? pathOf(link.getAttribute('href')) : '' };
  };
  // A piece's form: the chosen variant, at the price the page shows.
  const fromForm = (form, fields) => {
    let variants = [];
    try { variants = JSON.parse(form.dataset.lmVariants || '[]'); } catch {}
    const base = { names: names(form.dataset.lmNames), price: Number(form.dataset.lmPrice), img: absolute(form.dataset.lmImg), path: pathOf(location.href) };
    if (!variants.length) return form.dataset.lmBuyable === '1' ? { ...base, key: 'i' + form.dataset.lmProduct } : { error: T.gone };
    const keys = Object.keys(variants[0].attributes);
    if (keys.some(key => !fields.get(key))) return { error: T.choose };
    const chosen = variants.find(variant => keys.every(key => variant.attributes[key] === '' || variant.attributes[key] === fields.get(key)));
    if (!chosen || !chosen.buyable) return { error: T.gone };
    return { ...base, key: 'i' + chosen.id, names: chosen.names, price: chosen.price || base.price };
  };
  const real = window.fetch.bind(window);
  window.fetch = async (url, options = {}) => {
    if (url !== panel.dataset.endpoint) return real(url, options);
    const fields = options.body instanceof FormData ? options.body : new FormData();
    let lines = load();
    const answer = { added: false, error: '' };
    if (fields.has('lm_add')) {
      const id = String(fields.get('lm_add'));
      // A tile sends its id alone; a piece's form sends its quantity too.
      const tile = !fields.has('quantity') && document.querySelector(`[data-lm-add="${CSS.escape(id)}"]`);
      const form = !tile && [...document.querySelectorAll('form.cart[data-lm-product]')].find(item => item.dataset.lmProduct === id);
      const line = form ? fromForm(form, fields) : tile ? fromTile(tile) : { error: T.failed };
      if (line.error || !(line.price > 0)) answer.error = line.error || T.failed;
      else {
        const qty = Math.max(1, parseInt(fields.get('quantity'), 10) || 1);
        const same = lines.find(item => item.key === line.key);
        if (same) same.qty += qty; else lines.push({ ...line, qty });
        save(lines); answer.added = true;
      }
    } else if (fields.has('lm_remove')) {
      lines = lines.filter(item => item.key !== fields.get('lm_remove'));
      save(lines);
    }
    await new Promise(resolve => setTimeout(resolve, 180));
    return new Response(JSON.stringify({ ...answer, count: count(lines), html: body(lines), nonce: 'preview' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  // In the shop shop.js paints the header's number; the copy has no shop.js, so it is painted here the same way.
  const paint = value => document.querySelectorAll('[data-lm-count="cart"]').forEach(node => {
    const number = Math.max(0, Math.floor(Number(value)) || 0);
    node.textContent = number ? (number > 99 ? '99+' : String(number)) : ''; node.hidden = !number;
    const link = node.closest('a'); if (!link) return;
    if (link.dataset.lmLabel === undefined) link.dataset.lmLabel = link.getAttribute('aria-label') || '';
    link.setAttribute('aria-label', number ? `${link.dataset.lmLabel}: ${number}` : link.dataset.lmLabel);
  });
  document.addEventListener('lm:cart', event => paint(event.detail?.count));
  paint(count(load()));
  // A page brought back from the browser's history shows the cart as it is now, as shop.js does in the shop.
  addEventListener('pageshow', event => { if (event.persisted) paint(count(load())); });
})();
