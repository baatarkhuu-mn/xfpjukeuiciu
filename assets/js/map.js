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

    const light = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd', maxZoom: 20
    });
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19
    });
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri', maxZoom: 19
    });
    light.addTo(map);
    L.control.layers({ 'Цайвар (дэлгэрэнгүй)': light, 'Стандарт': osm, 'Хиймэл дагуул': sat }, null,
      { position: 'topleft' }).addTo(map);
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

    const deb = debounce(() => { readFilters(); refresh(); }, 220);
    $('mapQ').addEventListener('input', deb);
    ['mapDist', 'mapKhoroo', 'mapStreet', 'mapSup', 'mapStaff', 'mapProg'].forEach(id => {
      $(id).addEventListener('change', () => {
        if (id === 'mapDist') { fillKhoroo(); fillStreet(); }
        if (id === 'mapKhoroo') fillStreet();
        readFilters(); refresh();
      });
    });
    $('mapProb').addEventListener('input', e => {
      $('mapProbV').textContent = e.target.value + '%';
      deb();
    });
    $('mapUncontacted').addEventListener('change', () => { readFilters(); refresh(); });

    $('mvMarkers').onclick = () => setMode('markers');
    $('mvHeat').onclick = () => setMode('heat');
    $('mvKhoroo').onclick = () => setMode('khoroo');
    $('mvFit').onclick = fit;
    $('mvExport').onclick = () => {
      global.CivicIO.exportAs('households-xlsx', rows);
      global.CivicUI.toast(rows.length + ' өрхийг татаж байна', 'ok');
    };

    document.getElementById('mapLegend').innerHTML =
      '<div class="t">Дэмжлэгийн түвшин</div>' +
      [5, 4, 3, 2, 1, 0].map(k => '<div class="row"><i class="dot" style="background:' +
        K().SUPPORT[k].color + '"></i>' + K().SUPPORT[k].name + '</div>').join('');
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
      'border-radius:8px;background:#2557d6;color:#fff;font-weight:600;font-size:12.5px;cursor:pointer">' +
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
    [['mvMarkers', 'markers'], ['mvHeat', 'heat'], ['mvKhoroo', 'khoroo']].forEach(([id, m]) => {
      const b = document.getElementById(id);
      if (b) b.classList.toggle('primary', mode === m);
    });
  }

  function fit() {
    if (!ready) return;
    const pts = rows.filter(h => h.lat && h.lng).map(h => [h.lat, h.lng]);
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.08));
    else map.setView([47.9185, 106.9175], 12);
  }

  function focus(h) {
    if (!ready) init();
    global.CivicUI.go('map');
    setTimeout(() => {
      map.invalidateSize();
      if (h && h.lat && h.lng) {
        map.setView([h.lat, h.lng], 17);
        L.popup().setLatLng([h.lat, h.lng]).setContent(popupHtml(h, AI().score(h))).openOn(map);
      }
    }, 220);
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

  global.CivicMap = { init, refresh, resetFilters, fit, focus, invalidate, fillSelects, setMode };

})(window);
