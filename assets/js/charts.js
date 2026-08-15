/* ==========================================================================
   charts.js — Хөнгөн SVG график (гадны сангүй)
   ========================================================================== */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmt(n) { return (Math.round(n) || 0).toLocaleString('mn-MN'); }
  function pc(v, d) { return ((v || 0) * 100).toFixed(d == null ? 0 : d) + '%'; }

  /* ---------- Sparkline ---------- */
  function spark(values, color, h) {
    h = h || 34;
    const w = 220, n = values.length;
    if (!n) return '';
    const mx = Math.max.apply(null, values), mn = Math.min.apply(null, values);
    const rng = (mx - mn) || 1;
    const pts = values.map((v, i) => [i / (n - 1 || 1) * w, h - 3 - ((v - mn) / rng) * (h - 8)]);
    const d = 'M ' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ');
    const id = 'sg' + Math.random().toString(36).slice(2, 8);
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + color + '" stop-opacity=".35"/>' +
      '<stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + d + ' L ' + w + ' ' + h + ' L 0 ' + h + ' Z" fill="url(#' + id + ')"/>' +
      '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.8" ' +
      'stroke-linejoin="round" stroke-linecap="round"/>' +
      pts.filter((p, i) => i === pts.length - 1).map(p =>
        '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.6" fill="' + color + '"/>').join('') +
      '</svg>';
  }

  /* ---------- Талбайт шугаман график ---------- */
  function areaChart(series, opts) {
    opts = opts || {};
    const W = 720, H = opts.height || 250, P = { t: 14, r: 14, b: 30, l: 42 };
    const n = series[0].data.length;
    if (!n) return '<div class="empty"><p>Дата алга</p></div>';
    let mx = 0;
    series.forEach(s => s.data.forEach(v => { if (v > mx) mx = v; }));
    mx = mx || 1;
    const step = Math.pow(10, Math.floor(Math.log10(mx)));
    const top = Math.ceil(mx / step) * step;
    const x = i => P.l + (i / (n - 1 || 1)) * (W - P.l - P.r);
    const y = v => P.t + (1 - v / top) * (H - P.t - P.b);

    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = top * i / 4, yy = y(v);
      g += '<line x1="' + P.l + '" y1="' + yy.toFixed(1) + '" x2="' + (W - P.r) + '" y2="' + yy.toFixed(1) +
        '" stroke="#1e1e36" stroke-width="1" stroke-dasharray="3 4"/>' +
        '<text x="' + (P.l - 8) + '" y="' + (yy + 4).toFixed(1) + '" fill="#6c6c8c" font-size="10.5" text-anchor="end">' +
        fmt(v) + '</text>';
    }
    let paths = '';
    series.forEach((s, si) => {
      const pts = s.data.map((v, i) => [x(i), y(v)]);
      const d = 'M ' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ');
      const id = 'ac' + si + Math.random().toString(36).slice(2, 6);
      if (s.fill !== false) {
        paths += '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="' + s.color + '" stop-opacity=".30"/>' +
          '<stop offset="1" stop-color="' + s.color + '" stop-opacity="0"/></linearGradient></defs>' +
          '<path d="' + d + ' L ' + x(n - 1) + ' ' + y(0) + ' L ' + x(0) + ' ' + y(0) + ' Z" fill="url(#' + id + ')"/>';
      }
      paths += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2.2" ' +
        'stroke-linejoin="round" stroke-linecap="round"/>';
      paths += pts.map(p => '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) +
        '" r="3" fill="#0b0b13" stroke="' + s.color + '" stroke-width="2"/>').join('');
    });
    let lbl = '';
    const skip = Math.ceil(n / 8);
    (opts.labels || []).forEach((L, i) => {
      if (i % skip === 0 || i === n - 1) {
        lbl += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 9) + '" fill="#6c6c8c" font-size="10.5" ' +
          'text-anchor="middle">' + esc(L) + '</text>';
      }
    });
    const leg = series.length > 1 ? '<div style="display:flex;gap:16px;margin-top:8px;font-size:12px;color:var(--text-dim)">' +
      series.map(s => '<span style="display:flex;align-items:center;gap:6px">' +
        '<i class="dot" style="background:' + s.color + '"></i>' + esc(s.name) + '</span>').join('') + '</div>' : '';

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block">' +
      g + paths + lbl + '</svg>' + leg;
  }

  /* ---------- Donut ---------- */
  function donut(items, centerVal, centerLbl, size) {
    size = size || 190;
    const total = items.reduce((s, i) => s + i.value, 0) || 1;
    const R = size / 2, r1 = R - 6, r0 = R - 34;
    let a = -Math.PI / 2, out = '';
    items.forEach(it => {
      if (!it.value) return;
      const ang = it.value / total * Math.PI * 2;
      const a2 = a + ang;
      const big = ang > Math.PI ? 1 : 0;
      const p = (rr, ang2) => [R + Math.cos(ang2) * rr, R + Math.sin(ang2) * rr];
      const [x1, y1] = p(r1, a), [x2, y2] = p(r1, a2 - 0.012);
      const [x3, y3] = p(r0, a2 - 0.012), [x4, y4] = p(r0, a);
      out += '<path d="M ' + x1.toFixed(2) + ' ' + y1.toFixed(2) +
        ' A ' + r1 + ' ' + r1 + ' 0 ' + big + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2) +
        ' L ' + x3.toFixed(2) + ' ' + y3.toFixed(2) +
        ' A ' + r0 + ' ' + r0 + ' 0 ' + big + ' 0 ' + x4.toFixed(2) + ' ' + y4.toFixed(2) + ' Z" ' +
        'fill="' + it.color + '" opacity=".92"><title>' + esc(it.name) + ': ' + fmt(it.value) + '</title></path>';
      a = a2;
    });
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' + out +
      '<text x="' + R + '" y="' + (R - 2) + '" text-anchor="middle" fill="#e9e9f5" font-size="' +
      (size / 6.5).toFixed(0) + '" font-weight="700">' + esc(centerVal) + '</text>' +
      '<text x="' + R + '" y="' + (R + 19) + '" text-anchor="middle" fill="#6c6c8c" font-size="11.5">' +
      esc(centerLbl) + '</text></svg>';
  }

  /* ---------- Босоо баганан график ---------- */
  function barChart(items, opts) {
    opts = opts || {};
    const W = 700, H = opts.height || 230, P = { t: 26, r: 10, b: 34, l: 34 };
    if (!items.length) return '<div class="empty"><p>Дата алга</p></div>';
    const mx = Math.max.apply(null, items.map(i => i.value)) || 1;
    const bw = (W - P.l - P.r) / items.length;
    const y = v => P.t + (1 - v / mx) * (H - P.t - P.b);
    let out = '';
    for (let i = 0; i <= 3; i++) {
      const yy = P.t + (H - P.t - P.b) * i / 3;
      out += '<line x1="' + P.l + '" y1="' + yy + '" x2="' + (W - P.r) + '" y2="' + yy +
        '" stroke="#1e1e36" stroke-dasharray="3 4"/>';
    }
    items.forEach((it, i) => {
      const bx = P.l + i * bw + bw * 0.22, w = bw * 0.56;
      const by = y(it.value), hh = H - P.b - by;
      out += '<rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + w.toFixed(1) +
        '" height="' + Math.max(1, hh).toFixed(1) + '" rx="5" fill="' + (it.color || '#7c5cff') + '" opacity=".9"/>' +
        '<text x="' + (bx + w / 2).toFixed(1) + '" y="' + (by - 7).toFixed(1) +
        '" text-anchor="middle" fill="#e9e9f5" font-size="11.5" font-weight="650">' +
        esc(it.label != null ? it.label : fmt(it.value)) + '</text>' +
        '<text x="' + (bx + w / 2).toFixed(1) + '" y="' + (H - 12) +
        '" text-anchor="middle" fill="#6c6c8c" font-size="10.5">' + esc(it.name) + '</text>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block">' + out + '</svg>';
  }

  /* ---------- Хэвтээ бар жагсаалт ---------- */
  function hbars(items, opts) {
    opts = opts || {};
    const mx = Math.max.apply(null, items.map(i => i.value)) || 1;
    return items.map(it =>
      '<div class="barrow"><div class="nm" title="' + esc(it.name) + '">' + esc(it.name) + '</div>' +
      '<div class="bartrack"><div class="barfill" style="width:' + (it.value / mx * 100).toFixed(1) +
      '%;background:' + (it.color || '#7c5cff') + '"></div></div>' +
      '<div class="vl">' + esc(it.label != null ? it.label : fmt(it.value)) + '</div></div>'
    ).join('') || '<div class="empty"><p>Дата алга</p></div>';
  }

  /* ---------- Гистограм ---------- */
  function histogram(values, bins, color) {
    bins = bins || 10;
    const counts = new Array(bins).fill(0);
    values.forEach(v => {
      const i = Math.min(bins - 1, Math.floor(v * bins));
      counts[i]++;
    });
    return barChart(counts.map((c, i) => ({
      name: (i * 100 / bins) + '–' + ((i + 1) * 100 / bins) + '%',
      value: c,
      color: i < 3 ? '#f2385a' : i < 4 ? '#fb923c' : i < 6 ? '#f5b428' : i < 8 ? '#7ee08a' : '#16c98d'
    })), { height: 240 });
  }

  /* ---------- Гauge (тойрог) ---------- */
  function gauge(prob, color, size) {
    size = size || 96;
    const R = size / 2, rr = R - 8, C = 2 * Math.PI * rr;
    const off = C * (1 - prob);
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + R + '" cy="' + R + '" r="' + rr + '" fill="none" stroke="#22223c" stroke-width="9"/>' +
      '<circle cx="' + R + '" cy="' + R + '" r="' + rr + '" fill="none" stroke="' + color +
      '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) +
      '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 ' + R + ' ' + R + ')"/>' +
      '<text x="' + R + '" y="' + (R + 6) + '" text-anchor="middle" fill="#e9e9f5" font-size="20" ' +
      'font-weight="700">' + Math.round(prob * 100) + '%</text></svg>';
  }

  /* ---------- Явцын мөр ---------- */
  function progress(v, color) {
    return '<div style="display:flex;align-items:center;gap:9px">' +
      '<div class="bartrack" style="flex:1;height:7px"><div class="barfill" style="width:' +
      Math.round(v * 100) + '%;background:' + (color || '#7c5cff') + '"></div></div>' +
      '<span style="font-size:11.5px;color:var(--text-dim);min-width:34px;text-align:right">' +
      Math.round(v * 100) + '%</span></div>';
  }

  global.CivicChart = { spark, areaChart, donut, barChart, hbars, histogram, gauge, progress, esc, fmt, pc };

})(window);
