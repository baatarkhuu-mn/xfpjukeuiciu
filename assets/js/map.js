/* ==========================================================================
   map.js — Leaflet газрын зураг: өрхийн цэг, дулаан зураглал, хорооны бүс
   ========================================================================== */
(function (global) {
  'use strict';

  const S = () => global.CivicStore;
  const K = () => global.CivicConst;
  const AI = () => global.CivicAI;

  let map = null, cluster = null, heat = null, khLayer = null, ready = false;
  let mode = 'markers';
  let rows = [];

  const F = {
    q: '', district: '', khoroo: '', street: '', support: '',
    staff: '', program: '', minProb: 0, uncontacted: false
  };

  /* ---------- Эхлүүлэх ---------- */
  function init() {
    if (ready || !global.L) return;
    map = L.map('leaflet', {
      center: [47.9185, 106.9175],
      zoom: 12,
      zoomControl: true,
      preferCanvas: true
    });

    /* Google давхаргууд — хамгийн шинэ зураглал (албан бус tile endpoint,
       API түлхүүр шаардахгүй; их ачаалалтай бол Maps API түлхүүр рүү шилжинэ) */
    const gRoad = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&hl=mn&x={x}&y={y}&z={z}', {
      subdomains: '0123', maxZoom: 21, attribution: '&copy; Google'
    });
    const gHybrid = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&hl=mn&x={x}&y={y}&z={z}', {
      subdomains: '0123', maxZoom: 21, attribution: '&copy; Google'
    });
    const gSat = L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      subdomains: '0123', maxZoom: 21, attribution: '&copy; Google'
    });
    const light = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd', maxZoom: 20
    });
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19
    });
    gRoad.addTo(map);
    L.control.layers({
      'Google — зам': gRoad,
      'Google — эрлийз (дагуул + нэр)': gHybrid,
      'Google — хиймэл дагуул': gSat,
      'Цайвар (CARTO)': light,
      'OpenStreetMap': osm
    }, null, { position: 'topleft' }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

    cluster = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 17
    });
    map.addLayer(cluster);
    khLayer = L.layerGroup();

    bindUi();
    ready = true;
    refresh();
    fit();
  }

  /* ---------- UI холбоос ---------- */
  function bindUi() {
    const $ = id => document.getElementById(id);
    fillSelects();

    /* Шүүлтүүр өөрчлөгдөх бүрд илэрцийн бүс рүү автоматаар шилжинэ */
    const apply = () => { readFilters(); refresh(); fit(); };
    const deb = debounce(apply, 260);
    $('mapQ').addEventListener('input', deb);
    ['mapDist', 'mapKhoroo', 'mapStreet', 'mapSup', 'mapStaff', 'mapProg'].forEach(id => {
      $(id).addEventListener('change', () => {
        if (id === 'mapDist') { fillKhoroo(); fillStreet(); }
        if (id === 'mapKhoroo') fillStreet();
        apply();
      });
    });
    $('mapProb').addEventListener('input', e => {
      $('mapProbV').textContent = e.target.value + '%';
      deb();
    });
    $('mapUncontacted').addEventListener('change', apply);

    $('mvMarkers').onclick = () => setMode('markers');
    $('mvHeat').onclick = () => setMode('heat');
    $('mvKhoroo').onclick = () => setMode('khoroo');
    $('mvDistrict').onclick = () => setMode('district');
    $('mvFit').onclick = fit;
    $('mvExport').onclick = () => {
      global.CivicIO.exportAs('households-xlsx', rows);
      global.CivicUI.toast(rows.length + ' өрхийг татаж байна', 'ok');
    };

    updateLegend();
  }

  /* Дүүрэг тус бүрийн ялгах өнгө */
  const DIST_COLORS = ['#0e6bff', '#8b5cf6', '#0d9f6e', '#d97706', '#dc2626',
    '#0891b2', '#be185d', '#65a30d', '#475569', '#7c3aed', '#b45309'];
  function distColor(name) {
    const list = S().districts();
    const i = list.indexOf(name);
    return DIST_COLORS[(i < 0 ? 0 : i) % DIST_COLORS.length];
  }

  function updateLegend() {
    const el = document.getElementById('mapLegend');
    if (!el) return;
    if (mode === 'district') {
      el.innerHTML = '<div class="t">Дүүргийн бүс</div>' +
        S().districts().map(d => '<div class="row"><i class="dot" style="background:' +
          distColor(d) + '"></i>' + esc(d) + '</div>').join('');
    } else if (mode === 'khoroo') {
      el.innerHTML = '<div class="t">Дундаж магадлал</div>' +
        [['≥72%', '#0d8f63'], ['58–72%', '#5cb85c'], ['44–58%', '#b07d06'],
        ['30–44%', '#e2701a'], ['<30%', '#d92549']].map(x =>
          '<div class="row"><i class="dot" style="background:' + x[1] + '"></i>' + x[0] + '</div>').join('');
    } else {
      el.innerHTML = '<div class="t">Дэмжлэгийн түвшин</div>' +
        [5, 4, 3, 2, 1, 0].map(k => '<div class="row"><i class="dot" style="background:' +
          K().SUPPORT[k].color + '"></i>' + K().SUPPORT[k].name + '</div>').join('');
    }
  }

  /* ---------- Convex hull (Andrew's monotone chain) ---------- */
  function hull(pts) {
    if (pts.length < 3) return pts;
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const pt of p) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
      lower.push(pt);
    }
    const upper = [];
    for (let i = p.length - 1; i >= 0; i--) {
      const pt = p[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
      upper.push(pt);
    }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }
  /* Хилийг төвөөс нь бага зэрэг тэлэх — цэгүүд яг ирмэг дээр давхцахгүй */
  function expand(poly, f) {
    if (poly.length < 3) return poly;
    let cy = 0, cx = 0;
    poly.forEach(p => { cy += p[0]; cx += p[1]; });
    cy /= poly.length; cx /= poly.length;
    return poly.map(p => [cy + (p[0] - cy) * f, cx + (p[1] - cx) * f]);
  }

  function fillSelects() {
    const $ = id => document.getElementById(id);
    const st = S();
    opt($('mapDist'), st.districts(), 'Бүх дүүрэг');
    opt($('mapSup'), [5, 4, 3, 2, 1, 0].map(k => ({ v: k, t: K().SUPPORT[k].name })), 'Бүх түвшин');
    opt($('mapStaff'), st.db.staff.map(s => ({ v: s.id, t: s.name })), 'Бүх ухуулагч');
    opt($('mapProg'), st.db.programs.map(p => ({ v: p.id, t: p.name })), 'Бүх хөтөлбөр');
    fillKhoroo(); fillStreet();
  }
  function fillKhoroo() {
    opt(document.getElementById('mapKhoroo'),
      S().khoroosOf(document.getElementById('mapDist').value).map(k => ({ v: k, t: k + '-р хороо' })),
      'Бүх хороо');
  }
  function fillStreet() {
    opt(document.getElementById('mapStreet'),
      S().streetsOf(document.getElementById('mapDist').value, document.getElementById('mapKhoroo').value),
      'Бүх гудамж');
  }
  function opt(sel, items, all) {
    const cur = sel.value;
    sel.innerHTML = '<option value="">' + all + '</option>' + items.map(i => {
      const v = i && i.v !== undefined ? i.v : i;
      const t = i && i.t !== undefined ? i.t : i;
      return '<option value="' + esc(v) + '">' + esc(t) + '</option>';
    }).join('');
    if (Array.from(sel.options).some(o => o.value === cur)) sel.value = cur;
  }

  function readFilters() {
    const $ = id => document.getElementById(id).value;
    F.q = $('mapQ'); F.district = $('mapDist'); F.khoroo = $('mapKhoroo');
    F.street = $('mapStreet'); F.support = $('mapSup'); F.staff = $('mapStaff');
    F.program = $('mapProg'); F.minProb = +$('mapProb');
    F.uncontacted = document.getElementById('mapUncontacted').checked;
  }

  function resetFilters() {
    ['mapQ', 'mapDist', 'mapKhoroo', 'mapStreet', 'mapSup', 'mapStaff', 'mapProg']
      .forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('mapProb').value = 0;
    document.getElementById('mapProbV').textContent = '0%';
    document.getElementById('mapUncontacted').checked = false;
    fillKhoroo(); fillStreet(); readFilters(); refresh(); fit();
  }

  /* ---------- Давхарга сэргээх ---------- */
  function refresh() {
    if (!ready) return;
    rows = S().filter({
      q: F.q, district: F.district, khoroo: F.khoroo, street: F.street,
      support: F.support === '' ? null : F.support, staff: F.staff,
      program: F.program, minProb: F.minProb || null, uncontacted: F.uncontacted
    }).filter(h => h.lat != null && h.lng != null && !isNaN(h.lat) && !isNaN(h.lng));

    cluster.clearLayers();
    khLayer.clearLayers();
    if (heat) { map.removeLayer(heat); heat = null; }

    if (mode === 'markers') {
      if (!map.hasLayer(cluster)) map.addLayer(cluster);
      const batch = rows.slice(0, 6000);
      const markers = batch.map(function (h) {
        const s = AI().score(h);
        const c = K().SUPPORT[h.support].color;
        const size = 9 + Math.min(7, (h.family_size || 1));
        const m = L.marker([h.lat, h.lng], {
          icon: L.divIcon({
            className: '',
            html: '<div class="hh-dot" style="width:' + size + 'px;height:' + size +
              'px;background:' + c + ';opacity:' + (0.55 + s.prob * 0.45).toFixed(2) + '"></div>',
            iconSize: [size, size], iconAnchor: [size / 2, size / 2]
          })
        });
        m.bindPopup(popupHtml(h, s), { maxWidth: 300 });
        m.on('popupopen', function () {
          const btn = document.querySelector('.mp-open[data-id="' + h.id + '"]');
          if (btn) btn.onclick = () => global.CivicUI.openHousehold(h.id);
        });
        return m;
      });
      cluster.addLayers(markers);
      if (rows.length > 6000) {
        global.CivicUI.toast('Хэт олон цэг — эхний 6000-г харууллаа. Шүүлтүүр ашиглана уу.', 'err');
      }

    } else if (mode === 'heat') {
      if (map.hasLayer(cluster)) map.removeLayer(cluster);
      const pts = rows.map(h => [h.lat, h.lng, Math.max(0.08, AI().score(h).prob)]);
      heat = L.heatLayer(pts, {
        radius: 26, blur: 20, maxZoom: 16, minOpacity: 0.28,
        gradient: { 0.0: '#d92549', 0.35: '#e2701a', 0.5: '#b07d06', 0.7: '#5cb85c', 1.0: '#0d8f63' }
      }).addTo(map);

    } else if (mode === 'district') {
      if (map.hasLayer(cluster)) map.removeLayer(cluster);
      if (!map.hasLayer(khLayer)) map.addLayer(khLayer);
      const byDist = new Map();
      rows.forEach(h => {
        if (!byDist.has(h.district)) byDist.set(h.district, []);
        byDist.get(h.district).push(h);
      });
      byDist.forEach(function (list, name) {
        const col = distColor(name);
        const pts = list.map(h => [h.lat, h.lng]);
        const s = S().stats(list);
        const popup =
          '<b style="font-size:14px">' + esc(name) + ' дүүрэг</b><br>' +
          '<span style="color:#51607a">Өрх:</span> <b>' + fmt(s.households) + '</b> · ' +
          '<span style="color:#51607a">Иргэн:</span> <b>' + fmt(s.people) + '</b> · ' +
          '<span style="color:#51607a">Сонгогч:</span> <b>' + fmt(s.voters) + '</b><br>' +
          '<span style="color:#51607a">Дэмжлэг:</span> <b style="color:' + col + '">' +
          Math.round(s.supportRate * 100) + '%</b> · ' +
          '<span style="color:#51607a">AI:</span> <b>' + Math.round(s.avgProb * 100) + '%</b> · ' +
          '<span style="color:#51607a">Хамрагдалт:</span> <b>' + Math.round(s.coverage * 100) + '%</b>' +
          '<button class="mp-dist" data-d="' + esc(name) + '" style="margin-top:10px;width:100%;padding:6px;' +
          'border-radius:8px;background:' + col + ';color:#fff;font-weight:600;font-size:12px;cursor:pointer">' +
          'Энэ дүүргээр шүүх</button>';
        let cy = 0, cx = 0;
        pts.forEach(p => { cy += p[0]; cx += p[1]; });
        cy /= pts.length; cx /= pts.length;
        if (pts.length >= 3) {
          const poly = L.polygon(expand(hull(pts), 1.06), {
            color: col, weight: 2.5, fillColor: col, fillOpacity: 0.13, dashArray: '6 5'
          });
          poly.bindPopup(popup);
          poly.on('popupopen', bindDistBtn);
          poly.addTo(khLayer);
        } else {
          const c = L.circle([cy, cx], { radius: 500, color: col, weight: 2, fillColor: col, fillOpacity: 0.15 });
          c.bindPopup(popup);
          c.on('popupopen', bindDistBtn);
          c.addTo(khLayer);
        }
        L.marker([cy, cx], {
          icon: L.divIcon({
            className: '',
            html: '<div style="color:' + col + ';font-size:13px;font-weight:800;letter-spacing:.3px;' +
              'text-shadow:0 0 4px #fff,0 0 9px #fff,0 0 14px #fff;white-space:nowrap;' +
              'transform:translate(-50%,-50%)">' + esc(name) + '<div style="font-size:10.5px;font-weight:650;' +
              'color:#51607a;text-align:center">' + fmt(s.households) + ' өрх</div></div>',
            iconSize: [0, 0]
          }), interactive: false
        }).addTo(khLayer);
      });

    } else { /* khoroo */
      if (map.hasLayer(cluster)) map.removeLayer(cluster);
      if (!map.hasLayer(khLayer)) map.addLayer(khLayer);
      const groups = S().byKhoroo(rows);
      groups.forEach(function (g) {
        if (!isFinite(g.lat) || !isFinite(g.lng)) return;
        const col = probColor(g.avgProb);
        const r = 140 + Math.sqrt(g.households) * 55;
        const c = L.circle([g.lat, g.lng], {
          radius: r, color: col, weight: 2, fillColor: col, fillOpacity: 0.22
        });
        c.bindPopup(
          '<b style="font-size:13.5px">' + esc(g.key) + '</b><br>' +
          '<span style="color:#51607a">Өрх:</span> <b>' + g.households + '</b> · ' +
          '<span style="color:#51607a">Иргэн:</span> <b>' + g.people + '</b><br>' +
          '<span style="color:#51607a">Дэмжлэг:</span> <b style="color:' + col + '">' +
          Math.round(g.supportRate * 100) + '%</b> · ' +
          '<span style="color:#51607a">AI:</span> <b>' + Math.round(g.avgProb * 100) + '%</b><br>' +
          '<span style="color:#51607a">Хамрагдалт:</span> <b>' + Math.round(g.coverage * 100) + '%</b>'
        );
        c.addTo(khLayer);
        L.marker([g.lat, g.lng], {
          icon: L.divIcon({
            className: '',
            html: '<div style="color:#101827;font-size:11px;font-weight:700;text-shadow:0 0 4px #fff,0 0 8px #fff;' +
              'white-space:nowrap;transform:translate(-50%,-50%)">' + g.khoroo + '</div>',
            iconSize: [0, 0]
          }), interactive: false
        }).addTo(khLayer);
      });
    }

    updateStats();
    updateModeButtons();
    updateLegend();
  }

  function bindDistBtn() {
    const btn = document.querySelector('.mp-dist');
    if (btn) btn.onclick = function () {
      const sel = document.getElementById('mapDist');
      sel.value = btn.dataset.d;
      sel.dispatchEvent(new Event('change'));
      map.closePopup();
      setMode('markers');
      fit();
    };
  }

  function probColor(p) {
    return p >= 0.72 ? '#0d8f63' : p >= 0.58 ? '#5cb85c' : p >= 0.44 ? '#b07d06'
      : p >= 0.30 ? '#e2701a' : '#d92549';
  }

  function popupHtml(h, s) {
    const st = S();
    const sup = K().SUPPORT[h.support];
    const cs = st.citizensOf(h.id);
    const open = st.issuesOf(h.id).filter(i => i.status !== 'Шийдэгдсэн').length;
    return '<div style="min-width:220px">' +
      '<b style="font-size:14px">' + esc(h.head || h.code) + '</b>' +
      '<div style="color:#8493ab;font-size:11.5px;margin:2px 0 9px">' + esc(h.address || '') + '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px">' +
      '<span class="tag ' + sup.cls + '">' + sup.name + '</span>' +
      '<span class="tag ' + s.segment.cls + '">AI ' + s.pct + '%</span>' +
      (open ? '<span class="tag t-s1">' + open + ' гомдол</span>' : '') + '</div>' +
      '<div style="font-size:12px;line-height:1.75;color:#51607a">' +
      'Ам бүл: <b style="color:#101827">' + (h.family_size || 0) + '</b> · Сонгогч: <b style="color:#101827">' +
      cs.filter(c => c.is_voter).length + '</b><br>' +
      'Нам: <b style="color:#101827">' + esc(h.party || '—') + '</b><br>' +
      'Утас: <b style="color:#101827">' + esc(h.phone || '—') + '</b><br>' +
      'Сүүлд: <b style="color:#101827">' + esc(h.last_contact || 'хэзээ ч') + '</b><br>' +
      'Хариуцсан: <b style="color:#101827">' + esc(st.staffName(h.assigned_to)) + '</b></div>' +
      '<button class="mp-open" data-id="' + h.id + '" style="margin-top:11px;width:100%;padding:7px;' +
      'border-radius:8px;background:#0e6bff;color:#fff;font-weight:600;font-size:12.5px;cursor:pointer">' +
      'Дэлгэрэнгүй нээх</button></div>';
  }

  function updateStats() {
    const s = S().stats(rows);
    const el = document.getElementById('mapStats');
    const seg = { core: 0, lean: 0, swing: 0, 'soft-opp': 0, opp: 0 };
    rows.forEach(h => { seg[AI().score(h).segment.key]++; });
    el.innerHTML =
      '<div style="font-size:10.5px;font-weight:700;letter-spacing:.8px;color:var(--text-mute);' +
      'text-transform:uppercase;margin:8px 0 10px">Шүүсэн үр дүн</div>' +
      row('Өрх', fmt(s.households)) +
      row('Иргэн', fmt(s.people)) +
      row('Сонгогч', fmt(s.voters)) +
      row('Дэмжигч', fmt(s.supporters) + ' (' + Math.round(s.supportRate * 100) + '%)') +
      row('Дундаж AI магадлал', Math.round(s.avgProb * 100) + '%') +
      row('Хамрагдалт', Math.round(s.coverage * 100) + '%') +
      '<div style="height:10px"></div>' +
      row('◆ Бат бөх', fmt(seg.core), '#0d8f63') +
      row('◆ Хазайсан дэмжигч', fmt(seg.lean), '#5cb85c') +
      row('◆ Эргэлзэгч', fmt(seg.swing), '#b07d06') +
      row('◆ Хазайсан эсрэг', fmt(seg['soft-opp']), '#e2701a') +
      row('◆ Эсрэг', fmt(seg.opp), '#d92549');
  }
  function row(k, v, c) {
    return '<div class="mapstat"><span style="color:' + (c || 'var(--text-dim)') + '">' + k +
      '</span><span class="vl">' + v + '</span></div>';
  }

  function setMode(m) { mode = m; refresh(); }
  function updateModeButtons() {
    [['mvMarkers', 'markers'], ['mvHeat', 'heat'], ['mvKhoroo', 'khoroo'], ['mvDistrict', 'district']]
      .forEach(([id, m]) => {
        const b = document.getElementById(id);
        if (b) b.classList.toggle('primary', mode === m);
      });
  }

  function fit() {
    if (!ready) return;
    const pts = rows.filter(h => h.lat && h.lng).map(h => [h.lat, h.lng]);
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.08), { maxZoom: 17, animate: false });
    else map.setView([47.9185, 106.9175], 12);
  }

  /* ---------- Өрхийн пин тэмдэглэгээ ---------- */
  let focusPin = null;

  function pinIcon(color) {
    return L.divIcon({
      className: '',
      html: '<svg width="34" height="46" viewBox="0 0 34 46" style="filter:drop-shadow(0 3px 6px rgba(16,24,39,.4))">' +
        '<path d="M17 1C8 1 1 8.1 1 17c0 11.5 16 28 16 28s16-16.5 16-28C33 8.1 26 1 17 1z" ' +
        'fill="' + (color || '#0e6bff') + '" stroke="#fff" stroke-width="2.5"/>' +
        '<circle cx="17" cy="16.5" r="6" fill="#fff"/></svg>',
      iconSize: [34, 46], iconAnchor: [17, 45], popupAnchor: [0, -42]
    });
  }

  function showPin(h) {
    if (focusPin) { map.removeLayer(focusPin); focusPin = null; }
    if (!h || h.lat == null || h.lng == null) return;
    const s = AI().score(h);
    focusPin = L.marker([h.lat, h.lng], { icon: pinIcon(s.segment.color), zIndexOffset: 900 });
    focusPin.bindPopup(popupHtml(h, s), { maxWidth: 300 });
    focusPin.on('popupopen', function () {
      const btn = document.querySelector('.mp-open[data-id="' + h.id + '"]');
      if (btn) btn.onclick = () => global.CivicUI.openHousehold(h.id);
    });
    focusPin.addTo(map);
    focusPin.openPopup();
  }

  function focus(h) {
    if (!ready) init();
    global.CivicUI.go('map');
    setTimeout(() => {
      map.invalidateSize();
      if (h && h.lat && h.lng) {
        map.setView([h.lat, h.lng], 17);
        showPin(h);
      }
    }, 220);
  }

  /* ---------- Байршил гараар тэмдэглэх ---------- */
  let edit = null;   // { id, marker, bar, clickFn }

  function editLocation(hid) {
    const h = S().household(hid);
    if (!h) return;
    global.CivicUI.closeDrawer();
    if (!ready) init();
    global.CivicUI.go('map');
    setTimeout(() => {
      map.invalidateSize();
      cancelEdit();
      const start = (h.lat != null && h.lng != null)
        ? [h.lat, h.lng]
        : [map.getCenter().lat, map.getCenter().lng];
      map.setView(start, h.lat != null ? 17 : 14);

      const mk = L.marker(start, { icon: pinIcon('#d97706'), draggable: true, zIndexOffset: 1000 });
      mk.addTo(map);

      const bar = document.createElement('div');
      bar.style.cssText = 'position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:600;' +
        'background:rgba(255,255,255,.97);border:1px solid var(--border);border-radius:12px;' +
        'padding:10px 14px;display:flex;gap:10px;align-items:center;box-shadow:var(--shadow);' +
        'font-size:12.5px;max-width:92%;flex-wrap:wrap';
      bar.innerHTML = '<span>📍 <b>' + esc(h.head || h.code) + '</b> — зураг дээр дарж эсвэл пинг чирж байршлыг тэмдэглэ</span>' +
        '<button class="btn sm primary" id="locSave">✓ Хадгалах</button>' +
        '<button class="btn sm" id="locCancel">Болих</button>';
      document.getElementById('mapbox').appendChild(bar);

      const clickFn = e => mk.setLatLng(e.latlng);
      map.on('click', clickFn);

      edit = { id: hid, marker: mk, bar: bar, clickFn: clickFn };

      bar.querySelector('#locSave').onclick = function () {
        const ll = mk.getLatLng();
        S().updateHousehold(hid, { lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6), verified: true });
        const saved = S().household(hid);
        cancelEdit();
        global.CivicUI.toast('Байршил хадгалагдлаа', 'ok');
        refresh();
        showPin(saved);
      };
      bar.querySelector('#locCancel').onclick = function () {
        cancelEdit();
        global.CivicUI.toast('Цуцлагдлаа', '');
      };
    }, 240);
  }

  function cancelEdit() {
    if (!edit) return;
    map.off('click', edit.clickFn);
    map.removeLayer(edit.marker);
    if (edit.bar && edit.bar.parentNode) edit.bar.parentNode.removeChild(edit.bar);
    edit = null;
  }

  function invalidate() { if (ready) setTimeout(() => map.invalidateSize(), 120); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmt(n) { return (n || 0).toLocaleString('mn-MN'); }
  function debounce(fn, ms) {
    let t; return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  global.CivicMap = { init, refresh, resetFilters, fit, focus, invalidate, fillSelects, setMode, editLocation };

})(window);
