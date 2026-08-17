/* ==========================================================================
   ui.js — Хуудас бүрийн render, drawer, форм, хүснэгт
   ========================================================================== */
(function (global) {
  'use strict';

  const S = () => global.CivicStore;
  const K = () => global.CivicConst;
  const AI = () => global.CivicAI;
  const C = () => global.CivicChart;
  const IO = () => global.CivicIO;

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (Math.round(n) || 0).toLocaleString('mn-MN');
  const pc = v => Math.round((v || 0) * 100) + '%';
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b style="color:var(--text)">$1</b>');

  let page = 'dashboard';

  /* ═══════════ Ерөнхий ═══════════ */

  function toast(msg, kind) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast on ' + (kind || '');
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.className = 'toast ' + (kind || ''); }, 3200);
  }

  function toggleSidebar() { $('sidebar').classList.toggle('on'); }

  function go(p) {
    page = p;
    document.querySelectorAll('.page').forEach(s => s.classList.toggle('active', s.dataset.page === p));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === p));
    $('sidebar').classList.remove('on');
    $('main').classList.toggle('nopad', p === 'map');
    render(p);
    if (p === 'map') { global.CivicMap.init(); global.CivicMap.invalidate(); }
    if (location.hash.slice(1) !== p) history.replaceState(null, '', '#' + p);
  }

  function render(p) {
    const fn = {
      dashboard: renderDashboard, households: renderHouseholds, citizens: renderCitizens,
      programs: renderPrograms, issues: renderIssues, ai: renderAi, strategy: renderStrategy,
      team: renderTeam, tasks: renderTasks, io: renderIo, settings: renderSettings
    }[p];
    if (fn) try { fn(); } catch (e) { console.error('render ' + p, e); toast('Дүрслэхэд алдаа: ' + e.message, 'err'); }
    badges();
  }
  function refresh() { render(page); if (page === 'map') global.CivicMap.refresh(); }

  function badges() {
    const d = S().db;
    $('bdg-hh').textContent = fmt(d.households.length);
    $('bdg-ct').textContent = fmt(d.citizens.length);
    $('bdg-is').textContent = fmt(d.issues.filter(i => i.status !== 'Шийдэгдсэн').length);
    $('bdg-st').textContent = fmt(d.staff.length);
    $('bdg-tk').textContent = fmt(d.tasks.filter(t => t.status !== 'Дууссан').length);
  }

  /* ═══════════ Drawer / Modal ═══════════ */

  function openDrawer(title, sub, body, foot) {
    $('drTitle').innerHTML = title;
    $('drSub').innerHTML = sub || '';
    $('drBody').innerHTML = body;
    $('drFoot').innerHTML = foot || '';
    $('drawer').classList.add('on');
    $('drawerBg').classList.add('on');
  }
  function closeDrawer() {
    $('drawer').classList.remove('on');
    $('drawerBg').classList.remove('on');
  }
  function openModal(title, body, foot) {
    $('mdTitle').innerHTML = title;
    $('mdBody').innerHTML = body;
    $('mdFoot').innerHTML = foot || '';
    $('modalBg').classList.add('on');
  }
  function closeModal() { $('modalBg').classList.remove('on'); }

  /* ═══════════ Тусламж ═══════════ */

  function supTag(v) {
    const s = K().SUPPORT[v] || K().SUPPORT[0];
    return '<span class="tag ' + s.cls + '">' + s.name + '</span>';
  }
  function segTag(seg) { return '<span class="tag ' + seg.cls + '">' + esc(seg.name) + '</span>'; }
  function kpi(o) {
    return '<div class="kpi">' +
      '<div class="kpi-lb">' + o.label + '</div><div class="kpi-v">' + o.value + '</div>' +
      (o.spark ? C().spark(o.spark, o.color) : '') +
      (o.note ? '<div class="kpi-d">' + o.note + '</div>' : '') + '</div>';
  }
  function opts(sel, items, all, keep) {
    const cur = keep === false ? '' : sel.value;
    sel.innerHTML = (all ? '<option value="">' + all + '</option>' : '') + items.map(i => {
      const v = (i && i.v !== undefined) ? i.v : i;
      const t = (i && i.t !== undefined) ? i.t : i;
      return '<option value="' + esc(v) + '">' + esc(t) + '</option>';
    }).join('');
    if (Array.from(sel.options).some(o => o.value === cur)) sel.value = cur;
  }
  function daysBetween(d) {
    if (!d) return null;
    return Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  }

  /* Хүснэгтийн хуудаслалт */
  const PG = {};
  function pager(id, total, per, onGo) {
    const st = PG[id] || (PG[id] = { p: 1, per: per });
    const pages = Math.max(1, Math.ceil(total / st.per));
    if (st.p > pages) st.p = pages;
    const from = total ? (st.p - 1) * st.per + 1 : 0;
    const to = Math.min(total, st.p * st.per);
    const el = $(id);
    if (!el) return st;
    el.innerHTML = '<span>' + fmt(total) + '-с ' + fmt(from) + '–' + fmt(to) + ' харуулж байна</span>' +
      '<div class="r"><button class="btn sm" data-pg="prev"' + (st.p <= 1 ? ' disabled' : '') + '>←</button>' +
      '<span style="padding:0 8px">' + st.p + ' / ' + pages + '</span>' +
      '<button class="btn sm" data-pg="next"' + (st.p >= pages ? ' disabled' : '') + '>→</button>' +
      '<select class="inp" style="padding:5px 24px 5px 9px;font-size:12px;margin-left:8px">' +
      [25, 50, 100, 250].map(n => '<option value="' + n + '"' + (n === st.per ? ' selected' : '') + '>' +
        n + ' мөр</option>').join('') + '</select></div>';
    el.querySelector('[data-pg="prev"]').onclick = () => { st.p--; onGo(); };
    el.querySelector('[data-pg="next"]').onclick = () => { st.p++; onGo(); };
    el.querySelector('select').onchange = e => { st.per = +e.target.value; st.p = 1; onGo(); };
    return st;
  }
  function slice(id, arr) {
    const st = PG[id] || (PG[id] = { p: 1, per: 50 });
    return arr.slice((st.p - 1) * st.per, st.p * st.per);
  }

  /* ═══════════ 1. ХЯНАЛТЫН САМБАР ═══════════ */

  function renderDashboard() {
    const st = S();
    const scope = $('dashScope').value;
    if ($('dashScope').options.length <= 1) opts($('dashScope'), st.districts(), 'Бүх дүүрэг');
    const rows = scope ? st.db.households.filter(h => h.district === scope) : st.db.households;
    const s = st.stats(rows);
    const tr = st.trend(12);

    $('dashKpis').innerHTML = [
      kpi({
        label: 'Бүртгэлтэй өрх', value: fmt(s.households), icon: '', color: '#0e6bff',
        tint: 'rgba(14,107,255,.25)', icbg: 'rgba(14,107,255,.16)',
        spark: tr.map(t => t.contacts),
        note: '<b>' + fmt(s.people) + '</b> иргэн · <b>' + fmt(s.voters) + '</b> сонгогч'
      }),
      kpi({
        label: 'Дэмжигч өрх', value: fmt(s.supporters), icon: '', color: '#0d8f63',
        tint: 'rgba(13,143,99,.22)', icbg: 'rgba(13,143,99,.15)',
        spark: tr.map(t => t.positive),
        note: '<b class="up">' + pc(s.supportRate) + '</b> нийт өрхийн'
      }),
      kpi({
        label: 'Дундаж дэмжих магадлал', value: pc(s.avgProb), icon: '', color: '#0e6bff',
        tint: 'rgba(61,125,255,.22)', icbg: 'rgba(61,125,255,.15)',
        spark: tr.map(t => Math.round(t.rate * 100)),
        note: ''
      }),
      kpi({
        label: 'Хамрагдалт', value: pc(s.coverage), icon: '', color: '#0e9fbc',
        tint: 'rgba(14,159,188,.2)', icbg: 'rgba(14,159,188,.14)',
        note: '<b>' + fmt(s.households - s.contacted) + '</b> өрхтэй хараахан холбогдоогүй'
      }),
      kpi({
        label: 'Шийдэгдээгүй гомдол', value: fmt(st.db.issues.filter(i => i.status !== 'Шийдэгдсэн' &&
          (!scope || i.district === scope)).length), icon: '', color: '#b07d06',
        tint: 'rgba(176,125,6,.2)', icbg: 'rgba(176,125,6,.14)',
        note: ''
      })
    ].join('');

    $('trendChart').innerHTML = C().areaChart([
      { name: 'Холбоо барилт', data: tr.map(t => t.contacts), color: '#0e6bff' },
      { name: 'Эерэг хариу', data: tr.map(t => t.positive), color: '#0d8f63', fill: false }
    ], { labels: tr.map(t => t.label), height: 250 });

    const items = [5, 4, 3, 2, 1, 0].map(k => ({
      name: K().SUPPORT[k].name, value: s.dist[k] || 0, color: K().SUPPORT[k].color
    }));
    $('supDonut').innerHTML = C().donut(items, fmt(s.households), 'нийт өрх', 190);
    $('supLegend').innerHTML = items.map(i =>
      '<div class="lg-row"><i class="dot" style="background:' + i.color + '"></i>' +
      '<span class="nm">' + esc(i.name) + '</span><span class="vl">' + fmt(i.value) + '</span>' +
      '<span class="pc">' + pc(i.value / Math.max(1, s.households)) + '</span></div>').join('');

    renderDistBars();
    $('distMetric').onchange = renderDistBars;

    const pr = AI().priority(rows, 6);
    $('dashPriority').innerHTML = pr.map((p, i) =>
      '<div class="prio" data-hh="' + p.h.id + '"><div class="rank">' + (i + 1) + '</div>' +
      '<div style="flex:1;min-width:0"><div class="nm">' + esc(p.h.head || p.h.code) + '</div>' +
      '<div class="ad">' + esc(p.h.district) + ' ' + p.h.khoroo + '-р хороо · ' +
      p.voters + ' сонгогч' + (p.openIssues ? ' · ' + p.openIssues + ' гомдол' : '') + '</div></div>' +
      '<div class="sc"><b style="color:' + p.s.segment.color + '">' + p.s.pct + '%</b>' +
      '<small>' + p.s.segment.name + '</small></div></div>').join('') ||
      '<div class="empty"><p>Дата алга</p></div>';
    $('dashPriority').querySelectorAll('[data-hh]').forEach(el =>
      el.onclick = () => openHousehold(el.dataset.hh));

    /* Багийн товч */
    const staff = st.db.staff.filter(x => x.active !== false).map(x =>
      Object.assign({ s: x }, st.staffKpi(x.id, 30)))
      .sort((a, b) => b.reached - a.reached).slice(0, 6);
    $('dashTeam').innerHTML =
      '<thead><tr><th>Гишүүн</th><th class="num">Хүрсэн</th><th class="num">Эерэг%</th>' +
      '<th style="width:130px">Зорилтын биелэлт</th></tr></thead><tbody>' +
      staff.map(x => '<tr><td><div style="display:flex;align-items:center;gap:9px">' +
        '<div class="avatar" style="width:26px;height:26px;flex:0 0 26px;font-size:10px">' +
        esc(initials(x.s.name)) + '</div><div><div style="font-weight:600">' + esc(x.s.name) + '</div>' +
        '<div style="font-size:11px;color:var(--text-mute)">' + esc(x.s.team) + '</div></div></div></td>' +
        '<td class="num">' + fmt(x.reached) + '</td>' +
        '<td class="num" style="color:' + (x.hitRate > .5 ? 'var(--green)' : 'var(--text-dim)') + '">' +
        pc(x.hitRate) + '</td>' +
        '<td>' + C().progress(x.targetPct, x.targetPct > .8 ? '#0d8f63' : '#0e6bff') + '</td></tr>').join('') +
      '</tbody>';

    /* Даалгавар */
    const ts = st.taskStats();
    $('taskMini').innerHTML = [
      ['Нээлттэй', ts.open, '#0e6bff'], ['Хугацаа хэтэрсэн', ts.overdue, '#d92549'],
      ['Өндөр ач холбогдол', ts.highOpen, '#b07d06'], ['Дууссан', ts.done, '#0d8f63']
    ].map(([l, v, c]) => '<div class="m"><div class="l">' + l + '</div>' +
      '<div class="v" style="color:' + c + '">' + fmt(v) + '</div></div>').join('');
    $('taskBars').innerHTML = C().hbars(ts.byStatus.map(x => ({
      name: x.status, value: x.n,
      color: { 'Хийгдэж буй': '#0e6bff', 'Хүлээгдэж буй': '#b07d06', 'Шалгуулж буй': '#e2701a', 'Дууссан': '#0d8f63' }[x.status]
    })));

    $('dashBrief').innerHTML = '<ul class="advice" style="margin:0">' +
      AI().briefing(rows, scope ? scope + ' дүүрэг' : 'Бүх тойрог')
        .map((l, i) => '<li><span class="n">' + (i + 1) + '</span><span>' + md(l) + '</span></li>').join('') +
      '</ul>';
  }

  function renderDistBars() {
    const m = $('distMetric').value;
    const rows = S().byDistrict();
    const lbl = {
      supportRate: v => pc(v), avgProb: v => pc(v), coverage: v => pc(v), households: v => fmt(v)
    }[m];
    $('distBars').innerHTML = C().hbars(rows.map(d => ({
      name: d.name, value: d[m], label: lbl(d[m]),
      color: m === 'households' ? '#0e6bff' :
        d[m] > .6 ? '#0d8f63' : d[m] > .45 ? '#5cb85c' : d[m] > .3 ? '#b07d06' : '#e2701a'
    })));
  }

  function initials(n) {
    return String(n || '?').replace(/[.\s]+/g, ' ').trim().split(' ')
      .map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  /* ═══════════ 2. ӨРХИЙН БҮРТГЭЛ ═══════════ */

  const HHF = { q: '', district: '', khoroo: '', support: '', party: '', staff: '', seg: '' };
  const HHSel = new Set();
  let hhSort = { k: 'code', dir: 1 };

  function renderHouseholds() {
    const st = S();
    if (!$('hhDist').dataset.f) {
      opts($('hhDist'), st.districts(), 'Бүх дүүрэг');
      opts($('hhSup'), [5, 4, 3, 2, 1, 0].map(k => ({ v: k, t: K().SUPPORT[k].name })), 'Бүх түвшин');
      opts($('hhParty'), K().PARTIES, 'Бүх нам');
      opts($('hhStaff'), st.db.staff.map(s => ({ v: s.id, t: s.name })), 'Бүх ухуулагч');
      opts($('hhSeg'), [['core', 'Бат бөх дэмжигч'], ['lean', 'Хазайсан дэмжигч'], ['swing', 'Эргэлзэгч'],
      ['soft-opp', 'Хазайсан эсрэг'], ['opp', 'Эсрэг']].map(x => ({ v: x[0], t: x[1] })), 'Бүх ангилал');
      $('hhDist').dataset.f = '1';
      const upd = () => { readHhFilters(); PG.hhPager && (PG.hhPager.p = 1); drawHh(); };
      ['hhDist', 'hhKhoroo', 'hhSup', 'hhParty', 'hhStaff', 'hhSeg'].forEach(id => $(id).onchange = () => {
        if (id === 'hhDist') opts($('hhKhoroo'), st.khoroosOf($('hhDist').value).map(k => ({ v: k, t: k + '-р хороо' })), 'Бүх хороо');
        upd();
      });
      let t; $('hhQ').oninput = () => { clearTimeout(t); t = setTimeout(upd, 220); };
      $('hhAdd').onclick = () => householdForm(null);
      $('hhImport').onclick = () => go('io');
      $('hhExport').onclick = () => { IO().exportAs('households-xlsx', currentHh()); toast('Excel татаж байна', 'ok'); };
      $('hhDelSel').onclick = deleteSelected;
      opts($('hhKhoroo'), st.khoroosOf('').map(k => ({ v: k, t: k + '-р хороо' })), 'Бүх хороо');
    }
    drawHh();
  }

  function readHhFilters() {
    HHF.q = $('hhQ').value; HHF.district = $('hhDist').value; HHF.khoroo = $('hhKhoroo').value;
    HHF.support = $('hhSup').value; HHF.party = $('hhParty').value;
    HHF.staff = $('hhStaff').value; HHF.seg = $('hhSeg').value;
  }

  function currentHh() {
    let rows = S().filter({
      q: HHF.q, district: HHF.district, khoroo: HHF.khoroo,
      support: HHF.support === '' ? null : HHF.support,
      party: HHF.party, staff: HHF.staff
    });
    if (HHF.seg) rows = rows.filter(h => AI().score(h).segment.key === HHF.seg);
    const k = hhSort.k, d = hhSort.dir;
    rows.sort((a, b) => {
      let va, vb;
      if (k === 'ai') { va = AI().score(a).prob; vb = AI().score(b).prob; }
      else if (k === 'khoroo') { va = a.district + String(a.khoroo).padStart(3, '0'); vb = b.district + String(b.khoroo).padStart(3, '0'); }
      else { va = a[k]; vb = b[k]; }
      if (va == null) va = ''; if (vb == null) vb = '';
      return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'mn')) * d;
    });
    return rows;
  }

  function drawHh() {
    const rows = currentHh();
    const st = S();
    $('hhSub').textContent = fmt(rows.length) + ' өрх · ' + fmt(st.stats(rows).people) + ' иргэн';
    const cols = [
      ['', ''], ['code', 'Код'], ['head', 'Өрхийн тэргүүн'], ['khoroo', 'Байршил'],
      ['family_size', 'Ам бүл'], ['support', 'Байр суурь'], ['ai', 'Дэмжих магадлал'],
      ['party', 'Нам'], ['assigned_to', 'Хариуцсан'], ['last_contact', 'Сүүлд'], ['', '']
    ];
    let html = '<thead><tr>' +
      '<th style="width:34px"><input type="checkbox" id="hhAll"></th>' +
      cols.slice(1, -1).map(c => '<th class="srt" data-k="' + c[0] + '">' + c[1] +
        (hhSort.k === c[0] ? (hhSort.dir > 0 ? ' ↑' : ' ↓') : '') + '</th>').join('') +
      '<th style="width:96px"></th></tr></thead><tbody>';

    const pageRows = slice('hhPager', rows);
    if (!pageRows.length) {
      html += '<tr><td colspan="11"><div class="tbl-empty">Илэрц олдсонгүй</div></td></tr>';
    }
    pageRows.forEach(function (h) {
      const s = AI().score(h);
      const dd = daysBetween(h.last_contact);
      html += '<tr' + (HHSel.has(h.id) ? ' class="sel"' : '') + '>' +
        '<td><input type="checkbox" class="hhchk" data-id="' + h.id + '"' + (HHSel.has(h.id) ? ' checked' : '') + '></td>' +
        '<td style="font-family:monospace;font-size:12px;color:var(--text-mute)">' + esc(h.code) + '</td>' +
        '<td><b style="cursor:pointer" class="hhopen" data-id="' + h.id + '">' + esc(h.head || '—') + '</b>' +
        '<div style="font-size:11px;color:var(--text-mute)">' + esc(h.street || '') + ' ' + esc(h.building || '') + '</div></td>' +
        '<td>' + esc(h.district) + '<div style="font-size:11px;color:var(--text-mute)">' + h.khoroo + '-р хороо</div></td>' +
        '<td class="num">' + (h.family_size || 0) + '</td>' +
        '<td>' + supTag(h.support) + '</td>' +
        '<td><div style="display:flex;align-items:center;gap:8px">' +
        '<b style="color:' + s.segment.color + ';min-width:36px">' + s.pct + '%</b>' +
        '<div class="bartrack" style="width:52px;height:6px"><div class="barfill" style="width:' +
        s.pct + '%;background:' + s.segment.color + '"></div></div></div>' +
        '<div style="font-size:10.5px;color:var(--text-mute)">' + esc(s.segment.name) + '</div></td>' +
        '<td><span class="tag t-gray">' + esc(h.party || '—') + '</span></td>' +
        '<td style="font-size:12px">' + esc(st.staffName(h.assigned_to)) + '</td>' +
        '<td style="font-size:12px;color:' + (dd == null ? 'var(--red)' : dd > 180 ? 'var(--yellow)' : 'var(--text-dim)') + '">' +
        (dd == null ? 'хэзээ ч' : dd + ' хоног') + '</td>' +
        '<td><div style="display:flex;gap:4px">' +
        '<button class="btn sm hhopen" data-id="' + h.id + '">Нээх</button>' +
        '<button class="btn sm hhmap" data-id="' + h.id + '">Зураг</button>' +
        '</div></td></tr>';
    });
    html += '</tbody>';
    $('hhTable').innerHTML = html;

    $('hhTable').querySelectorAll('.srt').forEach(th => th.onclick = () => {
      if (hhSort.k === th.dataset.k) hhSort.dir *= -1; else { hhSort.k = th.dataset.k; hhSort.dir = 1; }
      drawHh();
    });
    $('hhTable').querySelectorAll('.hhopen').forEach(b => b.onclick = () => openHousehold(b.dataset.id));
    $('hhTable').querySelectorAll('.hhmap').forEach(b => b.onclick = () =>
      global.CivicMap.focus(S().household(b.dataset.id)));
    $('hhTable').querySelectorAll('.hhchk').forEach(c => c.onchange = () => {
      if (c.checked) HHSel.add(c.dataset.id); else HHSel.delete(c.dataset.id);
      selBar(); c.closest('tr').classList.toggle('sel', c.checked);
    });
    const all = $('hhAll');
    if (all) all.onchange = () => {
      pageRows.forEach(h => all.checked ? HHSel.add(h.id) : HHSel.delete(h.id));
      drawHh(); selBar();
    };
    pager('hhPager', rows.length, 50, drawHh);
    selBar();
  }

  function selBar() {
    $('hhSelN').textContent = HHSel.size;
    $('hhDelSel').classList.toggle('hide', !HHSel.size || !S().can('delete'));
  }
  function deleteSelected() {
    const n = HHSel.size;
    confirmBox('Сонгосон ' + n + ' өрхийг устгах уу?',
      'Тухайн өрхийн иргэд, уулзалтын түүх, гомдол хамт устана. Буцаах боломжгүй.',
      () => { S().deleteMany(Array.from(HHSel)); HHSel.clear(); toast(n + ' өрх устгагдлаа', 'ok'); refresh(); });
  }

  /* ═══════════ Өрхийн дэлгэрэнгүй (drawer) ═══════════ */

  function openHousehold(id) {
    const st = S();
    const h = st.household(id);
    if (!h) return;
    const s = AI().score(h);
    const cits = st.citizensOf(id);
    const ints = st.interactionsOf(id);
    const iss = st.issuesOf(id);

    const body =
      /* AI */
      '<div class="aibox">' +
      '<div class="hd"><span style="color:#0e6bff">✦</span><b>Дэмжих магадлал</b>' +
      '<span class="tag ' + s.segment.cls + '">' + esc(s.segment.name) + '</span></div>' +
      '<div class="gauge">' + C().gauge(s.prob, s.segment.color, 96) +
      '<div><div class="gv" style="color:' + s.segment.color + '">' + s.pct + '%</div>' +
      '<div class="gl">дэмжих магадлал</div>' +
      '<div class="gc">Итгэлцэл ' + pc(s.conf) + ' · ' + (s.conf < .4 ? 'дата дутуу' : 'хангалттай дата') + '</div></div></div>' +
      '<div class="factors">' + s.factors.map(f => {
        const w = Math.min(50, Math.abs(f.contrib) / 2.5 * 50);
        const col = f.contrib >= 0 ? '#0d8f63' : '#d92549';
        return '<div class="fac"><span class="fn">' + esc(f.name) +
          ' <span style="color:var(--text-mute);font-size:11px">· ' + esc(f.label) + '</span></span>' +
          '<span class="fb"><i style="' + (f.contrib >= 0 ? 'left:50%;' : 'right:50%;left:auto;') +
          'width:' + w.toFixed(1) + '%;background:' + col + '"></i></span>' +
          '<span class="fv" style="color:' + col + '">' + (f.contrib >= 0 ? '+' : '') +
          f.contrib.toFixed(2) + '</span></div>';
      }).join('') + '</div>' +
      '<div class="advice"><div class="dsec-t" style="margin-bottom:10px">Зөвлөмж</div><ul style="margin:0">' +
      s.advice.map((a, i) => '<li><span class="n">' + (i + 1) + '</span><span>' + md(a) + '</span></li>').join('') +
      '</ul></div></div>' +

      /* Үндсэн мэдээлэл */
      '<div class="dsec" style="margin-top:22px"><div class="dsec-t">Үндсэн мэдээлэл</div>' +
      '<div class="kv">' +
      kvr('Код', h.code) + kvr('Өрхийн тэргүүн', h.head) +
      kvr('Хаяг', h.address) +
      kvr('Дүүрэг / хороо', h.district + ' · ' + h.khoroo + '-р хороо') +
      kvr('Гудамж / байр', [h.street, h.building, h.apartment].filter(Boolean).join(', ')) +
      kvr('Ам бүл', h.family_size + ' хүн') +
      kvr('Утас', h.phone ? '<a href="tel:' + esc(h.phone) + '">' + esc(h.phone) + '</a>' : '—') +
      kvr('Орон сууц', h.housing) + kvr('Орлого', h.income) +
      kvr('Байр суурь', supTag(h.support)) + kvr('Нам', h.party) +
      kvr('Хариуцсан', st.staffName(h.assigned_to)) +
      kvr('Сүүлд холбогдсон', h.last_contact ? h.last_contact + ' (' + daysBetween(h.last_contact) + ' хоног)' : 'хэзээ ч') +
      kvr('Координат', h.lat && h.lng ? (+h.lat).toFixed(5) + ', ' + (+h.lng).toFixed(5) : '—') +
      kvr('Шошго', (h.tags || []).length ? (h.tags || []).map(t => '<span class="chip">' + esc(t) + '</span>').join(' ') : '—') +
      kvr('Тэмдэглэл', h.notes || '—') +
      '</div></div>' +

      /* Хөтөлбөр */
      '<div class="dsec"><div class="dsec-t">Оролцсон төсөл хөтөлбөр</div>' +
      ((h.programs || []).length
        ? '<div class="chips">' + h.programs.map(p => '<span class="chip on">◎ ' + esc(st.programName(p)) + '</span>').join('') + '</div>'
        : '<div style="color:var(--text-mute);font-size:12.5px">Оролцоогүй — урих боломжтой</div>') + '</div>' +

      /* Иргэд */
      '<div class="dsec"><div class="dsec-t">Ам бүлийн гишүүд (' + cits.length + ')</div>' +
      (cits.length ? '<table class="tbl" style="font-size:12.5px"><tbody>' + cits.map(c =>
        '<tr><td style="padding-left:0"><b>' + esc(c.name) + '</b>' +
        '<div style="font-size:11px;color:var(--text-mute)">' + esc(c.relation || '') +
        (c.occupation ? ' · ' + esc(c.occupation) : '') + '</div></td>' +
        '<td style="font-size:12px">' + esc(c.gender || '') +
        (c.birth_year ? ' · ' + (new Date().getFullYear() - c.birth_year) + ' нас' : '') + '</td>' +
        '<td>' + (c.is_voter ? supTag(c.support) : '<span class="tag t-gray">эрхгүй</span>') + '</td>' +
        '<td style="text-align:right;padding-right:0"><button class="btn sm ctedit" data-id="' + c.id +
        '">✎</button></td></tr>').join('') + '</tbody></table>'
        : '<div style="color:var(--text-mute);font-size:12.5px">Бүртгэгдээгүй</div>') +
      '<button class="btn sm" id="ctAddBtn" style="margin-top:10px">+ Гишүүн нэмэх</button></div>' +

      /* Уулзалт */
      '<div class="dsec"><div class="dsec-t">Холбоо барилтын түүх (' + ints.length + ')</div>' +
      (ints.length ? ints.slice(0, 8).map(i =>
        '<div style="display:flex;gap:11px;padding:9px 0;border-bottom:1px solid var(--border-soft)">' +
        '<div style="flex:0 0 74px;font-size:11.5px;color:var(--text-mute)">' + esc(i.date) + '</div>' +
        '<div style="flex:1"><b style="font-size:12.5px">' + esc(i.type) + '</b>' +
        '<div style="font-size:11.5px;color:var(--text-mute)">' + esc(i.canvasser || '') + '</div></div>' +
        '<span class="tag ' + (i.result === 'Эерэг' ? 't-s5' : i.result === 'Сөрөг' || i.result === 'Татгалзсан' ? 't-s1' : 't-gray') +
        '">' + esc(i.result) + '</span></div>').join('')
        : '<div style="color:var(--text-mute);font-size:12.5px">Түүх алга</div>') +
      '<button class="btn sm" id="intAddBtn" style="margin-top:10px">+ Уулзалт бүртгэх</button></div>' +

      /* Гомдол */
      '<div class="dsec"><div class="dsec-t">Санал гомдол (' + iss.length + ')</div>' +
      (iss.length ? iss.map(i =>
        '<div style="display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--border-soft)">' +
        '<div style="flex:1"><b style="font-size:12.5px">' + esc(i.title) + '</b>' +
        '<div style="font-size:11.5px;color:var(--text-mute)">' + esc(i.category) + ' · ' + esc(i.date) + '</div></div>' +
        '<span class="tag ' + (i.status === 'Шийдэгдсэн' ? 't-s5' : i.status === 'Шинэ' ? 't-s3' : 't-blue') + '">' +
        esc(i.status) + '</span></div>').join('')
        : '<div style="color:var(--text-mute);font-size:12.5px">Гомдол алга</div>') +
      '<button class="btn sm" id="issAddBtn" style="margin-top:10px">+ Гомдол бүртгэх</button></div>';

    const foot = '<button class="btn" id="drMap">Зураг</button>' +
      (S().can('edit') ? '<button class="btn" id="drLoc">Байршил</button>' : '') +
      (S().can('edit') ? '<button class="btn primary" id="drEdit">Засах</button>' : '') +
      (S().can('delete') ? '<button class="btn danger" id="drDel" style="margin-left:auto">Устгах</button>' : '');

    openDrawer(esc(h.head || h.code), esc(h.address), body, foot);

    $('drMap').onclick = () => { closeDrawer(); global.CivicMap.focus(h); };
    if ($('drLoc')) $('drLoc').onclick = () => global.CivicMap.editLocation(h.id);
    if ($('drEdit')) $('drEdit').onclick = () => householdForm(h);
    if ($('drDel')) $('drDel').onclick = () => confirmBox('Энэ өрхийг устгах уу?',
      esc(h.head) + ' — иргэд, түүх, гомдол хамт устана.',
      () => { S().deleteHousehold(h.id); closeDrawer(); toast('Устгагдлаа', 'ok'); refresh(); });
    $('ctAddBtn').onclick = () => citizenForm(null, h.id);
    $('intAddBtn').onclick = () => interactionForm(h.id);
    $('issAddBtn').onclick = () => issueForm(null, h.id);
    $('drBody').querySelectorAll('.ctedit').forEach(b => b.onclick = () =>
      citizenForm(st.db.citizens.find(c => c.id === b.dataset.id), h.id));
  }

  function kvr(k, v) { return '<div class="k">' + k + '</div><div class="v">' + (v == null || v === '' ? '—' : v) + '</div>'; }

  /* ═══════════ Формууд ═══════════ */

  function fld(label, name, value, type, options) {
    if (type === 'select') {
      return '<div class="field"><label class="fl">' + label + '</label>' +
        '<select class="inp" name="' + name + '">' + options.map(o => {
          const v = (o && o.v !== undefined) ? o.v : o;
          const t = (o && o.t !== undefined) ? o.t : o;
          return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(t) + '</option>';
        }).join('') + '</select></div>';
    }
    if (type === 'textarea') {
      return '<div class="field"><label class="fl">' + label + '</label>' +
        '<textarea class="inp" name="' + name + '">' + esc(value || '') + '</textarea></div>';
    }
    return '<div class="field"><label class="fl">' + label + '</label>' +
      '<input class="inp" name="' + name + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '"></div>';
  }
  function formData() {
    const o = {};
    $('mdBody').querySelectorAll('[name]').forEach(el => {
      o[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return o;
  }

  function householdForm(h) {
    const st = S();
    const isNew = !h;
    h = h || { district: st.districts()[0] || '', khoroo: 1, support: 0, family_size: 1, party: 'Тодорхойгүй' };
    const body =
      '<div class="fgrid">' +
      fld('Өрхийн код', 'code', h.code) +
      fld('Өрхийн тэргүүн', 'head', h.head) +
      fld('Дүүрэг', 'district', h.district, 'select', st.districts().length ? st.districts() : K().DISTRICTS.map(d => d.name)) +
      fld('Хороо', 'khoroo', h.khoroo, 'number') +
      fld('Гудамж / хэсэг', 'street', h.street) +
      fld('Байр / хашаа', 'building', h.building) +
      fld('Тоот', 'apartment', h.apartment) +
      fld('Ам бүлийн тоо', 'family_size', h.family_size, 'number') +
      fld('Утас', 'phone', h.phone) +
      fld('Орон сууцны төрөл', 'housing', h.housing, 'select', [''].concat(K().HOUSING)) +
      fld('Орлогын түвшин', 'income', h.income, 'select', [''].concat(K().INCOME)) +
      fld('Байр суурь', 'support', h.support, 'select',
        [5, 4, 3, 2, 1, 0].map(k => ({ v: k, t: K().SUPPORT[k].name }))) +
      fld('Нам', 'party', h.party, 'select', K().PARTIES) +
      fld('Хариуцсан', 'assigned_to', h.assigned_to, 'select',
        [{ v: '', t: '— сонгох —' }].concat(st.db.staff.map(s => ({ v: s.id, t: s.name })))) +
      fld('Сүүлд холбогдсон', 'last_contact', h.last_contact, 'date') +
      fld('Өргөрөг', 'lat', h.lat, 'number') +
      fld('Уртраг', 'lng', h.lng, 'number') +
      fld('Шошго (таслалаар)', 'tags', (h.tags || []).join(', ')) +
      '</div>' +
      fld('Бүтэн хаяг', 'address', h.address) +
      fld('Тэмдэглэл', 'notes', h.notes, 'textarea') +
      '<div class="field"><label class="fl">Оролцсон хөтөлбөр</label><div class="chips" id="pgPick">' +
      st.db.programs.map(p => '<span class="chip pick' + ((h.programs || []).includes(p.id) ? ' on' : '') +
        '" data-pg="' + p.id + '">◎ ' + esc(p.name) + '</span>').join('') + '</div></div>';

    openModal(isNew ? 'Шинэ өрх бүртгэх' : 'Өрх засах', body,
      '<button class="btn" onclick="CivicUI.closeModal()">Болих</button>' +
      '<button class="btn primary" id="hhSave">Хадгалах</button>');

    const picked = new Set(h.programs || []);
    $('pgPick').querySelectorAll('[data-pg]').forEach(c => c.onclick = () => {
      const id = c.dataset.pg;
      if (picked.has(id)) { picked.delete(id); c.classList.remove('on'); }
      else { picked.add(id); c.classList.add('on'); }
    });

    $('hhSave').onclick = function () {
      const d = formData();
      const patch = {
        code: d.code.trim(), head: d.head.trim(), district: d.district,
        khoroo: +d.khoroo || 0, street: d.street.trim(), building: d.building.trim(),
        apartment: d.apartment.trim(), family_size: +d.family_size || 1, phone: d.phone.trim(),
        housing: d.housing, income: d.income, support: +d.support, party: d.party,
        assigned_to: d.assigned_to, last_contact: d.last_contact,
        lat: d.lat === '' ? null : +d.lat, lng: d.lng === '' ? null : +d.lng,
        tags: d.tags.split(',').map(s => s.trim()).filter(Boolean),
        address: d.address.trim() || (d.district + ' дүүрэг, ' + d.khoroo + '-р хороо, ' + d.street),
        notes: d.notes.trim(), programs: Array.from(picked)
      };
      if (!patch.head && !patch.code) return toast('Нэр эсвэл код оруулна уу', 'err');
      if (patch.lat == null || patch.lng == null || isNaN(patch.lat)) {
        const d2 = K().DISTRICTS.find(x => x.name === patch.district) || K().DISTRICTS[0];
        const rr = K().prng((patch.khoroo || 1) * 7919 + Date.now() % 9973);
        const ang = rr() * Math.PI * 2, rad = Math.sqrt(rr()) * d2.r * 0.8;
        patch.lat = +(d2.lat + Math.cos(ang) * rad * .62).toFixed(6);
        patch.lng = +(d2.lng + Math.sin(ang) * rad).toFixed(6);
      }
      if (isNew) { const nh = S().addHousehold(patch); toast('Өрх нэмэгдлээ', 'ok'); closeModal(); refresh(); openHousehold(nh.id); }
      else { S().updateHousehold(h.id, patch); toast('Хадгалагдлаа', 'ok'); closeModal(); refresh(); openHousehold(h.id); }
    };
  }

  function citizenForm(c, hid) {
    const isNew = !c;
    c = c || { household_id: hid, gender: 'Эр', support: 0 };
    const body = '<div class="fgrid">' +
      fld('Нэр', 'name', c.name) +
      fld('Хүйс', 'gender', c.gender, 'select', ['Эр', 'Эм']) +
      fld('Төрсөн он', 'birth_year', c.birth_year, 'number') +
      fld('Хамаарал', 'relation', c.relation, 'select',
        ['Өрхийн тэргүүн', 'Эхнэр/нөхөр', 'Хүү', 'Охин', 'Эцэг/эх', 'Хамаатан', 'Бусад']) +
      fld('Боловсрол', 'education', c.education, 'select', [''].concat(K().EDU)) +
      fld('Мэргэжил / ажил', 'occupation', c.occupation) +
      fld('Утас', 'phone', c.phone) +
      fld('Байр суурь', 'support', c.support, 'select', [5, 4, 3, 2, 1, 0].map(k => ({ v: k, t: K().SUPPORT[k].name }))) +
      fld('Нам', 'party', c.party, 'select', K().PARTIES) +
      '</div>' + fld('Тэмдэглэл', 'notes', c.notes, 'textarea');
    openModal(isNew ? 'Гишүүн нэмэх' : 'Гишүүн засах', body,
      (isNew ? '' : '<button class="btn danger" id="ctDel" style="margin-right:auto">Устгах</button>') +
      '<button class="btn" onclick="CivicUI.closeModal()">Болих</button>' +
      '<button class="btn primary" id="ctSave">Хадгалах</button>');
    $('ctSave').onclick = () => {
      const d = formData();
      const by = +d.birth_year || null;
      const patch = {
        household_id: c.household_id || hid, name: d.name.trim(), gender: d.gender,
        birth_year: by, is_voter: by ? (new Date().getFullYear() - by) >= 18 : true,
        relation: d.relation, education: d.education, occupation: d.occupation.trim(),
        phone: d.phone.trim(), support: +d.support, party: d.party, notes: d.notes.trim()
      };
      if (!patch.name) return toast('Нэр оруулна уу', 'err');
      if (isNew) S().addCitizen(patch); else S().updateCitizen(c.id, patch);
      closeModal(); toast('Хадгалагдлаа', 'ok'); refresh(); openHousehold(patch.household_id);
    };
    if ($('ctDel')) $('ctDel').onclick = () => {
      S().deleteCitizen(c.id); closeModal(); toast('Устгагдлаа', 'ok'); refresh(); openHousehold(c.household_id);
    };
  }

  function interactionForm(hid) {
    const st = S();
    const body = '<div class="fgrid">' +
      fld('Огноо', 'date', K().today(), 'date') +
      fld('Төрөл', 'type', 'Хаалга тогших', 'select', K().CONTACT_TYPES) +
      fld('Ухуулагч', 'staff_id', (st.household(hid) || {}).assigned_to, 'select',
        st.db.staff.map(s => ({ v: s.id, t: s.name }))) +
      fld('Үр дүн', 'result', 'Эерэг', 'select', ['Эерэг', 'Саармаг', 'Сөрөг', 'Гэрт байгаагүй', 'Татгалзсан']) +
      '</div>' + fld('Тэмдэглэл', 'note', '', 'textarea') +
      '<div class="field"><label class="fl">Уулзалтын дараах байр суурь (шинэчлэх)</label>' +
      '<select class="inp" name="newSupport"><option value="">— өөрчлөхгүй —</option>' +
      [5, 4, 3, 2, 1, 0].map(k => '<option value="' + k + '">' + K().SUPPORT[k].name + '</option>').join('') +
      '</select></div>';
    openModal('Уулзалт бүртгэх', body,
      '<button class="btn" onclick="CivicUI.closeModal()">Болих</button>' +
      '<button class="btn primary" id="inSave">Бүртгэх</button>');
    $('inSave').onclick = () => {
      const d = formData();
      S().addInteraction({
        household_id: hid, date: d.date, type: d.type, staff_id: d.staff_id,
        canvasser: S().staffName(d.staff_id), result: d.result, note: d.note.trim()
      });
      if (d.newSupport !== '') S().updateHousehold(hid, { support: +d.newSupport, verified: true });
      closeModal(); toast('Уулзалт бүртгэгдлээ', 'ok'); refresh(); openHousehold(hid);
    };
  }

  function issueForm(i, hid) {
    const st = S();
    const isNew = !i;
    const h = st.household(hid || (i || {}).household_id) || {};
    i = i || { category: K().ISSUE_CATS[0], priority: 'Дунд', status: 'Шинэ', date: K().today() };
    const body = '<div class="fgrid">' +
      fld('Гарчиг', 'title', i.title) +
      fld('Ангилал', 'category', i.category, 'select', K().ISSUE_CATS) +
      fld('Ач холбогдол', 'priority', i.priority, 'select', ['Өндөр', 'Дунд', 'Бага']) +
      fld('Төлөв', 'status', i.status, 'select', ['Шинэ', 'Хүлээгдэж буй', 'Шийдэгдсэн']) +
      fld('Огноо', 'date', i.date, 'date') +
      '</div>' + fld('Тэмдэглэл', 'note', i.note, 'textarea');
    openModal(isNew ? 'Гомдол бүртгэх' : 'Гомдол засах', body,
      (isNew ? '' : '<button class="btn danger" id="isDel" style="margin-right:auto">Устгах</button>') +
      '<button class="btn" onclick="CivicUI.closeModal()">Болих</button>' +
      '<button class="btn primary" id="isSave">Хадгалах</button>');
    $('isSave').onclick = () => {
      const d = formData();
      const patch = {
        household_id: hid || i.household_id, district: h.district, khoroo: h.khoroo,
        title: d.title.trim(), category: d.category, priority: d.priority,
        status: d.status, date: d.date, note: d.note.trim()
      };
      if (!patch.title) return toast('Гарчиг оруулна уу', 'err');
      if (isNew) S().addIssue(patch); else S().updateIssue(i.id, patch);
      closeModal(); toast('Хадгалагдлаа', 'ok'); refresh();
      if (patch.household_id && page !== 'issues') openHousehold(patch.household_id);
    };
    if ($('isDel')) $('isDel').onclick = () => { S().deleteIssue(i.id); closeModal(); toast('Устгагдлаа', 'ok'); refresh(); };
  }

  function confirmBox(title, text, onYes) {
    openModal(title, '<p style="font-size:13.5px;line-height:1.7;color:var(--text-dim)">' + text + '</p>',
      '<button class="btn" onclick="CivicUI.closeModal()">Болих</button>' +
      '<button class="btn danger" id="cfYes">Тийм, үргэлжлүүлэх</button>');
    $('cfYes').onclick = () => { closeModal(); onYes(); };
  }

  /* ═══════════ 3. ИРГЭД ═══════════ */

  function renderCitizens() {
    const st = S();
    if (!$('ctDist').dataset.f) {
      opts($('ctDist'), st.districts(), 'Бүх дүүрэг');
      opts($('ctSup'), [5, 4, 3, 2, 1, 0].map(k => ({ v: k, t: K().SUPPORT[k].name })), 'Бүх түвшин');
      $('ctDist').dataset.f = '1';
      ['ctDist', 'ctGender', 'ctAge', 'ctSup'].forEach(id => $(id).onchange = drawCt);
      let t; $('ctQ').oninput = () => { clearTimeout(t); t = setTimeout(drawCt, 220); };
      $('ctExport').onclick = () => { IO().exportAs('citizens-xlsx'); toast('Excel татаж байна', 'ok'); };
      $('ctImport').onclick = () => go('io');
    }
    drawCt();
  }

  function drawCt() {
    const st = S();
    const hmap = new Map(st.db.households.map(h => [h.id, h]));
    const q = $('ctQ').value.trim().toLowerCase();
    const dist = $('ctDist').value, g = $('ctGender').value, age = $('ctAge').value, sup = $('ctSup').value;
    const yr = new Date().getFullYear();
    let rows = st.db.citizens.filter(function (c) {
      const h = hmap.get(c.household_id);
      if (dist && (!h || h.district !== dist)) return false;
      if (g && c.gender !== g) return false;
      if (sup !== '' && +c.support !== +sup) return false;
      if (age) {
        const [a, b] = age.split('-').map(Number);
        const n = c.birth_year ? yr - c.birth_year : -1;
        if (n < a || n > b) return false;
      }
      if (q && (c.name || '').toLowerCase().indexOf(q) < 0 && (c.phone || '').indexOf(q) < 0
        && (!h || (h.address || '').toLowerCase().indexOf(q) < 0)) return false;
      return true;
    });

    const voters = rows.filter(c => c.is_voter);
    const male = voters.filter(c => c.gender === 'Эр').length;
    $('ctSub').textContent = fmt(rows.length) + ' иргэн · ' + fmt(voters.length) + ' сонгуулийн эрхтэй';
    $('ctStats').innerHTML = [
      ['Сонгогч', fmt(voters.length), '#0e6bff'],
      ['Эр / Эм', male + ' / ' + (voters.length - male), '#0e6bff'],
      ['Дундаж нас', voters.length ? Math.round(voters.reduce((s, c) => s + (c.birth_year ? yr - c.birth_year : 0), 0) / voters.length) : 0, '#0e9fbc']
    ].map(([l, v, c]) => '<div class="card"><div class="kpi-lb">' + l + '</div>' +
      '<div class="kpi-v" style="color:' + c + '">' + v + '</div></div>').join('');

    const pageRows = slice('ctPager', rows);
    $('ctTable').innerHTML = '<thead><tr><th>Нэр</th><th>Хүйс / нас</th><th>Мэргэжил</th>' +
      '<th>Боловсрол</th><th>Байр суурь</th><th>Өрх / хаяг</th><th>Утас</th></tr></thead><tbody>' +
      (pageRows.length ? pageRows.map(function (c) {
        const h = hmap.get(c.household_id) || {};
        return '<tr><td><b class="ctopen" style="cursor:pointer" data-hh="' + esc(c.household_id) + '">' +
          esc(c.name) + '</b>' + (c.relation ? '<div style="font-size:11px;color:var(--text-mute)">' +
            esc(c.relation) + '</div>' : '') + '</td>' +
          '<td style="font-size:12.5px">' + esc(c.gender || '—') +
          (c.birth_year ? ' · ' + (yr - c.birth_year) : '') + '</td>' +
          '<td style="font-size:12.5px">' + esc(c.occupation || '—') + '</td>' +
          '<td style="font-size:12.5px">' + esc(c.education || '—') + '</td>' +
          '<td>' + (c.is_voter ? supTag(c.support) : '<span class="tag t-gray">эрхгүй</span>') + '</td>' +
          '<td style="font-size:12px;color:var(--text-dim)">' + esc(h.district || '') + ' ' +
          (h.khoroo || '') + '-р хороо<div style="font-size:11px;color:var(--text-mute)">' +
          esc(h.street || '') + '</div></td>' +
          '<td style="font-size:12.5px">' + esc(c.phone || h.phone || '—') + '</td></tr>';
      }).join('') : '<tr><td colspan="7"><div class="tbl-empty">Илэрц олдсонгүй</div></td></tr>') + '</tbody>';
    $('ctTable').querySelectorAll('.ctopen').forEach(b => b.onclick = () => openHousehold(b.dataset.hh));
    pager('ctPager', rows.length, 50, drawCt);
  }

  /* ═══════════ 4. ХӨТӨЛБӨР ═══════════ */

  function renderPrograms() {
    const st = S();
    $('pgAdd').onclick = () => programForm(null);
    const total = st.db.households.length || 1;
    $('pgCards').innerHTML = st.db.programs.map(function (p) {
      const rows = st.db.households.filter(h => (h.programs || []).includes(p.id));
      const s = st.stats(rows);
      const base = st.stats(st.db.households);
      const lift = s.avgProb - base.avgProb;
      return '<div class="card"><div class="card-h"><div><h3>' + esc(p.name) + '</h3>' +
        '<div class="sub">' + esc(p.type) + ' · ' + p.year + '</div></div>' +
        '<div class="r"><button class="btn sm pged" data-id="' + p.id + '">✎</button></div></div>' +
        '<div class="mini" style="margin-bottom:16px">' +
        '<div class="m"><div class="l">Хамрагдсан өрх</div><div class="v">' + fmt(rows.length) + '</div></div>' +
        '<div class="m"><div class="l">Иргэн</div><div class="v">' + fmt(s.people) + '</div></div>' +
        '<div class="m"><div class="l">Дэмжлэг</div><div class="v" style="color:#0d8f63">' + pc(s.supportRate) + '</div></div>' +
        '</div>' +
        '<div style="font-size:12.5px;color:var(--text-dim);margin-bottom:8px">Хамрах хүрээ ' +
        pc(rows.length / total) + '</div>' +
        C().progress(rows.length / total, '#0e6bff') +
        '<div style="margin-top:14px;padding-top:13px;border-top:1px solid var(--border-soft);font-size:12.5px">' +
        '<span style="color:var(--text-mute)">Дэмжих магадлалын зөрүү: </span>' +
        '<b style="color:' + (lift >= 0 ? 'var(--green)' : 'var(--red)') + '">' +
        (lift >= 0 ? '+' : '') + Math.round(lift * 100) + ' нэгж</b>' +
        '<div style="color:var(--text-mute);font-size:11.5px;margin-top:4px">' +
        (lift > 0.04 ? 'Энэ хөтөлбөр дэмжлэгтэй хүчтэй холбоотой — өргөжүүлэх нь зүйтэй.'
          : lift > 0 ? 'Бага зэрэг эерэг хамааралтай.'
            : 'Дэмжлэгтэй тодорхой хамаарал ажиглагдахгүй байна.') + '</div></div></div>';
    }).join('') || '<div class="empty"><div class="ic">◎</div><b>Хөтөлбөр бүртгэгдээгүй</b></div>';
    $('pgCards').querySelectorAll('.pged').forEach(b =>
      b.onclick = () => programForm(S().program(b.dataset.id)));
  }

  function programForm(p) {
    const isNew = !p;
    p = p || { year: new Date().getFullYear(), type: 'Дэд бүтэц' };
    openModal(isNew ? 'Шинэ хөтөлбөр' : 'Хөтөлбөр засах',
      '<div class="fgrid">' + fld('Нэр', 'name', p.name) +
      fld('Төрөл', 'type', p.type) + fld('Он', 'year', p.year, 'number') + '</div>' +
      fld('Тайлбар', 'description', p.description, 'textarea'),
      (isNew ? '' : '<button class="btn danger" id="pgDel" style="margin-right:auto">Устгах</button>') +
      '<button class="btn" onclick="CivicUI.closeModal()">Болих</button>' +
      '<button class="btn primary" id="pgSave">Хадгалах</button>');
    $('pgSave').onclick = () => {
      const d = formData();
      if (!d.name.trim()) return toast('Нэр оруулна уу', 'err');
      const patch = { name: d.name.trim(), type: d.type.trim(), year: +d.year, description: d.description.trim() };
      if (isNew) S().addProgram(patch); else S().updateProgram(p.id, patch);
      closeModal(); toast('Хадгалагдлаа', 'ok'); refresh();
    };
    if ($('pgDel')) $('pgDel').onclick = () => confirmBox('Хөтөлбөр устгах уу?',
      'Өрхүүдийн оролцооны бүртгэлээс хасагдана.',
      () => { S().deleteProgram(p.id); closeModal(); refresh(); });
  }

  /* ═══════════ 5. ГОМДОЛ ═══════════ */

  function renderIssues() {
    const st = S();
    if (!$('isCat').dataset.f) {
      opts($('isCat'), K().ISSUE_CATS, 'Бүх ангилал');
      $('isCat').dataset.f = '1';
      $('isCat').onchange = drawIs; $('isStatus').onchange = drawIs;
      $('isExport').onclick = () => { IO().exportAs('issues-xlsx'); toast('Excel татаж байна', 'ok'); };
    }
    drawIs();
  }

  function drawIs() {
    const st = S();
    const hmap = new Map(st.db.households.map(h => [h.id, h]));
    const cat = $('isCat').value, status = $('isStatus').value;
    const rows = st.db.issues.filter(i =>
      (!cat || i.category === cat) && (!status || i.status === status))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const open = st.db.issues.filter(i => i.status !== 'Шийдэгдсэн');
    $('isSub').textContent = fmt(st.db.issues.length) + ' бүртгэл · ' + fmt(open.length) + ' шийдэгдээгүй';

    const byCat = {};
    st.db.issues.forEach(i => { byCat[i.category] = (byCat[i.category] || 0) + 1; });
    $('isCatBars').innerHTML = C().hbars(Object.entries(byCat)
      .sort((a, b) => b[1] - a[1]).slice(0, 9)
      .map(([n, v]) => ({ name: n, value: v, color: '#0e6bff' })));

    const byKh = {};
    open.forEach(i => {
      const k = (i.district || '?') + ' ' + (i.khoroo || '?') + '-р хороо';
      byKh[k] = (byKh[k] || 0) + 1;
    });
    $('isKhBars').innerHTML = C().hbars(Object.entries(byKh)
      .sort((a, b) => b[1] - a[1]).slice(0, 9)
      .map(([n, v]) => ({ name: n, value: v, color: '#b07d06' })));

    const pageRows = slice('isPager', rows);
    $('isTable').innerHTML = '<thead><tr><th>Гарчиг</th><th>Ангилал</th><th>Байршил</th>' +
      '<th>Ач холбогдол</th><th>Төлөв</th><th>Огноо</th><th></th></tr></thead><tbody>' +
      (pageRows.length ? pageRows.map(function (i) {
        const h = hmap.get(i.household_id) || {};
        return '<tr><td><b>' + esc(i.title) + '</b>' +
          (h.head ? '<div style="font-size:11px;color:var(--text-mute)">' + esc(h.head) + '</div>' : '') + '</td>' +
          '<td><span class="tag t-gray">' + esc(i.category) + '</span></td>' +
          '<td style="font-size:12.5px">' + esc(i.district || h.district || '') + ' ' +
          (i.khoroo || h.khoroo || '') + '-р хороо</td>' +
          '<td><span class="tag ' + (i.priority === 'Өндөр' ? 't-s1' : i.priority === 'Дунд' ? 't-s3' : 't-gray') +
          '">' + esc(i.priority) + '</span></td>' +
          '<td><span class="tag ' + (i.status === 'Шийдэгдсэн' ? 't-s5' : i.status === 'Шинэ' ? 't-s3' : 't-blue') +
          '">' + esc(i.status) + '</span></td>' +
          '<td style="font-size:12.5px;color:var(--text-mute)">' + esc(i.date) + '</td>' +
          '<td><div style="display:flex;gap:4px">' +
          '<button class="btn sm ised" data-id="' + i.id + '">✎</button>' +
          (i.household_id ? '<button class="btn sm ishh" data-id="' + esc(i.household_id) + '">Өрх</button>' : '') +
          '</div></td></tr>';
      }).join('') : '<tr><td colspan="7"><div class="tbl-empty">Илэрц олдсонгүй</div></td></tr>') + '</tbody>';
    $('isTable').querySelectorAll('.ised').forEach(b => b.onclick = () =>
      issueForm(S().db.issues.find(x => x.id === b.dataset.id)));
    $('isTable').querySelectorAll('.ishh').forEach(b => b.onclick = () => openHousehold(b.dataset.id));
    pager('isPager', rows.length, 50, drawIs);
  }

  /* ═══════════ 6. AI ШИНЖИЛГЭЭ ═══════════ */

  function renderAi() {
    const st = S();
    if (!$('aiDist').dataset.f) {
      opts($('aiDist'), st.districts(), 'Бүх дүүрэг');
      opts($('aiSeg'), [['core', 'Бат бөх дэмжигч'], ['lean', 'Хазайсан дэмжигч'], ['swing', 'Эргэлзэгч'],
      ['soft-opp', 'Хазайсан эсрэг'], ['opp', 'Эсрэг']].map(x => ({ v: x[0], t: x[1] })), 'Бүх ангилал');
      $('aiDist').dataset.f = '1';
      $('aiDist').onchange = drawAi; $('aiSeg').onchange = drawAi;
      $('aiExport').onclick = () => { IO().exportAs('ai-xlsx'); toast('AI жагсаалт татаж байна', 'ok'); };
    }
    drawAi();
  }

  function drawAi() {
    const st = S();
    const dist = $('aiDist').value, seg = $('aiSeg').value;
    let base = dist ? st.db.households.filter(h => h.district === dist) : st.db.households;
    let pr = AI().priority(base, 9999);
    if (seg) pr = pr.filter(p => p.s.segment.key === seg);

    const segCount = { core: 0, lean: 0, swing: 0, 'soft-opp': 0, opp: 0 };
    AI().priority(base, 9999).forEach(p => segCount[p.s.segment.key]++);
    const s = st.stats(base);

    $('aiKpis').innerHTML = [
      kpi({ label: 'Дундаж дэмжих магадлал', value: pc(s.avgProb), icon: '', color: '#0e6bff', tint: 'rgba(14,107,255,.24)', icbg: 'rgba(14,107,255,.16)', note: fmt(base.length) + ' өрх дээр тооцсон' }),
      kpi({ label: 'Бат бөх дэмжигч', value: fmt(segCount.core), icon: '', color: '#0d8f63', tint: 'rgba(13,143,99,.22)', icbg: 'rgba(13,143,99,.15)', note: pc(segCount.core / Math.max(1, base.length)) }),
      kpi({ label: 'Эргэлзэгч', value: fmt(segCount.swing), icon: '', color: '#b07d06', tint: 'rgba(176,125,6,.22)', icbg: 'rgba(176,125,6,.15)', note: '' }),
      kpi({ label: 'Эсрэг талд', value: fmt(segCount.opp + segCount['soft-opp']), icon: '', color: '#d92549', tint: 'rgba(217,37,73,.2)', icbg: 'rgba(217,37,73,.14)', note: '' }),
      kpi({ label: 'Дата дутуу өрх', value: fmt(base.filter(h => AI().score(h).conf < .4).length), icon: '', color: '#0e9fbc', tint: 'rgba(14,159,188,.2)', icbg: 'rgba(14,159,188,.14)', note: 'Итгэлцэл 40%-иас доош' })
    ].join('');

    $('aiHist').innerHTML = C().histogram(base.map(h => AI().score(h).prob), 10);

    /* Дундаж хувь нэмэр */
    const agg = {};
    base.forEach(h => AI().score(h).factors.forEach(f => {
      if (!agg[f.name]) agg[f.name] = { sum: 0, n: 0 };
      agg[f.name].sum += f.contrib; agg[f.name].n++;
    }));
    const fac = Object.entries(agg).map(([n, v]) => ({ name: n, avg: v.sum / v.n }))
      .sort((a, b) => Math.abs(b.avg) - Math.abs(a.avg));
    const mxf = Math.max.apply(null, fac.map(f => Math.abs(f.avg))) || 1;
    $('aiFactors').innerHTML = fac.map(f =>
      '<div class="fac" style="margin-bottom:11px"><span class="fn">' + esc(f.name) + '</span>' +
      '<span class="fb" style="width:120px;flex:0 0 120px;height:8px"><i style="' +
      (f.avg >= 0 ? 'left:50%;' : 'right:50%;left:auto;') + 'width:' +
      (Math.abs(f.avg) / mxf * 50).toFixed(1) + '%;background:' +
      (f.avg >= 0 ? '#0d8f63' : '#d92549') + '"></i></span>' +
      '<span class="fv" style="color:' + (f.avg >= 0 ? '#0d8f63' : '#d92549') + '">' +
      (f.avg >= 0 ? '+' : '') + f.avg.toFixed(2) + '</span></div>').join('') +
      '<p style="font-size:11.5px;color:var(--text-mute);margin-top:14px;line-height:1.7">' +
      'Эерэг утга нь дэмжлэгийг нэмэгдүүлж, сөрөг нь бууруулж байна. Жинг ' +
      '<b>Тохиргоо</b> хуудаснаас өөрчилж болно.</p>';

    const pageRows = slice('aiPager', pr);
    $('aiTable').innerHTML = '<thead><tr><th>#</th><th>Өрх</th><th>Байршил</th><th class="num">Сонгогч</th>' +
      '<th>Дэмжих магадлал</th><th>Ангилал</th><th>Ач холбогдол</th><th>Гол хүчин зүйл</th><th></th></tr></thead><tbody>' +
      (pageRows.length ? pageRows.map(function (p, i) {
        const idx = (PG.aiPager ? (PG.aiPager.p - 1) * PG.aiPager.per : 0) + i + 1;
        const f0 = p.s.factors[0];
        return '<tr><td style="color:var(--text-mute);font-size:12px">' + idx + '</td>' +
          '<td><b class="aiopen" style="cursor:pointer" data-id="' + p.h.id + '">' +
          esc(p.h.head || p.h.code) + '</b>' +
          '<div style="font-size:11px;color:var(--text-mute)">' + esc(p.h.phone || '') + '</div></td>' +
          '<td style="font-size:12.5px">' + esc(p.h.district) + ' ' + p.h.khoroo + '-р хороо' +
          '<div style="font-size:11px;color:var(--text-mute)">' + esc(p.h.street || '') + '</div></td>' +
          '<td class="num">' + p.voters + '</td>' +
          '<td><div style="display:flex;align-items:center;gap:8px">' +
          '<b style="color:' + p.s.segment.color + '">' + p.s.pct + '%</b>' +
          '<div class="bartrack" style="width:48px;height:6px"><div class="barfill" style="width:' +
          p.s.pct + '%;background:' + p.s.segment.color + '"></div></div></div></td>' +
          '<td>' + segTag(p.s.segment) + '</td>' +
          '<td><b style="color:#0e6bff">' + (p.value * 100).toFixed(0) + '</b></td>' +
          '<td style="font-size:12px;color:var(--text-dim)">' + (f0 ? esc(f0.name) +
            '<div style="font-size:11px;color:var(--text-mute)">' + esc(f0.label) + '</div>' : '—') + '</td>' +
          '<td><button class="btn sm aiopen" data-id="' + p.h.id + '">Нээх</button></td></tr>';
      }).join('') : '<tr><td colspan="9"><div class="tbl-empty">Илэрц олдсонгүй</div></td></tr>') + '</tbody>';
    $('aiTable').querySelectorAll('.aiopen').forEach(b => b.onclick = () => openHousehold(b.dataset.id));
    pager('aiPager', pr.length, 50, drawAi);
  }

  /* ═══════════ 7. СТРАТЕГИ ═══════════ */

  function renderStrategy() {
    const st = S();
    if (!$('stDist').dataset.f) {
      opts($('stDist'), st.districts(), 'Бүх дүүрэг');
      $('stDist').dataset.f = '1';
      $('stDist').onchange = drawSt;
      $('stExport').onclick = () => { IO().exportAs('strategy-xlsx'); toast('Excel татаж байна', 'ok'); };
    }
    drawSt();
  }

  function drawSt() {
    const dist = $('stDist').value;
    let rows = AI().khorooStrategy();
    if (dist) rows = rows.filter(r => r.district === dist);
    $('stTable').innerHTML = '<thead><tr><th>#</th><th>Хороо</th><th class="num">Өрх</th><th class="num">Сонгогч</th>' +
      '<th>Дэмжлэг</th><th>Дэмжих магадлал</th><th>Хамрагдалт</th><th>Эргэлзэгч</th>' +
      '<th>Боломж</th><th>Зөвлөмж</th><th></th></tr></thead><tbody>' +
      rows.map(function (k, i) {
        const col = k.avgProb >= .6 ? '#0d8f63' : k.avgProb >= .45 ? '#b07d06' : '#d92549';
        return '<tr><td style="color:var(--text-mute);font-size:12px">' + (i + 1) + '</td>' +
          '<td><b>' + esc(k.district) + '</b><div style="font-size:11.5px;color:var(--text-mute)">' +
          k.khoroo + '-р хороо</div></td>' +
          '<td class="num">' + fmt(k.households) + '</td>' +
          '<td class="num">' + fmt(k.voters) + '</td>' +
          '<td><b style="color:' + col + '">' + pc(k.supportRate) + '</b></td>' +
          '<td>' + pc(k.avgProb) + '</td>' +
          '<td><div style="width:74px">' + C().progress(k.coverage, k.coverage > .6 ? '#0d8f63' : '#b07d06') + '</div></td>' +
          '<td>' + pc(k.swingShare) + '</td>' +
          '<td><b style="color:#0e6bff">' + (k.opportunity * 100).toFixed(0) + '</b></td>' +
          '<td style="font-size:12.5px;color:var(--text-dim);max-width:250px">' + esc(k.action) + '</td>' +
          '<td><button class="btn sm stgo" data-d="' + esc(k.district) + '" data-k="' + k.khoroo + '">Зураг</button></td></tr>';
      }).join('') + '</tbody>';
    $('stTable').querySelectorAll('.stgo').forEach(b => b.onclick = () => {
      go('map');
      setTimeout(() => {
        $('mapDist').value = b.dataset.d;
        $('mapDist').dispatchEvent(new Event('change'));
        setTimeout(() => {
          $('mapKhoroo').value = b.dataset.k;
          $('mapKhoroo').dispatchEvent(new Event('change'));
          global.CivicMap.fit();
        }, 60);
      }, 260);
    });
  }

  /* ═══════════ 8. БАГ ═══════════ */

  function renderTeam() {
    if (!$('tmDays').dataset.f) {
      $('tmDays').dataset.f = '1';
      $('tmDays').onchange = drawTm;
      $('tmAdd').onclick = () => staffForm(null);
      $('tmExport').onclick = () => { IO().exportAs('staff-xlsx'); toast('Excel татаж байна', 'ok'); };
    }
    drawTm();
  }

  function drawTm() {
    const st = S();
    const days = +$('tmDays').value;
    const rows = st.db.staff.map(s => Object.assign({ s: s }, st.staffKpi(s.id, days)))
      .sort((a, b) => b.reached - a.reached);
    const tot = rows.reduce((o, r) => ({
      reached: o.reached + r.reached, contacts: o.contacts + r.contacts,
      positive: o.positive + r.positive, assigned: o.assigned + r.assigned
    }), { reached: 0, contacts: 0, positive: 0, assigned: 0 });

    $('tmKpis').innerHTML = [
      kpi({ label: 'Идэвхтэй гишүүн', value: fmt(st.db.staff.filter(s => s.active !== false).length), icon: '', color: '#0e6bff', tint: 'rgba(14,107,255,.24)', icbg: 'rgba(14,107,255,.16)', note: fmt(st.db.staff.length) + ' нийт бүртгэлтэй' }),
      kpi({ label: 'Хүрсэн өрх', value: fmt(tot.reached), icon: '', color: '#0e6bff', tint: 'rgba(61,125,255,.22)', icbg: 'rgba(61,125,255,.15)', note: 'сонгосон хугацаанд' }),
      kpi({ label: 'Холбоо барилт', value: fmt(tot.contacts), icon: '', color: '#0e9fbc', tint: 'rgba(14,159,188,.2)', icbg: 'rgba(14,159,188,.14)', note: 'нийт үйлдэл' }),
      kpi({ label: 'Эерэг хариу', value: pc(tot.contacts ? tot.positive / tot.contacts : 0), icon: '', color: '#0d8f63', tint: 'rgba(13,143,99,.22)', icbg: 'rgba(13,143,99,.15)', note: fmt(tot.positive) + ' эерэг уулзалт' }),
      kpi({ label: 'Хариуцсан өрх', value: fmt(tot.assigned), icon: '', color: '#b07d06', tint: 'rgba(176,125,6,.2)', icbg: 'rgba(176,125,6,.14)', note: 'хуваарилагдсан нийт' })
    ].join('');

    $('tmTable').innerHTML = '<thead><tr><th>Гишүүн</th><th>Албан тушаал</th><th class="num">Хариуцсан</th>' +
      '<th class="num">Хүрсэн</th><th>Хамрагдалт</th><th>Эерэг %</th><th class="num">Дэмжигч</th>' +
      '<th>Зорилтын биелэлт</th><th class="num">Даалгавар</th><th></th></tr></thead><tbody>' +
      rows.map(function (r) {
        const role = (K().ROLES[r.s.role] || {}).name || r.s.role;
        return '<tr><td><div style="display:flex;align-items:center;gap:10px">' +
          '<div class="avatar" style="width:32px;height:32px;flex:0 0 32px;font-size:11px">' +
          esc(initials(r.s.name)) + '</div><div><b>' + esc(r.s.name) + '</b>' +
          '<div style="font-size:11px;color:var(--text-mute)">' + esc(r.s.team || '') +
          (r.s.phone ? ' · ' + esc(r.s.phone) : '') + '</div></div></div></td>' +
          '<td><span class="tag t-purple">' + esc(role) + '</span></td>' +
          '<td class="num">' + fmt(r.assigned) + '</td>' +
          '<td class="num">' + fmt(r.reached) + '</td>' +
          '<td><div style="width:80px">' + C().progress(r.coverage, r.coverage > .5 ? '#0d8f63' : '#b07d06') + '</div></td>' +
          '<td><b style="color:' + (r.hitRate > .5 ? '#0d8f63' : r.hitRate > .3 ? '#b07d06' : '#d92549') + '">' +
          pc(r.hitRate) + '</b></td>' +
          '<td class="num">' + fmt(r.supporters) + '</td>' +
          '<td><div style="width:90px">' + C().progress(r.targetPct, r.targetPct >= 1 ? '#0d8f63' : '#0e6bff') +
          '</div><div style="font-size:10.5px;color:var(--text-mute)">' + fmt(r.reached) + ' / ' + fmt(r.target) + '</div></td>' +
          '<td class="num">' + r.openTasks + ' / ' + (r.openTasks + r.doneTasks) + '</td>' +
          '<td><button class="btn sm tmed" data-id="' + r.s.id + '">✎</button></td></tr>';
      }).join('') + '</tbody>';
    $('tmTable').querySelectorAll('.tmed').forEach(b =>
      b.onclick = () => staffForm(S().staffMember(b.dataset.id)));
  }

  function staffForm(s) {
    const isNew = !s;
    s = s || { role: 'canvasser', active: true, target: 200 };
    openModal(isNew ? 'Багийн гишүүн нэмэх' : 'Гишүүн засах',
      '<div class="fgrid">' + fld('Нэр', 'name', s.name) +
      fld('Албан тушаал', 'role', s.role, 'select',
        Object.keys(K().ROLES).map(k => ({ v: k, t: K().ROLES[k].name }))) +
      fld('Баг / хариуцах бүс', 'team', s.team) +
      fld('Утас', 'phone', s.phone) +
      fld('И-мэйл', 'email', s.email) +
      fld('7 хоногийн зорилт (өрх)', 'target', s.target, 'number') + '</div>' +
      '<label class="chip pick"><input type="checkbox" name="active"' + (s.active !== false ? ' checked' : '') +
      ' style="margin-right:6px">Идэвхтэй</label>',
      (isNew ? '' : '<button class="btn danger" id="tmDel" style="margin-right:auto">Устгах</button>') +
      '<button class="btn" onclick="CivicUI.closeModal()">Болих</button>' +
      '<button class="btn primary" id="tmSave">Хадгалах</button>');
    $('tmSave').onclick = () => {
      const d = formData();
      if (!d.name.trim()) return toast('Нэр оруулна уу', 'err');
      const patch = {
        name: d.name.trim(), role: d.role, team: d.team.trim(), phone: d.phone.trim(),
        email: d.email.trim(), target: +d.target || 0, active: !!d.active
      };
      if (isNew) S().addStaff(patch); else S().updateStaff(s.id, patch);
      closeModal(); toast('Хадгалагдлаа', 'ok'); refresh();
    };
    if ($('tmDel')) $('tmDel').onclick = () => confirmBox('Гишүүнийг устгах уу?',
      'Хариуцаж байсан өрхүүд эзэнгүй болно.',
      () => { S().deleteStaff(s.id); closeModal(); refresh(); });
  }

  /* ═══════════ 9. ДААЛГАВАР ═══════════ */

  let tkView = 'table';

  function renderTasks() {
    const st = S();
    if (!$('tkOwner').dataset.f) {
      opts($('tkOwner'), st.db.staff.map(s => ({ v: s.id, t: s.name })), 'Бүх хариуцагч');
      $('tkOwner').dataset.f = '1';
      $('tkOwner').onchange = drawTk;
      $('tkAdd').onclick = () => taskForm(null);
      $('tkViewTable').onclick = () => { tkView = 'table'; drawTk(); };
      $('tkViewKanban').onclick = () => { tkView = 'kanban'; drawTk(); };
    }
    drawTk();
  }

  function drawTk() {
    const st = S();
    const ts = st.taskStats();
    $('tkViewTable').classList.toggle('primary', tkView === 'table');
    $('tkViewKanban').classList.toggle('primary', tkView === 'kanban');
    $('tkKpis').innerHTML = [
      kpi({ label: 'Нээлттэй даалгавар', value: fmt(ts.open), icon: '', color: '#0e6bff', tint: 'rgba(14,107,255,.24)', icbg: 'rgba(14,107,255,.16)', note: fmt(ts.total) + ' нийт' }),
      kpi({ label: 'Хугацаа хэтэрсэн', value: fmt(ts.overdue), icon: '', color: '#d92549', tint: 'rgba(217,37,73,.2)', icbg: 'rgba(217,37,73,.14)', note: '' }),
      kpi({ label: 'Өндөр ач холбогдол', value: fmt(ts.highOpen), icon: '', color: '#b07d06', tint: 'rgba(176,125,6,.2)', icbg: 'rgba(176,125,6,.14)', note: '' }),
      kpi({ label: 'Дууссан', value: fmt(ts.done), icon: '', color: '#0d8f63', tint: 'rgba(13,143,99,.22)', icbg: 'rgba(13,143,99,.15)', note: pc(ts.total ? ts.done / ts.total : 0) + ' гүйцэтгэл' })
    ].join('');

    const owner = $('tkOwner').value;
    let rows = st.db.tasks.filter(t => !owner || t.owner_id === owner);
    $('tkSub').textContent = fmt(rows.length) + ' даалгавар';

    if (tkView === 'kanban') drawKanban(rows); else drawTaskTable(rows);
  }

  function taskCardMeta(t) {
    const st = S();
    const over = t.status !== 'Дууссан' && t.due && t.due < K().today();
    return { over: over, owner: st.staffName(t.owner_id) };
  }

  function drawTaskTable(rows) {
    const st = S();
    const groups = K().TASK_STATUS;
    $('tkBody').innerHTML = groups.map(function (g) {
      const items = rows.filter(t => t.status === g);
      const col = { 'Хийгдэж буй': '#0e6bff', 'Хүлээгдэж буй': '#b07d06', 'Шалгуулж буй': '#e2701a', 'Дууссан': '#0d8f63' }[g];
      return '<div class="card pad0" style="margin-bottom:14px">' +
        '<div class="card-h" style="padding:16px 19px 4px;margin-bottom:8px">' +
        '<h3 style="display:flex;align-items:center;gap:9px;font-size:14.5px">' +
        '<i class="dot" style="background:' + col + '"></i>' + g + '</h3>' +
        '<span class="tag t-gray">' + items.length + '</span></div>' +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Даалгавар</th><th>Хариуцагч</th>' +
        '<th>Ач холбогдол</th><th>Дуусах</th><th style="width:150px">Явц</th><th>Ангилал</th><th></th></tr></thead><tbody>' +
        (items.length ? items.map(function (t) {
          const m = taskCardMeta(t);
          return '<tr><td><b>' + esc(t.title) + '</b></td>' +
            '<td><div style="display:flex;align-items:center;gap:8px">' +
            '<div class="avatar" style="width:24px;height:24px;flex:0 0 24px;font-size:9.5px">' +
            esc(initials(m.owner)) + '</div><span style="font-size:12.5px">' + esc(m.owner) + '</span></div></td>' +
            '<td><span class="tag ' + (t.priority === 'Өндөр' ? 't-s1' : t.priority === 'Дунд' ? 't-s3' : 't-gray') +
            '">' + esc(t.priority) + '</span></td>' +
            '<td style="font-size:12.5px;color:' + (m.over ? 'var(--red)' : 'var(--text-dim)') + '">' +
            (m.over ? '' : '') + esc(t.due || '—') + '</td>' +
            '<td>' + C().progress((t.progress || 0) / 100,
              t.progress >= 100 ? '#0d8f63' : t.progress >= 60 ? '#0e6bff' : '#0e6bff') + '</td>' +
            '<td><span class="tag t-purple">' + esc(t.tag || '—') + '</span></td>' +
            '<td><button class="btn sm tked" data-id="' + t.id + '">✎</button></td></tr>';
        }).join('') : '<tr><td colspan="7"><div class="tbl-empty">Даалгавар алга</div></td></tr>') +
        '</tbody></table></div></div>';
    }).join('');
    $('tkBody').querySelectorAll('.tked').forEach(b =>
      b.onclick = () => taskForm(S().db.tasks.find(t => t.id === b.dataset.id)));
  }

  function drawKanban(rows) {
    const cols = K().TASK_STATUS;
    const colc = { 'Хийгдэж буй': '#0e6bff', 'Хүлээгдэж буй': '#b07d06', 'Шалгуулж буй': '#e2701a', 'Дууссан': '#0d8f63' };
    $('tkBody').innerHTML = '<div style="display:grid;grid-template-columns:repeat(' + cols.length +
      ',minmax(230px,1fr));gap:13px;overflow-x:auto;padding-bottom:8px">' +
      cols.map(function (c) {
        const items = rows.filter(t => t.status === c);
        return '<div style="background:var(--bg-2);border:1px solid var(--border-soft);border-radius:14px;padding:13px">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:10px;' +
          'border-bottom:2px solid ' + colc[c] + '">' +
          '<b style="font-size:13px">' + c + '</b><span class="tag t-gray" style="margin-left:auto">' +
          items.length + '</span></div>' +
          items.map(function (t) {
            const m = taskCardMeta(t);
            return '<div class="prio tkcard" data-id="' + t.id + '" style="flex-direction:column;align-items:stretch;gap:8px">' +
              '<div style="font-size:12.8px;font-weight:600;line-height:1.45">' + esc(t.title) + '</div>' +
              '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
              '<span class="tag ' + (t.priority === 'Өндөр' ? 't-s1' : t.priority === 'Дунд' ? 't-s3' : 't-gray') +
              '">' + esc(t.priority) + '</span>' +
              '<span class="tag t-purple">' + esc(t.tag || '') + '</span></div>' +
              C().progress((t.progress || 0) / 100, colc[c]) +
              '<div style="display:flex;align-items:center;gap:7px;font-size:11px;color:var(--text-mute)">' +
              '<div class="avatar" style="width:20px;height:20px;flex:0 0 20px;font-size:8.5px">' +
              esc(initials(m.owner)) + '</div>' + esc(m.owner) +
              '<span style="margin-left:auto;color:' + (m.over ? 'var(--red)' : 'var(--text-mute)') + '">' +
              esc(t.due || '') + '</span></div></div>';
          }).join('') +
          '<button class="btn sm tkadd" data-s="' + esc(c) + '" style="width:100%;margin-top:6px;justify-content:center">+ Нэмэх</button>' +
          '</div>';
      }).join('') + '</div>';
    $('tkBody').querySelectorAll('.tkcard').forEach(b =>
      b.onclick = () => taskForm(S().db.tasks.find(t => t.id === b.dataset.id)));
    $('tkBody').querySelectorAll('.tkadd').forEach(b =>
      b.onclick = e => { e.stopPropagation(); taskForm(null, b.dataset.s); });
  }

  function taskForm(t, status) {
    const st = S();
    const isNew = !t;
    t = t || { status: status || 'Хүлээгдэж буй', priority: 'Дунд', progress: 0, tag: K().TASK_TAGS[0] };
    openModal(isNew ? 'Шинэ даалгавар' : 'Даалгавар засах',
      fld('Гарчиг', 'title', t.title) +
      '<div class="fgrid">' +
      fld('Хариуцагч', 'owner_id', t.owner_id, 'select', st.db.staff.map(s => ({ v: s.id, t: s.name }))) +
      fld('Төлөв', 'status', t.status, 'select', K().TASK_STATUS) +
      fld('Ач холбогдол', 'priority', t.priority, 'select', K().TASK_PRIO) +
      fld('Ангилал', 'tag', t.tag, 'select', K().TASK_TAGS) +
      fld('Дуусах огноо', 'due', t.due, 'date') +
      fld('Явц (%)', 'progress', t.progress, 'number') +
      '</div>' + fld('Тэмдэглэл', 'note', t.note, 'textarea'),
      (isNew ? '' : '<button class="btn danger" id="tkDel" style="margin-right:auto">Устгах</button>') +
      '<button class="btn" onclick="CivicUI.closeModal()">Болих</button>' +
      '<button class="btn primary" id="tkSave">Хадгалах</button>');
    $('tkSave').onclick = () => {
      const d = formData();
      if (!d.title.trim()) return toast('Гарчиг оруулна уу', 'err');
      const patch = {
        title: d.title.trim(), owner_id: d.owner_id, status: d.status, priority: d.priority,
        tag: d.tag, due: d.due, progress: Math.max(0, Math.min(100, +d.progress || 0)), note: d.note.trim()
      };
      if (isNew) S().addTask(patch); else S().updateTask(t.id, patch);
      closeModal(); toast('Хадгалагдлаа', 'ok'); refresh();
    };
    if ($('tkDel')) $('tkDel').onclick = () => { S().deleteTask(t.id); closeModal(); toast('Устгагдлаа', 'ok'); refresh(); };
  }

  /* ═══════════ 10. ИМПОРТ / ЭКСПОРТ ═══════════ */

  const IOST = { raw: null, headers: [], map: {}, result: null };

  function renderIo() {
    if (!$('ioDrop').dataset.f) {
      $('ioDrop').dataset.f = '1';
      const drop = $('ioDrop'), file = $('ioFile');
      drop.onclick = () => file.click();
      drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = e => {
        e.preventDefault(); drop.classList.remove('over');
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      };
      file.onchange = e => { if (e.target.files[0]) handleFile(e.target.files[0]); };
      $('ioTemplate').onclick = () => { IO().template(); toast('Загвар файл татагдлаа', 'ok'); };
      $('ioRestore').onclick = () => file.click();
      $('ioAuto').onclick = () => { IOST.map = IO().autoMap(IOST.headers); drawMapping(); toast('Автоматаар тааруулав', 'ok'); };
      $('ioNext2').onclick = doPreview;
      $('ioBack').onclick = () => { step(2); };
      $('ioCommit').onclick = doCommit;
      document.querySelectorAll('[data-exp]').forEach(b => b.onclick = () => {
        try { IO().exportAs(b.dataset.exp); toast('Татаж байна...', 'ok'); }
        catch (e) { toast('Экспорт амжилтгүй: ' + e.message, 'err'); }
      });
    }
    drawHistory();
  }

  function step(n) {
    document.querySelectorAll('#ioSteps .step').forEach(s => {
      const i = +s.dataset.s;
      s.classList.toggle('on', i === n);
      s.classList.toggle('done', i < n);
    });
    $('ioStep1').classList.toggle('hide', n !== 1);
    $('ioStep2').classList.toggle('hide', n !== 2);
    $('ioStep3').classList.toggle('hide', n !== 3);
  }

  async function handleFile(f) {
    try {
      toast('Файл уншиж байна...', '');
      const res = await IO().readFile(f);
      if (res.kind === 'json') {
        const d = res.data;
        if (d && d.households) {
          confirmBox('Нөөцөөс сэргээх үү?',
            'Одоогийн бүх дата солигдоно. Өрх: ' + (d.households || []).length +
            ', Иргэн: ' + (d.citizens || []).length,
            () => { S().replaceAll(d); toast('Сэргээгдлээ', 'ok'); refresh(); });
        } else if (Array.isArray(d)) {
          startMapping(d, f.name);
        } else toast('JSON бүтэц танигдсангүй', 'err');
        return;
      }
      startMapping(res.rows, f.name);
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  function startMapping(rows, name) {
    if (!rows.length) return toast('Мөр олдсонгүй', 'err');
    IOST.raw = rows;
    IOST.headers = Object.keys(rows[0]);
    IOST.map = IO().autoMap(IOST.headers);
    $('ioFileInfo').textContent = name + ' · ' + fmt(rows.length) + ' мөр · ' + IOST.headers.length + ' багана';
    drawMapping();
    step(2);
  }

  function drawMapping() {
    const matched = Object.keys(IOST.map).length;
    $('ioMapping').innerHTML =
      '<div style="font-size:12.5px;color:var(--text-mute);margin-bottom:14px">' +
      '<b style="color:var(--green)">' + matched + '</b> багана автоматаар танигдлаа. ' +
      'Буруу бол доор гараар өөрчилнө үү. Хэрэггүй багануудыг «— алгасах —» болгоно уу.</div>' +
      IO().FIELDS.map(function (f) {
        const cur = IOST.map[f.k] || '';
        const sample = cur && IOST.raw[0] ? String(IOST.raw[0][cur] || '').slice(0, 40) : '';
        return '<div class="maprow"><div class="src">' + esc(f.n) +
          (sample ? '<small>жишээ: ' + esc(sample) + '</small>' : '') + '</div>' +
          '<div class="ar">←</div>' +
          '<select class="inp iomap" data-k="' + f.k + '"><option value="">— алгасах —</option>' +
          IOST.headers.map(h => '<option value="' + esc(h) + '"' + (h === cur ? ' selected' : '') + '>' +
            esc(h) + '</option>').join('') + '</select></div>';
      }).join('');
    $('ioMapping').querySelectorAll('.iomap').forEach(sel => sel.onchange = () => {
      if (sel.value) IOST.map[sel.dataset.k] = sel.value; else delete IOST.map[sel.dataset.k];
      drawMapping();
    });
  }

  function doPreview() {
    try {
      IOST.result = IO().transform(IOST.raw, IOST.map, {
        dedupe: $('ioDedupe').checked, geo: $('ioGeo').checked
      });
    } catch (e) { return toast('Хөрвүүлэхэд алдаа: ' + e.message, 'err'); }
    const r = IOST.result;
    const upd = r.households.filter(h => h._isUpdate).length;
    $('ioPrevInfo').innerHTML = '<b>' + fmt(r.households.length) + '</b> өрх · <b>' +
      fmt(r.citizens.length) + '</b> иргэн · шинэчлэгдэх: <b>' + fmt(upd) + '</b>' +
      (r.warnings.length ? ' · <span style="color:var(--yellow)">' + r.warnings.length +
        ' анхааруулга</span>' : '');
    const cols = ['code', 'head', 'district', 'khoroo', 'street', 'family_size', 'phone', 'support', 'party', 'lat', 'lng'];
    const names = ['Код', 'Тэргүүн', 'Дүүрэг', 'Хороо', 'Гудамж', 'Ам бүл', 'Утас', 'Байр суурь', 'Нам', 'Lat', 'Lng'];
    $('ioPreview').innerHTML = '<thead><tr><th></th>' + names.map(n => '<th>' + n + '</th>').join('') +
      '</tr></thead><tbody>' + r.households.slice(0, 30).map((h, i) =>
        '<tr><td style="color:var(--text-mute);font-size:11.5px">' + (h._isUpdate ?
          '<span class="tag t-blue">шинэчлэх</span>' : '<span class="tag t-s5">шинэ</span>') + '</td>' +
        cols.map(c => '<td style="font-size:12.5px">' +
          esc(c === 'support' ? (K().SUPPORT[h[c]] || {}).name : h[c]) + '</td>').join('') + '</tr>').join('') +
      '</tbody>';
    if (r.warnings.length) {
      $('ioPreview').insertAdjacentHTML('afterend', '');
    }
    step(3);
  }

  function doCommit() {
    if (!IOST.result) return;
    const mode = $('ioMode').value;
    const run = () => {
      const res = IO().commit(IOST.result, mode);
      toast(res.added + ' шинэ, ' + res.updated + ' шинэчлэгдсэн өрх орлоо', 'ok');
      IOST.raw = null; IOST.result = null;
      step(1); $('ioFile').value = '';
      global.CivicMap.fillSelects && global.CivicMap.fillSelects();
      ['hhDist', 'ctDist', 'aiDist', 'stDist', 'dashScope'].forEach(id => { if ($(id)) delete $(id).dataset.f; });
      refresh(); drawHistory();
    };
    if (mode === 'replace') {
      confirmBox('Бүх өрхийг солих уу?', 'Одоогийн ' + fmt(S().db.households.length) +
        ' өрх устаж, шинэ дата орно. Урьдчилан нөөцөө ав.', run);
    } else run();
  }

  function drawHistory() {
    const h = IO().history();
    $('ioHistory').innerHTML = h.length ? h.map(x =>
      '<div style="display:flex;gap:11px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-soft)">' +
      '<div style="flex:1"><b style="font-size:12.5px">' + fmt(x.rows) + ' мөр оруулсан</b>' +
      '<div style="font-size:11.5px;color:var(--text-mute)">' + new Date(x.date).toLocaleString('mn-MN') + '</div></div>' +
      '<span class="tag t-s5">+' + fmt(x.added) + '</span>' +
      '<span class="tag t-blue">↻' + fmt(x.updated) + '</span></div>').join('')
      : '<div class="empty"><p>Импортын түүх алга</p></div>';
  }

  /* ═══════════ 11. ТОХИРГОО ═══════════ */

  function renderSettings() {
    const st = S();
    /* Загварын жин */
    const W = AI().getWeights();
    $('wSliders').innerHTML = Object.keys(W).map(function (k) {
      const label = {
        stance: 'Мэдэгдсэн байр суурь', party: 'Намын хандлага', history: 'Уулзалтын үр дүн',
        program: 'Хөтөлбөрийн оролцоо', neighbor: 'Хорооны хандлага', recency: 'Холбоо барилтын шинэлэг',
        family: 'Өрхийн доторх нэгдэл', housing: 'Суурьшлын тогтвор', verified: 'Дата баталгаажилт'
      }[k] || k;
      return '<div style="margin-bottom:15px"><div style="display:flex;font-size:12.5px;margin-bottom:6px">' +
        '<span style="color:var(--text-dim)">' + label + '</span>' +
        '<b style="margin-left:auto" id="wv-' + k + '">' + W[k].toFixed(2) + '</b></div>' +
        '<input type="range" class="wsl" data-k="' + k + '" min="0" max="3" step="0.05" value="' +
        W[k] + '" style="width:100%"></div>';
    }).join('');
    $('wSliders').querySelectorAll('.wsl').forEach(sl => sl.oninput = () => {
      const o = {}; o[sl.dataset.k] = +sl.value;
      AI().setWeights(o);
      $('wv-' + sl.dataset.k).textContent = (+sl.value).toFixed(2);
      localStorage.setItem('civicos.weights', JSON.stringify(AI().getWeights()));
    });
    $('wReset').onclick = () => {
      localStorage.removeItem('civicos.weights');
      location.reload();
    };

    /* Хэрэглэгчид */
    drawUsers();
    $('usrAdd').onclick = () => global.CivicAuth.addUserForm();

    /* Supabase */
    $('sbUrl').value = st.cfg.sbUrl || '';
    $('sbKey').value = st.cfg.sbKey || '';
    sbStatus();
    $('sbSave').onclick = async () => {
      const ok = await st.connectSupabase($('sbUrl').value.trim(), $('sbKey').value.trim());
      toast(ok ? 'Supabase холбогдлоо' : 'Холбогдсонгүй — URL/key шалгана уу', ok ? 'ok' : 'err');
      sbStatus();
    };
    $('sbPush').onclick = async () => {
      try { await st.pushToSupabase(); toast('Сервер рүү хадгаллаа', 'ok'); }
      catch (e) { toast('Алдаа: ' + e.message, 'err'); }
    };
    $('sbPull').onclick = async () => {
      confirmBox('Серверээс татах уу?', 'Локал дата серверийн датагаар солигдоно.', async () => {
        try { await st.pullFromSupabase(); toast('Татагдлаа', 'ok'); refresh(); }
        catch (e) { toast('Алдаа: ' + e.message, 'err'); }
      });
    };

    /* Дата */
    const d = st.db;
    $('dbStats').innerHTML = [
      ['Өрх', d.households.length], ['Иргэн', d.citizens.length], ['Уулзалт', d.interactions.length],
      ['Гомдол', d.issues.length], ['Хөтөлбөр', d.programs.length], ['Даалгавар', d.tasks.length]
    ].map(([l, v]) => '<div class="m"><div class="l">' + l + '</div><div class="v">' + fmt(v) + '</div></div>').join('');
    $('dbReseed').onclick = () => confirmBox('Жишээ дата дахин үүсгэх үү?',
      'Одоогийн бүх дата устаж, шинэ жишээ дата үүснэ.',
      () => { S().reseed(1400); toast('Дата шинэчлэгдлээ', 'ok'); location.reload(); });
    $('dbClear').onclick = () => confirmBox('Бүх датаг устгах уу?',
      'Буцаах боломжгүй. Урьдчилан JSON нөөц ав.',
      () => { S().clearAll(); toast('Устгагдлаа', 'ok'); refresh(); });
  }

  function sbStatus() {
    const st = S();
    $('sbStatus').innerHTML = st.sb
      ? '<span style="color:var(--green)">● Холбогдсон</span> — push/pull ашиглах боломжтой. ' +
      'Хүснэгтүүдийг үүсгэхийн тулд <code>supabase-setup.sql</code>-г ажиллуулсан байх ёстой.'
      : '<span style="color:var(--text-mute)">○ Холбогдоогүй</span> — дата зөвхөн энэ браузерт хадгалагдаж байна.';
  }

  function drawUsers() {
    const users = global.CivicAuth.list();
    $('usrTable').innerHTML = '<thead><tr><th>Хэрэглэгч</th><th>Эрх</th><th>Үүсгэсэн</th><th></th></tr></thead><tbody>' +
      users.map(u => '<tr><td><b>' + esc(u.u) + '</b></td>' +
        '<td><span class="tag t-purple">' + esc((K().ROLES[u.r] || {}).name || u.r) + '</span></td>' +
        '<td style="font-size:12px;color:var(--text-mute)">' + esc((u.c || '').slice(0, 10)) + '</td>' +
        '<td style="text-align:right"><button class="btn sm usrdel" data-u="' + esc(u.u) + '">Устгах</button></td></tr>').join('') +
      '</tbody>';
    $('usrTable').querySelectorAll('.usrdel').forEach(b => b.onclick = () => {
      if (users.length <= 1) return toast('Сүүлийн хэрэглэгчийг устгах боломжгүй', 'err');
      global.CivicAuth.remove(b.dataset.u); drawUsers(); toast('Устгагдлаа', 'ok');
    });
  }

  /* ═══════════ Export ═══════════ */

  global.CivicUI = {
    go, render, refresh, toast, toggleSidebar, openDrawer, closeDrawer, openModal, closeModal,
    openHousehold, householdForm, staffForm, taskForm, confirmBox, drawUsers, badges, initials
  };

})(window);
