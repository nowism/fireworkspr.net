(() => {
  const $ = (id) => document.getElementById(id);
  const q = $('q'), fCompany = $('f-company'), fYear = $('f-year'), fSort = $('f-sort');
  const results = $('results'), empty = $('empty');
  const selectAll = $('select-all'), countEl = $('count'), selCount = $('sel-count');
  const actionBtns = ['export-csv', 'export-json', 'copy-links', 'clear-sel'].map($);

  let all = [];
  let shown = [];
  const selected = new Set();

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const year = (r) => (r.date || '').slice(0, 4);
  const fmtDate = (d) => {
    if (!d) return 'Undated';
    const parts = d.split('-');
    if (parts.length === 3) return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    if (parts.length === 2) return new Date(d + '-01T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    return d;
  };
  const org = (r) => r.client && r.client !== r.company ? `${r.client} (via ${r.company})` : r.company;

  function highlight(text, terms) {
    let out = esc(text);
    for (const t of terms) {
      if (t.length < 2) continue;
      out = out.replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`);
    }
    return out;
  }

  function readState() {
    const p = new URLSearchParams(location.search);
    q.value = p.get('q') || '';
    fCompany.value = p.get('company') || '';
    fYear.value = p.get('year') || '';
    fSort.value = p.get('sort') || 'date-desc';
  }

  function writeState() {
    const p = new URLSearchParams();
    if (q.value) p.set('q', q.value);
    if (fCompany.value) p.set('company', fCompany.value);
    if (fYear.value) p.set('year', fYear.value);
    if (fSort.value !== 'date-desc') p.set('sort', fSort.value);
    const s = p.toString();
    history.replaceState(null, '', s ? `?${s}` : location.pathname);
  }

  function render() {
    const terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
    shown = all.filter((r) =>
      (!fCompany.value || r.company === fCompany.value) &&
      (!fYear.value || year(r) === fYear.value) &&
      terms.every((t) => r._hay.includes(t))
    );
    const s = fSort.value;
    shown.sort((a, b) =>
      s === 'title' ? a.title.localeCompare(b.title)
      : s === 'company' ? (a.client || a.company).localeCompare(b.client || b.company) || (b.date || '').localeCompare(a.date || '')
      : s === 'date-asc' ? (a.date || '9999').localeCompare(b.date || '9999')
      : (b.date || '').localeCompare(a.date || ''));

    results.innerHTML = shown.map((r) => `
      <tr class="result${selected.has(r.id) ? ' selected' : ''}" data-id="${esc(r.id)}">
        <td class="c-sel"><input type="checkbox" aria-label="Select: ${esc(r.title)}" ${selected.has(r.id) ? 'checked' : ''}></td>
        <td class="c-date">${esc(fmtDate(r.date))}</td>
        <td class="c-title">
          <button type="button" class="open">${highlight(r.title, terms)}</button>
          ${r.summary ? `<p class="summary">${highlight(r.summary, terms)}</p>` : ''}
        </td>
        <td class="c-org">${esc(r.client || r.company)}${r.client && r.client !== r.company ? `<span class="via">via ${esc(r.company)}</span>` : ''}</td>
        <td class="c-name">${esc(r.name_as_listed)}</td>
        <td class="c-links">
          ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">Original</a>` : ''}
          ${r.archive_url ? `<a href="${esc(r.archive_url)}" target="_blank" rel="noopener">Archive</a>` : ''}
        </td>
      </tr>`).join('');
    const sortState = { 'date-desc': ['date', 'descending'], 'date-asc': ['date', 'ascending'], title: ['title', 'ascending'], company: ['company', 'ascending'] }[s];
    document.querySelectorAll('.pr-table th .sort').forEach((btn) => {
      btn.closest('th').setAttribute('aria-sort', sortState && sortState[0] === btn.dataset.sort ? sortState[1] : 'none');
    });

    empty.hidden = shown.length > 0 || all.length === 0;
    countEl.textContent = shown.length === all.length ? `${all.length} releases` : `${shown.length} of ${all.length} releases`;
    if (all.length === 0) countEl.textContent = 'The archive is being compiled. Check back soon.';
    updateSelection();
    writeState();
  }

  function updateSelection() {
    const n = selected.size;
    selCount.textContent = `${n} selected`;
    actionBtns.forEach((b) => (b.disabled = n === 0));
    const shownSel = shown.filter((r) => selected.has(r.id)).length;
    selectAll.checked = shown.length > 0 && shownSel === shown.length;
    selectAll.indeterminate = shownSel > 0 && shownSel < shown.length;
  }

  function openReader(r) {
    $('r-meta').textContent = `${fmtDate(r.date)}, ${org(r)}`;
    $('r-title').textContent = r.title;
    $('r-links').innerHTML = [
      r.url && `<a href="${esc(r.url)}" target="_blank" rel="noopener">View original</a>`,
      r.archive_url && `<a href="${esc(r.archive_url)}" target="_blank" rel="noopener">Archived copy</a>`,
      r.source && `<span>Source: ${esc(r.source)}</span>`,
    ].filter(Boolean).join('');
    $('r-text').textContent = r.text || r.summary || 'Full text not stored. Use the links above to read the original.';
    $('reader').showModal();
    $('reader').scrollTop = 0;
  }

  function picked() { return all.filter((r) => selected.has(r.id)); }

  function download(name, type, data) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const cols = ['date', 'title', 'company', 'client', 'name_as_listed', 'role', 'url', 'archive_url', 'source', 'summary', 'text'];
  const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  $('export-csv').onclick = () => download('press-releases.csv', 'text/csv;charset=utf-8',
    '﻿' + [cols.join(','), ...picked().map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n'));
  $('export-json').onclick = () => download('press-releases.json', 'application/json',
    JSON.stringify(picked().map(({ _hay, ...r }) => r), null, 2));
  $('copy-links').onclick = async (e) => {
    const text = picked().map((r) => `${r.date || ''}  ${r.title}\n${r.url || r.archive_url || ''}`).join('\n\n');
    try { await navigator.clipboard.writeText(text); e.target.textContent = 'Copied!'; }
    catch { e.target.textContent = 'Copy failed'; }
    setTimeout(() => (e.target.textContent = 'Copy links'), 1500);
  };
  $('clear-sel').onclick = () => { selected.clear(); render(); };

  selectAll.onchange = () => {
    shown.forEach((r) => (selectAll.checked ? selected.add(r.id) : selected.delete(r.id)));
    render();
  };

  results.addEventListener('click', (e) => {
    const li = e.target.closest('.result');
    if (!li) return;
    const r = all.find((x) => x.id === li.dataset.id);
    if (e.target.matches('input[type="checkbox"]')) {
      e.target.checked ? selected.add(r.id) : selected.delete(r.id);
      li.classList.toggle('selected', e.target.checked);
      updateSelection();
    } else if (e.target.closest('button.open')) {
      openReader(r);
    }
  });

  document.querySelector('.pr-table thead')?.addEventListener('click', (e) => {
    const b = e.target.closest('.sort');
    if (!b) return;
    const k = b.dataset.sort;
    fSort.value = k === 'date' ? (fSort.value === 'date-desc' ? 'date-asc' : 'date-desc') : k;
    render();
  });

  $('reader').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

  let t;
  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 120); });
  [fCompany, fYear, fSort].forEach((el) => el.addEventListener('change', render));

  fetch('/press/releases.json')
    .then((r) => r.json())
    .then((data) => {
      all = (data.releases || []).map((r, i) => ({
        ...r,
        id: r.id || String(i),
        _hay: [r.title, r.company, r.client, r.summary, r.text, r.date, r.name_as_listed].join(' ').toLowerCase(),
      }));
      const companies = [...new Set(all.map((r) => r.company))].sort();
      fCompany.innerHTML += companies.map((c) => `<option>${esc(c)}</option>`).join('');
      const years = [...new Set(all.map(year).filter(Boolean))].sort().reverse();
      fYear.innerHTML += years.map((y) => `<option>${y}</option>`).join('');
      readState();
      render();
    })
    .catch(() => { countEl.textContent = 'Could not load the archive.'; });
})();
