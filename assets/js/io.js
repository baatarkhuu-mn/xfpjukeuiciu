/* ==========================================================================
   io.js — Импорт (CSV/XLSX/JSON + багана тааруулах) ба Экспорт
   ========================================================================== */
(function (global) {
  'use strict';

  const S = () => global.CivicStore;
  const K = () => global.CivicConst;

  /* ---------- Зорилтот талбарууд ---------- */
  const FIELDS = [
    { k: 'code', n: 'Өрхийн код', hint: ['код', 'code', 'id', 'дугаар', 'no'] },
    { k: 'head', n: 'Өрхийн тэргүүн', hint: ['тэргүүн', 'нэр', 'name', 'head', 'овог', 'ovog', 'ner'] },
    { k: 'district', n: 'Дүүрэг', hint: ['дүүрэг', 'duureg', 'district', 'аймаг', 'сум'] },
    { k: 'khoroo', n: 'Хороо', hint: ['хороо', 'khoroo', 'horoo', 'ward', 'баг'] },
    { k: 'street', n: 'Гудамж / хэсэг', hint: ['гудамж', 'street', 'хэсэг', 'gudamj', 'хороолол'] },
    { k: 'building', n: 'Байр / хашаа', hint: ['байр', 'building', 'хашаа', 'блок'] },
    { k: 'apartment', n: 'Тоот', hint: ['тоот', 'apartment', 'apt', 'toot'] },
    { k: 'address', n: 'Бүтэн хаяг', hint: ['хаяг', 'address', 'hayag', 'байршил'] },
    { k: 'lat', n: 'Өргөрөг (lat)', hint: ['lat', 'өргөрөг', 'latitude', 'y'] },
    { k: 'lng', n: 'Уртраг (lng)', hint: ['lng', 'lon', 'уртраг', 'longitude', 'x'] },
    { k: 'family_size', n: 'Ам бүлийн тоо', hint: ['ам бүл', 'ambul', 'family', 'гишүүд', 'тоо', 'size'] },
    { k: 'phone', n: 'Утас', hint: ['утас', 'phone', 'дугаар', 'tel', 'mobile', 'utas'] },
    { k: 'housing', n: 'Орон сууцны төрөл', hint: ['орон сууц', 'housing', 'байрны төрөл', 'амьдрах'] },
    { k: 'income', n: 'Орлогын түвшин', hint: ['орлого', 'income', 'амьжиргаа'] },
    { k: 'support', n: 'Дэмжлэгийн түвшин', hint: ['дэмжлэг', 'support', 'байр суурь', 'stance', 'хандлага'] },
    { k: 'party', n: 'Нам', hint: ['нам', 'party', 'намын'] },
    { k: 'last_contact', n: 'Сүүлд холбогдсон', hint: ['холбогдсон', 'уулзсан', 'огноо', 'date', 'contact', 'сүүлд'] },
    { k: 'tags', n: 'Шошго', hint: ['шошго', 'tag', 'ангилал', 'тэмдэглэгээ'] },
    { k: 'notes', n: 'Тэмдэглэл', hint: ['тэмдэглэл', 'note', 'тайлбар', 'comment', 'сэтгэгдэл'] },
    { k: 'assigned_to', n: 'Хариуцсан ухуулагч', hint: ['хариуцсан', 'ухуулагч', 'canvasser', 'assigned', 'ажилтан'] },
    { k: '_person_name', n: '‣ Иргэний нэр (мөр = 1 хүн)', hint: ['иргэн', 'хүний нэр', 'person', 'гишүүн'] },
    { k: '_person_gender', n: '‣ Хүйс', hint: ['хүйс', 'gender', 'sex', 'huis'] },
    { k: '_person_birth', n: '‣ Төрсөн он / нас', hint: ['төрсөн', 'нас', 'birth', 'age', 'он'] },
    { k: '_person_edu', n: '‣ Боловсрол', hint: ['боловсрол', 'education', 'сурсан'] },
    { k: '_person_job', n: '‣ Мэргэжил / ажил', hint: ['мэргэжил', 'ажил', 'occupation', 'job', 'албан тушаал'] },
    { k: '_person_reg', n: '‣ Регистр', hint: ['регистр', 'register', 'рд'] }
  ];

  /* ---------- Утга хөрвүүлэлт ---------- */
  const SUP_WORDS = [
    { re: /бат|хатуу|core|strong|маш сайн|тийм/i, v: 5 },
    { re: /дэмж|support|эерэг|positive|сайн/i, v: 4 },
    { re: /эргэлз|swing|undecided|дунд|саармаг|neutral|мэдэхгүй/i, v: 3 },
    { re: /хазай|soft|сул эсрэг|lean opp/i, v: 2 },
    { re: /эсрэг|против|oppose|against|үгүй|сөрөг/i, v: 1 },
    { re: /тодорхойгүй|unknown|тодорхой бус|—|^$/i, v: 0 }
  ];

  function parseSupport(v) {
    if (v == null || v === '') return 0;
    const n = Number(v);
    if (!isNaN(n)) {
      if (n >= 0 && n <= 5) return Math.round(n);
      if (n > 5 && n <= 100) return Math.max(0, Math.min(5, Math.round(n / 20)));
    }
    const s = String(v).trim();
    for (const w of SUP_WORDS) if (w.re.test(s)) return w.v;
    return 0;
  }

  function parseDate(v) {
    if (!v) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v).trim();
    let m = s.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (m) return m[1] + '-' + p2(m[2]) + '-' + p2(m[3]);
    m = s.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
    if (m) return m[3] + '-' + p2(m[2]) + '-' + p2(m[1]);
    const n = Number(s);
    if (!isNaN(n) && n > 20000 && n < 60000) {   // Excel сериал огноо
      return new Date(Date.UTC(1899, 11, 30 + n)).toISOString().slice(0, 10);
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  function p2(x) { return String(x).padStart(2, '0'); }

  function parseKhoroo(v) {
    if (v == null) return 0;
    const m = String(v).match(/\d+/);
    return m ? +m[0] : 0;
  }
  function parseNum(v) {
    if (v == null || v === '') return null;
    const n = Number(String(v).replace(/[^\d.\-]/g, ''));
    return isNaN(n) ? null : n;
  }
  function parseGender(v) {
    const s = String(v || '').trim().toLowerCase();
    if (/^(эр|er|m|male|эрэгтэй|1)$/.test(s)) return 'Эр';
    if (/^(эм|em|f|female|эмэгтэй|2)$/.test(s)) return 'Эм';
    return '';
  }
  function parseBirth(v) {
    const n = parseNum(v);
    if (n == null) return null;
    if (n > 1900 && n < 2030) return Math.round(n);
    if (n > 0 && n < 120) return new Date().getFullYear() - Math.round(n);   // нас өгсөн
    return null;
  }
  function normDistrict(v) {
    const s = String(v || '').replace(/дүүрэг|duureg|district/gi, '').trim();
    const hit = K().DISTRICTS.find(d => d.name.toLowerCase() === s.toLowerCase());
    return hit ? hit.name : s;
  }

  /* ---------- Файл унших ---------- */
  function readFile(file) {
    return new Promise(function (resolve, reject) {
      const name = (file.name || '').toLowerCase();
      const rdr = new FileReader();
      rdr.onerror = () => reject(new Error('Файл уншиж чадсангүй'));

      if (/\.json$/.test(name)) {
        rdr.onload = e => {
          try { resolve({ kind: 'json', data: JSON.parse(e.target.result) }); }
          catch (err) { reject(new Error('JSON бүтэц буруу байна')); }
        };
        rdr.readAsText(file, 'utf-8');

      } else if (/\.(xlsx|xls)$/.test(name)) {
        rdr.onload = e => {
          try {
            const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
            const sh = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sh, { defval: '', raw: false });
            resolve({ kind: 'rows', rows: rows, sheet: wb.SheetNames[0], sheets: wb.SheetNames });
          } catch (err) { reject(new Error('Excel файл уншиж чадсангүй: ' + err.message)); }
        };
        rdr.readAsArrayBuffer(file);

      } else {
        rdr.onload = e => {
          const res = Papa.parse(e.target.result, {
            header: true, skipEmptyLines: 'greedy', dynamicTyping: false,
            transformHeader: h => String(h || '').trim()
          });
          if (!res.data || !res.data.length) return reject(new Error('Мөр олдсонгүй'));
          resolve({ kind: 'rows', rows: res.data });
        };
        rdr.readAsText(file, 'utf-8');
      }
    });
  }

  /* ---------- Автомат багана тааруулах ---------- */
  function autoMap(headers) {
    const map = {};
    const used = new Set();
    FIELDS.forEach(function (f) {
      let best = null, bestScore = 0;
      headers.forEach(function (h) {
        if (used.has(h)) return;
        const hl = String(h).toLowerCase().trim();
        let sc = 0;
        if (hl === f.k) sc = 100;
        else if (hl === f.n.toLowerCase()) sc = 95;
        else {
          f.hint.forEach(function (hint) {
            if (hl === hint) sc = Math.max(sc, 90);
            else if (hl.indexOf(hint) >= 0) sc = Math.max(sc, 60 + hint.length);
            else if (hint.indexOf(hl) >= 0 && hl.length > 2) sc = Math.max(sc, 45);
          });
        }
        if (sc > bestScore) { bestScore = sc; best = h; }
      });
      if (best && bestScore >= 45) { map[f.k] = best; used.add(best); }
    });
    return map;
  }

  /* ---------- Мөрүүдийг өрх/иргэн болгох ---------- */
  function transform(rows, map, opts) {
    opts = opts || {};
    const g = (row, key) => map[key] ? row[map[key]] : '';
    const houseByKey = new Map();
    const households = [], citizens = [];
    const warnings = [];
    const existing = opts.dedupe ? new Map(S().db.households.map(h => [dedupeKey(h), h])) : new Map();
    const staffByName = new Map(S().db.staff.map(s => [String(s.name).trim().toLowerCase(), s.id]));
    let seq = S().db.households.length;

    rows.forEach(function (row, ri) {
      const district = normDistrict(g(row, 'district'));
      const khoroo = parseKhoroo(g(row, 'khoroo'));
      const street = String(g(row, 'street') || '').trim();
      const code = String(g(row, 'code') || '').trim();
      const head = String(g(row, 'head') || '').trim();
      const addr = String(g(row, 'address') || '').trim();

      const key = code || [district, khoroo, street, String(g(row, 'building') || ''),
        String(g(row, 'apartment') || ''), head || addr].join('|').toLowerCase();

      let h = houseByKey.get(key);
      if (!h) {
        const prev = existing.get(key);
        seq++;
        let lat = parseNum(g(row, 'lat')), lng = parseNum(g(row, 'lng'));
        if ((lat == null || lng == null || Math.abs(lat) > 90) && opts.geo !== false) {
          const c = khorooCentroid(district, khoroo, ri);
          lat = c.lat; lng = c.lng;
        }
        const rawStaff = String(g(row, 'assigned_to') || '').trim().toLowerCase();
        h = {
          id: prev ? prev.id : K().uid('hh'),
          code: code || (prev ? prev.code : 'ӨР-' + String(seq).padStart(5, '0')),
          district: district,
          khoroo: khoroo,
          street: street,
          building: String(g(row, 'building') || '').trim(),
          apartment: String(g(row, 'apartment') || '').trim(),
          address: addr || [district ? district + ' дүүрэг' : '', khoroo ? khoroo + '-р хороо' : '', street]
            .filter(Boolean).join(', '),
          lat: lat, lng: lng,
          head: head,
          family_size: parseNum(g(row, 'family_size')) || 0,
          phone: String(g(row, 'phone') || '').replace(/\s/g, ''),
          housing: String(g(row, 'housing') || '').trim(),
          income: String(g(row, 'income') || '').trim(),
          support: parseSupport(g(row, 'support')),
          party: String(g(row, 'party') || '').trim() || 'Тодорхойгүй',
          programs: prev ? (prev.programs || []) : [],
          last_contact: parseDate(g(row, 'last_contact')),
          tags: String(g(row, 'tags') || '').split(/[,;|]/).map(s => s.trim()).filter(Boolean),
          notes: String(g(row, 'notes') || '').trim(),
          assigned_to: staffByName.get(rawStaff) || (prev ? prev.assigned_to : ''),
          verified: true,
          updated_at: K().today(),
          _isUpdate: !!prev,
          _row: ri + 2
        };
        houseByKey.set(key, h);
        households.push(h);
        if (!district) warnings.push('Мөр ' + (ri + 2) + ': дүүрэг хоосон');
        if (lat == null || lng == null) warnings.push('Мөр ' + (ri + 2) + ': координат тодорхойлогдсонгүй');
      }

      /* Иргэн (нэг мөр = нэг хүн бол) */
      const pname = String(g(row, '_person_name') || '').trim();
      if (pname) {
        const by = parseBirth(g(row, '_person_birth'));
        citizens.push({
          id: K().uid('ct'),
          household_id: h.id,
          name: pname,
          gender: parseGender(g(row, '_person_gender')),
          birth_year: by,
          is_voter: by ? (new Date().getFullYear() - by) >= 18 : true,
          relation: '',
          education: String(g(row, '_person_edu') || '').trim(),
          occupation: String(g(row, '_person_job') || '').trim(),
          register: String(g(row, '_person_reg') || '').trim(),
          phone: '',
          support: h.support,
          party: h.party,
          notes: ''
        });
      }
    });

    /* Ам бүлийн тоог иргэдээс нөхөх */
    const cnt = new Map();
    citizens.forEach(c => cnt.set(c.household_id, (cnt.get(c.household_id) || 0) + 1));
    households.forEach(h => { if (!h.family_size) h.family_size = cnt.get(h.id) || 1; });

    return { households, citizens, warnings };
  }

  function dedupeKey(h) {
    return (h.code || [h.district, h.khoroo, h.street, h.building, h.apartment, h.head]
      .join('|')).toLowerCase();
  }

  function khorooCentroid(district, khoroo, seed) {
    const d = K().DISTRICTS.find(x => x.name === district) || K().DISTRICTS[0];
    const r = K().prng((khoroo || 1) * 7919 + (seed || 0) * 31 + d.name.length * 101);
    const ang = r() * Math.PI * 2, rad = Math.sqrt(r()) * d.r * 0.85;
    return {
      lat: +(d.lat + Math.cos(ang) * rad * 0.62).toFixed(6),
      lng: +(d.lng + Math.sin(ang) * rad).toFixed(6)
    };
  }

  /* ---------- Оруулах ---------- */
  function commit(result, mode) {
    const st = S();
    if (mode === 'replace') {
      st.db.households = [];
      st.db.citizens = [];
      st.db.interactions = [];
      st.db.issues = [];
    }
    let added = 0, updated = 0;
    result.households.forEach(function (h) {
      const clean = Object.assign({}, h);
      delete clean._isUpdate; delete clean._row;
      const idx = st.db.households.findIndex(x => x.id === clean.id);
      if (idx >= 0) { Object.assign(st.db.households[idx], clean); updated++; }
      else { st.db.households.push(clean); added++; }
    });
    if (result.citizens.length) {
      const hids = new Set(result.households.map(h => h.id));
      st.db.citizens = st.db.citizens.filter(c => !hids.has(c.household_id));
      result.citizens.forEach(c => st.db.citizens.push(c));
    }
    st.normalize();
    st.persist();
    logImport({ added, updated, rows: result.households.length, date: new Date().toISOString() });
    return { added, updated };
  }

  function logImport(entry) {
    const h = history();
    h.unshift(entry);
    localStorage.setItem('civicos.imports', JSON.stringify(h.slice(0, 25)));
  }
  function history() {
    try { return JSON.parse(localStorage.getItem('civicos.imports') || '[]'); }
    catch (e) { return []; }
  }

  /* ---------- Экспорт ---------- */
  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
  }
  function stamp() { return new Date().toISOString().slice(0, 10); }

  function toCsv(rows) {
    if (!rows.length) return '';
    const cols = Object.keys(rows[0]);
    const q = v => {
      const s = v == null ? '' : (Array.isArray(v) ? v.join('; ') : String(v));
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '﻿' + cols.join(',') + '\n' + rows.map(r => cols.map(c => q(r[c])).join(',')).join('\n');
  }

  function householdRows(rows) {
    const st = S();
    return (rows || st.db.households).map(function (h) {
      const s = global.CivicAI.score(h);
      return {
        'Код': h.code,
        'Өрхийн тэргүүн': h.head,
        'Дүүрэг': h.district,
        'Хороо': h.khoroo,
        'Гудамж/хэсэг': h.street,
        'Байр/хашаа': h.building,
        'Тоот': h.apartment,
        'Бүтэн хаяг': h.address,
        'Өргөрөг': h.lat,
        'Уртраг': h.lng,
        'Ам бүл': h.family_size,
        'Утас': h.phone,
        'Орон сууц': h.housing,
        'Орлого': h.income,
        'Дэмжлэгийн түвшин': K().SUPPORT[h.support] ? K().SUPPORT[h.support].name : '',
        'Нам': h.party,
        'Хөтөлбөр': (h.programs || []).map(p => st.programName(p)).join('; '),
        'Сүүлд холбогдсон': h.last_contact,
        'Хариуцсан': st.staffName(h.assigned_to),
        'AI магадлал %': s.pct,
        'AI сегмент': s.segment.name,
        'AI итгэлцэл %': Math.round(s.conf * 100),
        'Шошго': (h.tags || []).join('; '),
        'Тэмдэглэл': h.notes,
        'Шинэчилсэн': h.updated_at
      };
    });
  }

  function citizenRows() {
    const st = S();
    const hmap = new Map(st.db.households.map(h => [h.id, h]));
    return st.db.citizens.map(function (c) {
      const h = hmap.get(c.household_id) || {};
      return {
        'Нэр': c.name,
        'Хүйс': c.gender,
        'Төрсөн он': c.birth_year,
        'Нас': c.birth_year ? new Date().getFullYear() - c.birth_year : '',
        'Сонгуулийн эрх': c.is_voter ? 'Тийм' : 'Үгүй',
        'Хамаарал': c.relation,
        'Боловсрол': c.education,
        'Мэргэжил': c.occupation,
        'Утас': c.phone,
        'Дэмжлэг': K().SUPPORT[c.support] ? K().SUPPORT[c.support].name : '',
        'Нам': c.party,
        'Өрхийн код': h.code || '',
        'Дүүрэг': h.district || '',
        'Хороо': h.khoroo || '',
        'Хаяг': h.address || ''
      };
    });
  }

  function aiRows() {
    return global.CivicAI.priority(null, 9999).map(function (p, i) {
      return {
        'Эрэмбэ': i + 1,
        'Код': p.h.code,
        'Өрхийн тэргүүн': p.h.head,
        'Дүүрэг': p.h.district,
        'Хороо': p.h.khoroo,
        'Хаяг': p.h.address,
        'Утас': p.h.phone,
        'Сонгогч': p.voters,
        'AI магадлал %': p.s.pct,
        'Сегмент': p.s.segment.name,
        'Өгөөжийн оноо': +(p.value * 100).toFixed(1),
        'Шийдэгдээгүй гомдол': p.openIssues,
        'Гол хүчин зүйл': p.s.factors[0] ? p.s.factors[0].name + ' (' + p.s.factors[0].label + ')' : '',
        'Зөвлөмж': p.s.advice.join(' | ').replace(/\*\*/g, '')
      };
    });
  }

  function staffRows(days) {
    const st = S();
    return st.db.staff.map(function (s) {
      const k = st.staffKpi(s.id, days || 30);
      return {
        'Нэр': s.name, 'Албан тушаал': (K().ROLES[s.role] || {}).name || s.role,
        'Баг': s.team, 'Утас': s.phone,
        'Хариуцсан өрх': k.assigned, 'Хүрсэн өрх': k.reached, 'Холбоо барилт': k.contacts,
        'Эерэг хариу': k.positive, 'Эерэг %': Math.round(k.hitRate * 100),
        'Хамрагдалт %': Math.round(k.coverage * 100), 'Дэмжигч өрх': k.supporters,
        'Зорилт': k.target, 'Биелэлт %': Math.round(k.targetPct * 100),
        'Нээлттэй даалгавар': k.openTasks, 'Дууссан даалгавар': k.doneTasks
      };
    });
  }

  function taskRows() {
    const st = S();
    return st.db.tasks.map(t => ({
      'Даалгавар': t.title, 'Төлөв': t.status, 'Ач холбогдол': t.priority,
      'Ангилал': t.tag, 'Хариуцагч': st.staffName(t.owner_id),
      'Явц %': t.progress, 'Дуусах огноо': t.due, 'Үүсгэсэн': t.created
    }));
  }

  function issueRows() {
    const st = S();
    const hmap = new Map(st.db.households.map(h => [h.id, h]));
    return st.db.issues.map(function (i) {
      const h = hmap.get(i.household_id) || {};
      return {
        'Гарчиг': i.title, 'Ангилал': i.category, 'Ач холбогдол': i.priority,
        'Төлөв': i.status, 'Огноо': i.date,
        'Дүүрэг': i.district || h.district, 'Хороо': i.khoroo || h.khoroo,
        'Өрх': h.code || '', 'Хаяг': h.address || '', 'Утас': h.phone || '',
        'Тэмдэглэл': i.note
      };
    });
  }

  function exportAs(what, rows) {
    const st = S();
    const T = stamp();
    if (what === 'backup-json') {
      download(new Blob([JSON.stringify(st.db, null, 1)], { type: 'application/json' }),
        'civicos-backup-' + T + '.json');
      return;
    }
    if (what === 'full-xlsx') {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(householdRows()), 'Өрх');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(citizenRows()), 'Иргэд');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aiRows()), 'AI оноо');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(staffRows()), 'Баг');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taskRows()), 'Даалгавар');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(issueRows()), 'Гомдол');
      XLSX.writeFile(wb, 'civicos-бүрэн-' + T + '.xlsx');
      return;
    }
    const map = {
      'households': () => householdRows(rows),
      'citizens': () => citizenRows(),
      'ai': () => aiRows(),
      'staff': () => staffRows(),
      'tasks': () => taskRows(),
      'issues': () => issueRows(),
      'strategy': () => global.CivicAI.khorooStrategy().map(k => ({
        'Дүүрэг': k.district, 'Хороо': k.khoroo, 'Өрх': k.households, 'Иргэн': k.people,
        'Дэмжлэг %': Math.round(k.supportRate * 100), 'AI магадлал %': Math.round(k.avgProb * 100),
        'Хамрагдалт %': Math.round(k.coverage * 100),
        'Эргэлзэгч %': Math.round(k.swingShare * 100),
        'Боломжийн оноо': +(k.opportunity * 100).toFixed(1), 'Зөвлөмж': k.action
      }))
    };
    const parts = what.split('-');
    const kind = parts[0], fmt2 = parts[1];
    const data = (map[kind] || map.households)();
    const name = 'civicos-' + kind + '-' + T;
    if (fmt2 === 'csv') {
      download(new Blob([toCsv(data)], { type: 'text/csv;charset=utf-8' }), name + '.csv');
    } else {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Дата');
      XLSX.writeFile(wb, name + '.xlsx');
    }
  }

  /* ---------- Загвар файл ---------- */
  function template() {
    const sample = [{
      'Өрхийн код': 'ӨР-00001', 'Өрхийн тэргүүн': 'Б.Батбаяр', 'Дүүрэг': 'Баянзүрх', 'Хороо': 12,
      'Гудамж': 'Нарны зам', 'Байр': '15-р байр', 'Тоот': '42 тоот',
      'Өргөрөг': 47.9235, 'Уртраг': 106.986, 'Ам бүл': 4, 'Утас': '99112233',
      'Орон сууц': 'Орон сууц', 'Орлого': 'Дундаж', 'Дэмжлэгийн түвшин': 'Дэмжигч',
      'Нам': 'МАН', 'Сүүлд холбогдсон': '2026-06-01', 'Хариуцсан': 'Д.Мөнхбат',
      'Шошго': 'Идэвхтэн; Ахмад', 'Тэмдэглэл': 'Дулааны асуудалтай',
      'Иргэний нэр': 'Б.Батбаяр', 'Хүйс': 'Эр', 'Төрсөн он': 1978,
      'Боловсрол': 'Бакалавр', 'Мэргэжил': 'Инженер'
    }, {
      'Өрхийн код': 'ӨР-00001', 'Өрхийн тэргүүн': 'Б.Батбаяр', 'Дүүрэг': 'Баянзүрх', 'Хороо': 12,
      'Гудамж': 'Нарны зам', 'Байр': '15-р байр', 'Тоот': '42 тоот',
      'Өргөрөг': 47.9235, 'Уртраг': 106.986, 'Ам бүл': 4, 'Утас': '99112233',
      'Орон сууц': 'Орон сууц', 'Орлого': 'Дундаж', 'Дэмжлэгийн түвшин': 'Дэмжигч',
      'Нам': 'МАН', 'Сүүлд холбогдсон': '2026-06-01', 'Хариуцсан': 'Д.Мөнхбат',
      'Шошго': '', 'Тэмдэглэл': '',
      'Иргэний нэр': 'Б.Оюунчимэг', 'Хүйс': 'Эм', 'Төрсөн он': 1981,
      'Боловсрол': 'Магистр+', 'Мэргэжил': 'Багш'
    }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sample), 'Загвар');
    const guide = [
      { 'Багана': 'Өрхийн код', 'Тайлбар': 'Давхардлыг таних түлхүүр. Хоосон бол хаягаар нэгтгэнэ.' },
      { 'Багана': 'Дэмжлэгийн түвшин', 'Тайлбар': '0–5 тоо эсвэл: Бат дэмжигч / Дэмжигч / Эргэлзэгч / Хазайсан эсрэг / Эсрэг' },
      { 'Багана': 'Өргөрөг, Уртраг', 'Тайлбар': 'Хоосон бол хорооны төв цэгт автоматаар байрлуулна.' },
      { 'Багана': 'Иргэний нэр', 'Тайлбар': 'Нэг мөр = нэг хүн бол бөглөнө. Ижил өрхийн кодтой мөрүүд нэг өрх болно.' },
      { 'Багана': 'Шошго', 'Тайлбар': 'Цэг таслал (;) эсвэл таслалаар (,) тусгаарлана.' },
      { 'Багана': 'Огноо', 'Тайлбар': 'YYYY-MM-DD, DD/MM/YYYY эсвэл Excel огноо — бүгдийг таньдаг.' },
      { 'Багана': '— Ерөнхий —', 'Тайлбар': 'Багана нь ямар ч нэртэй байж болно. Оруулах үед гараар тааруулж болно.' }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(guide), 'Заавар');
    XLSX.writeFile(wb, 'civicos-загвар.xlsx');
  }

  global.CivicIO = {
    FIELDS, readFile, autoMap, transform, commit, exportAs, template,
    history, toCsv, download, parseSupport, parseDate
  };

})(window);
