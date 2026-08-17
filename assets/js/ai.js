/* ==========================================================================
   ai.js — Дэмжлэгийн магадлалын загвар + зөвлөмжийн хөдөлгүүр
   --------------------------------------------------------------------------
   Загвар нь ил тод, жинлэсэн логистик оноолт. Оролт бүрийн хувь нэмэр
   (эерэг/сөрөг) харагдана — "хар хайрцаг" биш.
   ========================================================================== */
(function (global) {
  'use strict';

  const S = () => global.CivicStore;

  /* Загварын жин — өөрчилж тохируулж болно (Тохиргоо хуудас) */
  const W = {
    stance: 2.45,        // мэдэгдсэн байр суурь
    party: 1.15,         // намын хандлага
    history: 1.05,       // өмнөх уулзалтын үр дүн
    program: 0.95,       // хөтөлбөрт оролцсон эсэх
    neighbor: 0.85,      // хөршийн (хорооны) дундаж
    recency: 0.55,       // хамгийн сүүлд холбогдсон хугацаа
    family: 0.32,        // ам бүлийн бүтэц
    housing: 0.28,       // орон сууцны төрөл
    verified: 0.22       // баталгаажсан дата
  };

  const bias = -0.15;

  /* Хорооны дундаж дэмжлэгийн кэш */
  let khCache = null, khStamp = -1;
  function khorooIndex() {
    const st = S();
    const stamp = st.db.households.length + ':' + (st._rev || 0);
    if (khCache && khStamp === stamp) return khCache;
    const m = new Map();
    st.db.households.forEach(h => {
      const k = h.district + '|' + h.khoroo;
      if (!m.has(k)) m.set(k, { n: 0, s: 0 });
      const e = m.get(k);
      if (h.support > 0) { e.n++; e.s += (h.support - 1) / 4; }
    });
    khCache = m; khStamp = stamp;
    return m;
  }
  function invalidate() { khCache = null; scoreCache = new Map(); scoreRev = -1; }

  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- Гол оноолт (кэштэй) ---------- */
  let scoreCache = new Map(), scoreRev = -1;

  function score(h) {
    if (!h) return { prob: 0, pct: 0, conf: 0, factors: [], segment: seg(0), advice: [] };
    const rev = S()._rev || 0;
    if (rev !== scoreRev) { scoreCache = new Map(); scoreRev = rev; }
    let hit = scoreCache.get(h.id);
    if (hit) return hit;
    hit = computeScore(h);
    scoreCache.set(h.id, hit);
    return hit;
  }

  function computeScore(h) {
    const st = S();
    const f = [];   // { name, value(-1..1), weight, contrib }

    /* 1. Мэдэгдсэн байр суурь */
    let stance;
    if (h.support === 0 || h.support == null) stance = 0;
    else stance = (h.support - 3) / 2;          // 1→-1, 3→0, 5→+1
    f.push(mk('Мэдэгдсэн байр суурь', stance, W.stance,
      h.support ? global.CivicConst.SUPPORT[h.support].name : 'Тодорхойгүй'));

    /* 2. Намын хандлага */
    const partyMap = { 'МАН': 0.85, 'Хараат бус': 0.1, 'Тодорхойгүй': 0, 'ХҮН нам': -0.25, 'Бусад нам': -0.3, 'АН': -0.8 };
    const pv = partyMap[h.party] != null ? partyMap[h.party] : 0;
    f.push(mk('Намын хандлага', pv, W.party, h.party || 'Тодорхойгүй'));

    /* 3. Холбоо барилтын түүх */
    const ints = st.interactionsOf(h.id);
    let hv = 0, hlabel = 'Түүхгүй';
    if (ints.length) {
      const map = { 'Эерэг': 1, 'Саармаг': 0, 'Сөрөг': -1, 'Татгалзсан': -0.9, 'Гэрт байгаагүй': -0.1 };
      let sum = 0, wsum = 0;
      ints.slice(0, 6).forEach((it, i) => {
        const w = 1 / (1 + i * 0.45);        // сүүлийн уулзалт илүү жинтэй
        sum += (map[it.result] != null ? map[it.result] : 0) * w;
        wsum += w;
      });
      hv = wsum ? sum / wsum : 0;
      const pos = ints.filter(i => i.result === 'Эерэг').length;
      hlabel = ints.length + ' уулзалт · ' + pos + ' эерэг';
    }
    f.push(mk('Уулзалтын үр дүн', hv, W.history, hlabel));

    /* 4. Хөтөлбөрт оролцсон */
    const np = (h.programs || []).length;
    const prv = np === 0 ? -0.12 : clamp(0.42 + np * 0.22, 0, 1);
    f.push(mk('Хөтөлбөрийн оролцоо', prv, W.program,
      np ? np + ' хөтөлбөр' : 'Оролцоогүй'));

    /* 5. Хөршийн (хорооны) дундаж */
    const kh = khorooIndex().get(h.district + '|' + h.khoroo);
    const nb = kh && kh.n >= 3 ? (kh.s / kh.n - 0.5) * 2 : 0;
    f.push(mk('Хорооны хандлага', nb, W.neighbor,
      kh && kh.n >= 3 ? Math.round(kh.s / kh.n * 100) + '% дундаж' : 'Дата хангалтгүй'));

    /* 6. Сүүлийн холбоо барилтын шинэлэг байдал */
    let rec = -0.55, rlabel = 'Хэзээ ч холбогдоогүй';
    if (h.last_contact) {
      const d = Math.floor((Date.now() - new Date(h.last_contact).getTime()) / 864e5);
      rec = d <= 30 ? 0.85 : d <= 90 ? 0.45 : d <= 180 ? 0.05 : d <= 365 ? -0.3 : -0.6;
      rlabel = d + ' хоногийн өмнө';
    }
    f.push(mk('Холбоо барилтын шинэлэг', rec, W.recency, rlabel));

    /* 7. Ам бүлийн бүтэц */
    const cs = st.citizensOf(h.id);
    let fam = 0, flabel = h.family_size + ' ам бүл';
    if (cs.length) {
      const adults = cs.filter(c => c.is_voter);
      if (adults.length) {
        const avg = adults.reduce((s, c) => s + (c.support ? (c.support - 3) / 2 : 0), 0) / adults.length;
        fam = avg * 0.8;
        flabel = adults.length + ' сонгогч · дундаж ' + (avg > 0.2 ? 'эерэг' : avg < -0.2 ? 'сөрөг' : 'саармаг');
      }
    } else {
      fam = h.family_size >= 4 ? 0.15 : 0;
    }
    f.push(mk('Өрхийн доторх нэгдэл', fam, W.family, flabel));

    /* 8. Орон сууцны төрөл (тогтвортой суурьшил) */
    const hmap = { 'Орон сууц': 0.2, 'Хашаа байшин': 0.15, 'Гэр': -0.05, 'Түрээс': -0.35, 'Албан байр': 0 };
    const hv2 = hmap[h.housing] != null ? hmap[h.housing] : 0;
    f.push(mk('Суурьшлын тогтвор', hv2, W.housing, h.housing || '—'));

    /* 9. Дата баталгаажилт */
    f.push(mk('Дата баталгаажилт', h.verified ? 0.5 : -0.35, W.verified,
      h.verified ? 'Баталгаажсан' : 'Баталгаажаагүй'));

    const z = bias + f.reduce((s, x) => s + x.contrib, 0);
    const prob = sigmoid(z);

    /* Итгэлцлийн түвшин — хэдэн эх сурвалж бодит датагаар дүүрсэн бэ */
    let filled = 0;
    if (h.support) filled += 2;
    if (h.party && h.party !== 'Тодорхойгүй') filled++;
    if (ints.length) filled += Math.min(2, ints.length);
    if (np) filled++;
    if (h.last_contact) filled++;
    if (cs.length) filled++;
    if (h.verified) filled++;
    const conf = clamp(filled / 9, 0.12, 0.97);

    const sorted = f.slice().sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));

    return {
      prob: prob,
      pct: Math.round(prob * 100),
      conf: conf,
      z: z,
      factors: sorted,
      segment: seg(prob),
      advice: advise(h, prob, conf, sorted, ints, np)
    };
  }

  function mk(name, value, weight, label) {
    value = clamp(value, -1, 1);
    return { name: name, value: value, weight: weight, contrib: value * weight, label: label };
  }

  /* ---------- Сегмент ---------- */
  function seg(p) {
    if (p >= 0.78) return { key: 'core', name: 'Бат бөх дэмжигч', color: '#0d8f63', cls: 't-s5' };
    if (p >= 0.60) return { key: 'lean', name: 'Хазайсан дэмжигч', color: '#5cb85c', cls: 't-s4' };
    if (p >= 0.42) return { key: 'swing', name: 'Эргэлзэгч — гол зорилтот', color: '#b07d06', cls: 't-s3' };
    if (p >= 0.25) return { key: 'soft-opp', name: 'Хазайсан эсрэг', color: '#e2701a', cls: 't-s2' };
    return { key: 'opp', name: 'Эсрэг', color: '#d92549', cls: 't-s1' };
  }

  /* ---------- Зөвлөмж ---------- */
  function advise(h, prob, conf, factors, ints, np) {
    const out = [];
    const st = S();
    const seg1 = seg(prob);
    const daysSince = h.last_contact
      ? Math.floor((Date.now() - new Date(h.last_contact).getTime()) / 864e5) : null;

    /* Сегментийн үндсэн стратеги */
    if (seg1.key === 'core') {
      out.push('Дэмжлэг батлагдсан — **саналын өдөр авчрах** (GOTV) жагсаалтад оруул. Тээвэр, сануулга төлөвлө.');
      if (!(h.tags || []).includes('Идэвхтэн'))
        out.push('Идэвхтэн болгох боломжтой: сайн дурын ажил, хөрш рүүгээ ухуулах даалгавар өг.');
    } else if (seg1.key === 'lean') {
      out.push('Дэмжлэг тогтворгүй — **баталгаажуулах уулзалт** хийж, санаа зовоосон асуудлыг тодруул.');
      out.push('Хувийн мессеж/утасны сануулга илгээж, албан ёсны дэмжлэг авах.');
    } else if (seg1.key === 'swing') {
      out.push('**Хамгийн өндөр өгөөжтэй бүлэг.** Нүүр тулсан уулзалтад нөөцөө төвлөрүүл.');
      out.push('Ерөнхий ухуулга биш — тухайн өрхийн бодит асуудлаас эхэл (доорх гомдол хэсгийг үз).');
    } else if (seg1.key === 'soft-opp') {
      out.push('Хөрвүүлэх боломж хязгаарлагдмал — зөвхөн тодорхой асуудал шийдэгдвэл хандлага өөрчлөгдөнө.');
      out.push('Нөөц бага зарцуул. Эргэлзэгч өрхүүдийг эхэлж дуусга.');
    } else {
      out.push('Хөрвүүлэлт бага магадлалтай — **давтан айлчлал хийхгүй**. Нөөцөө эргэлзэгчид рүү шилжүүл.');
    }

    /* Холбоо барилтын байдал */
    if (daysSince === null) {
      out.push('Энэ өрхтэй хэзээ ч холбогдож үзээгүй — эхний хаалга тогшилтыг товло.');
    } else if (daysSince > 180 && seg1.key !== 'opp') {
      out.push(daysSince + ' хоног холбогдоогүй — дата хуучирсан. Дахин баталгаажуулах шаардлагатай.');
    }

    /* Хөтөлбөр */
    if (np === 0 && (seg1.key === 'swing' || seg1.key === 'lean')) {
      const cands = st.db.programs.slice(0, 3).map(p => p.name);
      if (cands.length) out.push('Хөтөлбөрт оролцоогүй — «' + cands[0] + '» зэрэгт урих нь дэмжлэгийг дунджаар мэдэгдэхүйц нэмдэг.');
    } else if (np > 0) {
      out.push((h.programs || []).length + ' хөтөлбөрт оролцсон — үр дүнг сануулж, эргэх холбоо ав.');
    }

    /* Шийдэгдээгүй гомдол */
    const open = st.issuesOf(h.id).filter(i => i.status !== 'Шийдэгдсэн');
    if (open.length) {
      out.push('Шийдэгдээгүй ' + open.length + ' гомдол байна («' + open[0].title +
        '»). Шийдвэрлэвэл хамгийн хурдан хандлага өөрчилнө.');
    }

    /* Ам бүл */
    const voters = st.citizensOf(h.id).filter(c => c.is_voter);
    if (voters.length >= 3) {
      out.push(voters.length + ' сонгогчтой том өрх — нэг уулзалтаар олон санал. Тэргүүлэх ач холбогдол өг.');
    }
    const split = voters.filter(c => c.support >= 4).length && voters.filter(c => c.support <= 2).length;
    if (split) out.push('Өрхийн доторх байр суурь хуваагдмал — гэр бүлийн нөлөөлөгчийг тодорхойл.');

    /* Итгэлцэл */
    if (conf < 0.4) {
      out.push('Итгэлцэл бага (' + Math.round(conf * 100) + '%) — дата дутуу. Эхлээд суурь мэдээллийг бүрдүүл.');
    }

    return out.slice(0, 7);
  }

  /* ---------- Тэргүүлэх зорилтот жагсаалт ---------- */
  /* Өгөөж = хөрвүүлэх боломж × өрхийн санал × шинэчлэлтийн шаардлага */
  function priority(rows, limit) {
    rows = rows || S().db.households;
    const st = S();
    const scored = rows.map(h => {
      const s = score(h);
      const voters = Math.max(1, st.citizensOf(h.id).filter(c => c.is_voter).length || h.family_size || 1);
      // Эргэлзэгчид (0.5 орчим) хамгийн өндөр хөрвүүлэх өгөөжтэй
      const swing = 1 - Math.abs(s.prob - 0.52) * 2;
      const stale = h.last_contact
        ? Math.min(1, Math.floor((Date.now() - new Date(h.last_contact).getTime()) / 864e5) / 365)
        : 1;
      const openIssues = st.issuesOf(h.id).filter(i => i.status !== 'Шийдэгдсэн').length;
      const value = Math.max(0, swing) * 0.52
        + Math.min(1, voters / 4) * 0.20
        + stale * 0.16
        + Math.min(1, openIssues / 2) * 0.12;
      return { h: h, s: s, value: value, voters: voters, openIssues: openIssues, stale: stale };
    });
    scored.sort((a, b) => b.value - a.value);
    return limit ? scored.slice(0, limit) : scored;
  }

  /* ---------- Хорооны түвшний стратеги ---------- */
  function khorooStrategy(limit) {
    const st = S();
    const rows = st.byKhoroo();
    const out = rows.map(k => {
      const swingShare = (k.dist[3] + k.dist[2]) / Math.max(1, k.households);
      const gap = 1 - k.coverage;
      const opportunity = swingShare * 0.5 + gap * 0.3 + (k.households / 200) * 0.2;
      let action;
      if (k.coverage < 0.4) action = 'Хамрагдалт бага — хаалга тогшилтыг эрчимжүүл';
      else if (swingShare > 0.42) action = 'Эргэлзэгч олон — асуудалд суурилсан уулзалт';
      else if (k.supportRate > 0.55) action = 'Бат бөх бүс — GOTV болон идэвхтэн бүрдүүл';
      else action = 'Тогтвортой — 7 хоног тутам хяналт';
      return Object.assign({}, k, { swingShare: swingShare, opportunity: opportunity, action: action });
    }).sort((a, b) => b.opportunity - a.opportunity);
    return limit ? out.slice(0, limit) : out;
  }

  /* ---------- Дүүрэг/тойргийн товч дүгнэлт (текст) ---------- */
  function briefing(rows, scopeName) {
    const st = S();
    rows = rows || st.db.households;
    const s = st.stats(rows);
    const p = priority(rows, 9999);
    const swing = p.filter(x => x.s.segment.key === 'swing').length;
    const core = p.filter(x => x.s.segment.key === 'core').length;
    const uncontacted = rows.filter(h => !h.last_contact).length;
    const stale = rows.filter(h => h.last_contact &&
      (Date.now() - new Date(h.last_contact).getTime()) / 864e5 > 180).length;
    const kh = khorooStrategy(3);

    const lines = [];
    lines.push('**' + (scopeName || 'Бүх тойрог') + '** — ' + fmt(s.households) + ' өрх, ' +
      fmt(s.people) + ' иргэн, ' + fmt(s.voters) + ' сонгогч.');
    lines.push('Дундаж дэмжих магадлал **' + Math.round(s.avgProb * 100) + '%**. Бат бөх дэмжигч ' +
      fmt(core) + ' өрх (' + pc(core / Math.max(1, s.households)) + ').');
    lines.push('Эргэлзэгч **' + fmt(swing) + ' өрх** — энэ бүлэг эцсийн үр дүнг тодорхойлно. ' +
      'Нөөцийн ' + (swing > s.households * 0.3 ? 'дийлэнхийг' : 'дор хаяж 50%-ийг') + ' энд төвлөрүүл.');
    if (uncontacted) lines.push('**' + fmt(uncontacted) + ' өрхтэй хэзээ ч холбогдоогүй** (' +
      pc(uncontacted / Math.max(1, s.households)) + '). Энэ бол хамгийн том далд нөөц.');
    if (stale) lines.push(fmt(stale) + ' өрхийн дата 6 сараас хуучирсан — дахин баталгаажуулах хэрэгтэй.');
    if (kh.length) lines.push('Тэргүүлэх хороод: ' + kh.map(k => '**' + k.key + '**').join(', ') + '.');
    lines.push('Хөтөлбөрийн хамрагдалт ' + pc(s.programRate) + ' — оролцсон өрхийн дэмжлэг ' +
      'дунджаас тогтвортой өндөр байдаг.');
    return lines;
  }

  function fmt(n) { return (n || 0).toLocaleString('mn-MN'); }
  function pc(v) { return Math.round((v || 0) * 100) + '%'; }

  /* ---------- Жин тохируулах ---------- */
  function setWeights(obj) { Object.assign(W, obj); invalidate(); }
  function getWeights() { return Object.assign({}, W); }

  global.CivicAI = {
    score, priority, khorooStrategy, briefing, seg,
    setWeights, getWeights, invalidate, WEIGHTS: W
  };

})(window);
