/* Owner-assigned gold photographs. No colour filters or image recolouring in the browser. */
(() => {
  'use strict';
  document.querySelectorAll('[data-lm-lab-options]').forEach(group => {
    const gallery = group.closest('.product')?.querySelector('.woocommerce-product-gallery');
    const image = gallery?.querySelector('.wp-post-image');
    if (!image) return;
    if (group.dataset.lmLabPhotosReady === '1') return;
    group.dataset.lmLabPhotosReady = '1';
    let photos;
    try { photos = JSON.parse(group.dataset.photos || '{}'); } catch { photos = {}; }
    const link = image.closest('a');
    const slide = image.closest('.woocommerce-product-gallery__image');
    const thumb = gallery.querySelector('.flex-control-thumbs img');
    const note = group.querySelector('[data-lm-lab-photo-note]');
    const text = phrase => window.lmStore?.i18n?.[phrase] || phrase;
    const remember = (node, names) => Object.fromEntries(names.map(name => [name, node?.getAttribute(name) ?? null]));
    const original = remember(image, ['src','srcset','sizes','alt','width','height','style','data-src','data-large_image','data-large_image_width','data-large_image_height']);
    const originalLink = remember(link, ['href']);
    const originalSlide = remember(slide, ['data-thumb','data-thumb-alt','data-thumb-srcset','data-thumb-sizes']);
    const originalThumb = remember(thumb, ['src','srcset','sizes','alt']);
    let revision = 0, showingColour = false;
    const message = phrase => { if (note) note.textContent = phrase ? text(phrase) : ''; };
    const attributes = (node, values) => {
      if (!node) return;
      for (const [name, value] of Object.entries(values)) {
        if (value === null || value === undefined || value === '') node.removeAttribute(name);
        else node.setAttribute(name, String(value));
      }
    };
    const refreshZoom = () => {
      if (!window.jQuery) return;
      if (slide) window.jQuery(slide).trigger('zoom.destroy');
      const slider = window.jQuery(gallery).data('flexslider');
      if (slider) slider.flexAnimate(0);
      window.jQuery(gallery).trigger('woocommerce_gallery_init_zoom');
    };
    const restore = () => {
      revision++;
      attributes(image, original); attributes(link, originalLink);
      attributes(slide, originalSlide); attributes(thumb, originalThumb);
      showingColour = false; message(''); refreshZoom();
    };
    const select = () => {
      const colour = group.querySelector('[name="lab_gold"]:checked')?.value;
      if (!colour) { restore(); return; }
      const photo = photos?.[colour];
      if (!photo?.src) { restore(); message('Фото цього кольору ще готується.'); return; }
      const ticket = ++revision;
      const apply = () => {
        if (ticket !== revision) return;
        attributes(image, { src:photo.src, srcset:photo.srcset, sizes:photo.sizes,
          width:photo.width, height:photo.height, alt:photo.alt || original.alt,
          'data-src':photo.full || photo.src, 'data-large_image':photo.full || photo.src,
          'data-large_image_width':photo.fullWidth || photo.width, 'data-large_image_height':photo.fullHeight || photo.height });
        // Keep the original frame even if a newly uploaded file has a different aspect ratio.
        if (Number(original.width) > 0 && Number(original.height) > 0) {
          image.style.aspectRatio = `${original.width}/${original.height}`;
          image.style.objectFit = 'contain';
        }
        attributes(link, {href:photo.full || photo.src});
        attributes(slide, {'data-thumb':photo.thumb || photo.src, 'data-thumb-alt':photo.alt || original.alt, 'data-thumb-srcset':null, 'data-thumb-sizes':null});
        attributes(thumb, {src:photo.thumb || photo.src, srcset:null, sizes:null, alt:photo.alt || original.alt});
        showingColour = true;
        message(photo.visualisation ? 'Візуалізація відтінку золота. Фактичний колір може відрізнятися.' : '');
        refreshZoom();
      };
      if (image.getAttribute('src') === photo.src) { apply(); return; }
      message('Завантажуємо фото обраного кольору…');
      const preload = new Image();
      preload.onload = apply;
      preload.onerror = () => { if (ticket === revision) { restore(); message('Не вдалося завантажити фото кольору. Спробуйте обрати його ще раз.'); } };
      preload.src = photo.src;
    };
    group.addEventListener('change', event => { if (event.target.name === 'lab_gold') select(); });
    // Clicking the same colour again returns from an original gallery frame to its colour photo.
    group.addEventListener('click', event => {
      const input = event.target.closest('label')?.querySelector('[name="lab_gold"]');
      if (input?.checked && !showingColour) select();
    });
    group.querySelector('input')?.form?.addEventListener('reset', restore);
    gallery.addEventListener('click', event => {
      if (event.target.tagName === 'IMG' && event.target !== image) {
        restore(); message('Оригінальне фото зразка.');
      }
    }, true);
    select();
  });
})();
