(() => {
  'use strict';
  const ja = document.documentElement.lang === 'ja';
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => header.classList.toggle('scrolled', !entry.isIntersecting), { rootMargin: '-80px 0px 0px' }).observe(hero);
  } else header.classList.add('scrolled');

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
