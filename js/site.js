(() => {
  'use strict';
  const ja = document.documentElement.lang === 'ja';
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => header.classList.toggle('scrolled', !entry.isIntersecting), { rootMargin: '-80px 0px 0px' }).observe(hero);
  } else header.classList.add('scrolled');

  // Selected work. The rail scrolls and the radio group selects a project
  // without any of this; the arrows and the deep link are enhancements.
  // Everything below this block depends on the deck's markup being there, so it
  // stays inert rather than throwing if the section is ever absent or empty.
  const deck = document.querySelector('.work-deck');
  const rail = deck && deck.querySelector('.deck-rail');
  const picks = rail ? [...rail.querySelectorAll('.case-pick')] : [];
  if (picks.length) {
    const arrows = [...deck.querySelectorAll('.deck-arrow')];
    const still = matchMedia('(prefers-reduced-motion: reduce)');
    const selected = () => Math.max(0, picks.findIndex(pick => pick.checked));
    const edges = () => {
      const room = rail.scrollWidth - rail.clientWidth;
      if (room < 8) { rail.removeAttribute('data-edge'); return; }
      const behind = rail.scrollLeft > 8;
      const ahead = rail.scrollLeft < room - 8;
      rail.dataset.edge = behind && ahead ? 'both' : behind ? 'start' : 'end';
    };
    const reveal = position => {
      const view = rail.getBoundingClientRect();
      const card = picks[position].closest('.case-card').getBoundingClientRect();
      // Leave a card that is already in full view where it is; nudging it would
      // shift everything else under a pointer that is about to click again.
      if (card.left < view.left - 1 || card.right > view.right + 1) {
        rail.scrollTo({ left: rail.scrollLeft + card.left - view.left, behavior: still.matches ? 'auto' : 'smooth' });
      }
      arrows.forEach(arrow => { arrow.disabled = arrow.dataset.deck === 'prev' ? position === 0 : position === picks.length - 1; });
    };
    picks.forEach((pick, position) => pick.addEventListener('change', () => { if (pick.checked) reveal(position); }));
    arrows.forEach(arrow => {
      arrow.hidden = false;
      arrow.addEventListener('click', () => {
        const next = selected() + (arrow.dataset.deck === 'prev' ? -1 : 1);
        if (next < 0 || next >= picks.length) return;
        picks[next].checked = true;
        reveal(next);
      });
    });
    rail.addEventListener('scroll', edges, { passive: true });
    addEventListener('resize', edges);
    const linked = picks.findIndex(pick => location.hash === `#work-${pick.value}`);
    if (linked > -1) {
      picks[linked].checked = true;
      // The panel was still hidden when the browser resolved the fragment, so it
      // had nothing to scroll to. Now that selecting has revealed it, go there.
      deck.querySelector(`.case-panel[data-case="${picks[linked].value}"]`).scrollIntoView();
    }
    reveal(selected());
    edges();
  }

  const form = document.querySelector('#contact-form');
  const topic = document.querySelector('#topic');
  document.querySelectorAll('[data-topic]').forEach(link => link.addEventListener('click', () => {
    topic.value = link.dataset.topic;
  }));
  const status = document.querySelector('#form-status');
  const button = form.querySelector('button[type="submit"]');
  const idleLabel = button.textContent;
  const endpoint = form.dataset.endpoint || '';
  const connected = /^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(endpoint);
  const copy = ja ? {
    offline: 'フォームは現在未接続です。入力内容は送信されません。',
    ready: '内容を確認して送信してください。',
    sending: '送信中…', success: 'お問い合わせを受け付けました。ありがとうございます。',
    failed: '送信できませんでした。入力内容は残っています。時間をおいてもう一度お試しください。'
  } : {
    offline: 'This form is not connected yet. Your message will not be sent.',
    ready: 'Review your message before sending.',
    sending: 'Sending…', success: 'Your message was received. Thank you for getting in touch.',
    failed: 'Your message could not be sent. Your text is still here. Please try again later.'
  };
  button.disabled = !connected;
  status.textContent = connected ? copy.ready : copy.offline;
  document.querySelector('#privacy-offline').hidden = connected;
  document.querySelector('#privacy-connected').hidden = !connected;
  let pending = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!connected) { status.textContent = copy.offline; return; }
    if (pending || !form.reportValidity()) return;
    pending = true;
    button.disabled = true;
    button.textContent = copy.sending;
    status.textContent = copy.sending;
    // Snapshot inputs before disabling them; prevent an in-flight edit being lost on success.
    const data = new FormData(form);
    const fields = [...form.querySelectorAll('input, textarea, select')];
    fields.forEach(field => { field.disabled = true; });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error('Submission rejected');
      status.textContent = copy.success;
      form.reset();
    } catch { status.textContent = copy.failed; }
    finally {
      clearTimeout(timeout);
      fields.forEach(field => { field.disabled = false; });
      button.disabled = false;
      button.textContent = idleLabel;
      pending = false;
    }
  });
})();
