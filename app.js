(() => {
  const frame = document.querySelector('#page');
  const address = document.querySelector('#address');
  const form = document.querySelector('#address-form');
  const newTab = document.querySelector('#new-tab');
  const viewer = document.querySelector('#viewer');
  const status = document.querySelector('#load-status');
  const back = document.querySelector('#back');
  const forward = document.querySelector('#forward');
  const reload = document.querySelector('#reload');
  const external = document.querySelector('#open-external');
  const preview = document.querySelector('#preview');
  let entries;
  try { entries = JSON.parse(sessionStorage.getItem('orbit-history') || '[]'); }
  catch { entries = []; }
  if (!Array.isArray(entries)) entries = [];
  let cursor = Number(sessionStorage.getItem('orbit-cursor'));
  if (!Number.isInteger(cursor) || cursor >= entries.length) cursor = entries.length - 1;

  function save() { sessionStorage.setItem('orbit-history', JSON.stringify(entries)); sessionStorage.setItem('orbit-cursor', cursor); }
  function updateControls() { back.disabled = cursor <= 0; forward.disabled = cursor >= entries.length - 1; external.disabled = !entries[cursor]; }
  function normalise(value) {
    const text = value.trim();
    if (!text) return null;
    if (/^https?:\/\//i.test(text)) return text;
    if (/^[\w.-]+\.[a-z]{2,}(?::\d+)?(?:[/#?].*)?$/i.test(text) || /^localhost(?::\d+)?(?:[/#?].*)?$/i.test(text)) return `https://${text}`;
    return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
  }
  function show(url, addHistory = true) {
    if (!url) return;
    if (addHistory) { entries = entries.slice(0, cursor + 1); entries.push(url); cursor = entries.length - 1; save(); }
    address.value = url;
    newTab.hidden = true; viewer.hidden = false;
    status.classList.add('show');
    frame.src = url;
    updateControls();
  }
  // Let the browser perform a real navigation in a named tab. This works for sites
  // that refuse iframe embedding and is more reliable than a scripted popup.
  form.addEventListener('submit', event => {
    const url = normalise(address.value);
    if (!url) { event.preventDefault(); return; }
    form.action = url;
    address.value = url;
  });
  preview.addEventListener('click', () => show(normalise(address.value)));
  frame.addEventListener('load', () => status.classList.remove('show'));
  back.addEventListener('click', () => { if (cursor > 0) { cursor--; save(); show(entries[cursor], false); } });
  forward.addEventListener('click', () => { if (cursor < entries.length - 1) { cursor++; save(); show(entries[cursor], false); } });
  reload.addEventListener('click', () => { if (entries[cursor]) { status.classList.add('show'); frame.src = entries[cursor]; } });
  external.addEventListener('click', () => { if (entries[cursor]) window.open(entries[cursor], '_blank', 'noopener,noreferrer'); });
  document.addEventListener('keydown', event => {
    if (event.altKey && event.key === 'ArrowLeft') { event.preventDefault(); back.click(); }
    if (event.altKey && event.key === 'ArrowRight') { event.preventDefault(); forward.click(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') { event.preventDefault(); address.focus(); address.select(); }
  });
  if (entries[cursor]) show(entries[cursor], false); else updateControls();
})();
