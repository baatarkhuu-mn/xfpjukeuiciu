/* ==========================================================================
   store.js — Дата давхарга (schema, seed, localStorage / Supabase adapter)
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---------- Тогтмолууд ---------- */

  const SUPPORT = {
    5: { key: 5, name: 'Бат дэмжигч', short: 'Бат', color: '#16c98d', cls: 't-s5' },
    4: { key: 4, name: 'Дэмжигч', short: 'Дэмжигч', color: '#7ee08a', cls: 't-s4' },
    3: { key: 3, name: 'Эргэлзэгч', short: 'Эргэлзэгч', color: '#f5b428', cls: 't-s3' },
    2: { key: 2, name: 'Хазайсан эсрэг', short: 'Хазайсан', color: '#fb923c', cls: 't-s2' },
    1: { key: 1, name: 'Эсрэг', short: 'Эсрэг', color: '#f2385a', cls: 't-s1' },
    0: { key: 0, name: 'Тодорхойгүй', short: 'Тодорхойгүй', color: '#5a5a72', cls: 't-s0' }
  };

  const PARTIES = ['МАН', 'АН', 'ХҮН нам', 'Бусад нам', 'Хараат бус', 'Тодорхойгүй'];

  const HOUSING = ['Орон сууц', 'Хашаа байшин', 'Гэр', 'Түрээс', 'Албан байр'];

  const INCOME = ['Доогуур', 'Дунджаас доогуур', 'Дундаж', 'Дунджаас дээгүүр', 'Өндөр'];

  const EDU = ['Бага', 'Бүрэн бус дунд', 'Бүрэн дунд', 'Тусгай дунд', 'Бакалавр', 'Магистр+'];

  const CONTACT_TYPES = ['Хаалга тогших', 'Утсаар', 'Уулзалт', 'Судалгаа', 'Арга хэмжээ', 'Мессеж', 'Бусад'];

  const ISSUE_CATS = ['Дэд бүтэц', 'Зам тээвэр', 'Эрүүл мэнд', 'Боловсрол', 'Ажил эрхлэлт',
    'Орон сууц', 'Нийгмийн халамж', 'Хог хаягдал', 'Ус, дулаан', 'Аюулгүй байдал', 'Бусад'];

  /* Улаанбаатарын дүүрэг, хорооны тоо, ойролцоо төв цэг */
  const DISTRICTS = [
    { name: 'Баянзүрх', khoroo: 43, lat: 47.9235, lng: 106.9860, r: 0.055 },
    { name: 'Сонгинохайрхан', khoroo: 43, lat: 47.9180, lng: 106.7830, r: 0.060 },
    { name: 'Баянгол', khoroo: 25, lat: 47.9075, lng: 106.8460, r: 0.030 },
    { name: 'Хан-Уул', khoroo: 25, lat: 47.8790, lng: 106.9130, r: 0.045 },
    { name: 'Чингэлтэй', khoroo: 24, lat: 47.9410, lng: 106.9020, r: 0.038 },
    { name: 'Сүхбаатар', khoroo: 20, lat: 47.9280, lng: 106.9270, r: 0.038 },
    { name: 'Налайх', khoroo: 8, lat: 47.7720, lng: 107.2530, r: 0.030 },
    { name: 'Багануур', khoroo: 5, lat: 47.8290, lng: 108.3420, r: 0.025 },
    { name: 'Багахангай', khoroo: 2, lat: 47.3830, lng: 107.5290, r: 0.018 }
  ];

  const STREETS = ['Энхтайваны өргөн чөлөө', 'Их тойруу', 'Чингисийн өргөн чөлөө', 'Сөүлийн гудамж',
    'Нарны зам', 'Тээвэрчдийн гудамж', 'Амарын гудамж', 'Бага тойруу', 'Их сургуулийн гудамж',
    'Жуковын гудамж', 'Гэсэр сүмийн гудамж', 'Дамбадаржаагийн зам', 'Токиогийн гудамж',
    'Оюутны гудамж', 'Үйлдвэрчний эвлэлийн гудамж', 'Хувьсгалчдын өргөн чөлөө', 'Ард Аюушийн өргөн чөлөө',
    'Дунд гол', 'Мянган толгой', 'Хайлааст', 'Дэнжийн мянга', 'Шархад', 'Зайсангийн гудамж',
    'Найрамдлын гудамж', 'Хоймор хороолол', 'Баянхошуу', 'Сэлбэ', 'Улиастай', 'Толгойт', 'Яармаг'];

  const SURNAMES = ['Батбаяр', 'Дорж', 'Гантулга', 'Мөнхбат', 'Отгонбаяр', 'Пүрэвдорж', 'Ганболд',
    'Цэрэндорж', 'Энхбаяр', 'Наранбаатар', 'Батсайхан', 'Ундрах', 'Лхагвасүрэн', 'Түмэнжаргал',
    'Ганзориг', 'Сүхбат', 'Даваасүрэн', 'Эрдэнэбат', 'Баасанжав', 'Жаргалсайхан', 'Нямдорж',
    'Хүрэлбаатар', 'Оюунчимэг', 'Алтанцэцэг', 'Сарантуяа', 'Мөнхзул'];

  const NAMES_M = ['Батбаяр', 'Тэмүүлэн', 'Ганбаатар', 'Мөнхбаяр', 'Энхтайван', 'Билгүүн', 'Тэмүүжин',
    'Ариунболд', 'Сүхбат', 'Дэлгэрсайхан', 'Хишигбаяр', 'Отгонжаргал', 'Батмөнх', 'Эрдэнэбилэг',
    'Наранбаатар', 'Цэнгүүн', 'Гантөмөр', 'Мандахбаяр', 'Батжаргал', 'Анхбаяр'];

  const NAMES_F = ['Оюунчимэг', 'Сарантуяа', 'Алтанцэцэг', 'Энхжаргал', 'Мөнхцэцэг', 'Ариунзаяа',
    'Дэлгэрмаа', 'Нарантуяа', 'Билгүүнзаяа', 'Хишигжаргал', 'Уранчимэг', 'Тунгалаг', 'Ганцэцэг',
    'Эрдэнэчимэг', 'Отгонцэцэг', 'Баярмаа', 'Солонго', 'Намуун', 'Цэцэгмаа', 'Одонтуяа'];

  const OCCUPATIONS = ['Багш', 'Эмч', 'Жолооч', 'Барилгачин', 'Худалдагч', 'Инженер', 'Оёдолчин',
    'Цагдаа', 'Нягтлан', 'Малчин', 'Уурхайчин', 'Программист', 'Хуульч', 'Тогооч', 'Үсчин',
    'Ажилгүй', 'Тэтгэвэрт', 'Оюутан', 'Хувиараа', 'Төрийн албан хаагч'];

  /* Багийн бүтэц — сонгуулийн штабын албан тушаал, эрх */
  const ROLES = {
    admin: { name: 'Штабын дарга', can: ['view', 'edit', 'delete', 'import', 'export', 'manage'] },
    manager: { name: 'Хорооны менежер', can: ['view', 'edit', 'import', 'export'] },
    canvasser: { name: 'Ухуулагч', can: ['view', 'edit'] },
    analyst: { name: 'Шинжээч', can: ['view', 'export'] },
    viewer: { name: 'Ажиглагч', can: ['view'] }
  };

  const TASK_STATUS = ['Хийгдэж буй', 'Хүлээгдэж буй', 'Шалгуулж буй', 'Дууссан'];
  const TASK_PRIO = ['Өндөр', 'Дунд', 'Бага'];
  const TASK_TAGS = ['Канвассинг', 'Судалгаа', 'Арга хэмжээ', 'Дата', 'Хөтөлбөр', 'Гомдол', 'Сургалт', 'Тайлан'];

  const STAFF_SEED = [
    { name: 'Б.Ундрах', role: 'admin', phone: '99110022', team: 'Штаб' },
    { name: 'Д.Мөнхбат', role: 'manager', phone: '99223344', team: 'Баянзүрх' },
    { name: 'С.Оюунаа', role: 'manager', phone: '95556677', team: 'Сонгинохайрхан' },
    { name: 'Т.Ганбаатар', role: 'canvasser', phone: '88112233', team: 'Баянгол' },
    { name: 'Н.Энхжаргал', role: 'canvasser', phone: '94445566', team: 'Чингэлтэй' },
    { name: 'Ц.Батмөнх', role: 'canvasser', phone: '91234567', team: 'Сүхбаатар' },
    { name: 'Г.Сарантуяа', role: 'analyst', phone: '96667788', team: 'Штаб' },
    { name: 'Э.Түвшинбаяр', role: 'canvasser', phone: '80099887', team: 'Хан-Уул' }
  ];

  const TASK_SEED = [
    { t: 'Баянзүрх 12-р хорооны дата шинэчлэлт', s: 'Хийгдэж буй', p: 'Өндөр', tag: 'Дата', pr: 65, due: 6 },
    { t: 'Эргэлзэгч өрхүүдтэй давтан уулзалт', s: 'Хийгдэж буй', p: 'Өндөр', tag: 'Канвассинг', pr: 40, due: 9 },
    { t: 'Ухуулагчдын 7 хоногийн тайлан', s: 'Хүлээгдэж буй', p: 'Дунд', tag: 'Тайлан', pr: 20, due: 3 },
    { t: 'Сонгинохайрхан хэсгийн зураглал', s: 'Хийгдэж буй', p: 'Дунд', tag: 'Канвассинг', pr: 55, due: 14 },
    { t: 'Ахмадын дэмжлэг хөтөлбөрийн бүртгэл', s: 'Шалгуулж буй', p: 'Дунд', tag: 'Хөтөлбөр', pr: 90, due: 2 },
    { t: 'Гомдол шийдвэрлэлтийн эргэх холбоо', s: 'Хүлээгдэж буй', p: 'Өндөр', tag: 'Гомдол', pr: 15, due: 5 },
    { t: 'Шинэ ухуулагчдын сургалт', s: 'Дууссан', p: 'Дунд', tag: 'Сургалт', pr: 100, due: -8 },
    { t: 'Судалгааны асуулга бэлтгэх', s: 'Шалгуулж буй', p: 'Бага', tag: 'Судалгаа', pr: 80, due: 4 },
    { t: 'Хан-Уул 8-р хорооны арга хэмжээ', s: 'Хийгдэж буй', p: 'Өндөр', tag: 'Арга хэмжээ', pr: 30, due: 11 },
    { t: 'Дата цэвэрлэгээ — давхардал арилгах', s: 'Дууссан', p: 'Өндөр', tag: 'Дата', pr: 100, due: -14 },
    { t: 'Чингэлтэй дүүргийн тойрог шинжилгээ', s: 'Хүлээгдэж буй', p: 'Дунд', tag: 'Тайлан', pr: 0, due: 18 },
    { t: 'Оюутны тэтгэлгийн жагсаалт баталгаажуулах', s: 'Хийгдэж буй', p: 'Дунд', tag: 'Хөтөлбөр', pr: 45, due: 7 }
  ];

  const PROGRAM_SEED = [
    { name: 'Гэр хорооллын дэд бүтэц', type: 'Дэд бүтэц', year: 2024 },
    { name: 'Оюутны тэтгэлэг', type: 'Боловсрол', year: 2024 },
    { name: '1000 ажлын байр', type: 'Ажил эрхлэлт', year: 2025 },
    { name: 'Үнэ төлбөргүй эрүүл мэндийн үзлэг', type: 'Эрүүл мэнд', year: 2025 },
    { name: 'Хүүхдийн зуслан', type: 'Хүүхэд', year: 2025 },
    { name: 'Ахмадын дэмжлэг', type: 'Нийгмийн халамж', year: 2024 },
    { name: 'Ногоон байгууламж', type: 'Байгаль орчин', year: 2026 },
    { name: 'Дулаалгын хөтөлбөр', type: 'Орон сууц', year: 2026 },
    { name: 'Спортын талбай', type: 'Спорт', year: 2025 },
    { name: 'Цахим боловсрол', type: 'Боловсрол', year: 2026 }
  ];

  /* ---------- Туслах ---------- */

  function prng(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let x = Math.imul(t ^ (t >>> 15), t | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function ri(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
  function uid(p) { return p + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function daysAgo(n) { return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); }

  /* ---------- Seed generator ---------- */

  function generateSeed(nHouseholds) {
    const r = prng(20260815);
    const programs = PROGRAM_SEED.map((p, i) => ({
      id: 'pg_' + (i + 1), name: p.name, type: p.type, year: p.year,
      description: p.name + ' — тойрогт хэрэгжүүлсэн хөтөлбөр'
    }));

    // Хороо тус бүрд суурь дэмжлэгийн түвшин (өөр өөр)
    const khoroos = [];
    DISTRICTS.forEach(function (d, di) {
      for (let k = 1; k <= d.khoroo; k++) {
        const ang = r() * Math.PI * 2, rad = Math.sqrt(r()) * d.r;
        khoroos.push({
          district: d.name, khoroo: k,
          lat: d.lat + Math.cos(ang) * rad * 0.62,
          lng: d.lng + Math.sin(ang) * rad,
          base: 0.28 + r() * 0.46,          // суурь дэмжлэгийн хандлага
          weight: 0.4 + r(),                 // өрхийн нягтшил
          di: di
        });
      }
    });

    const totalW = khoroos.reduce((s, k) => s + k.weight, 0);
    const households = [], citizens = [], interactions = [], issues = [];
    let hIdx = 0;

    khoroos.forEach(function (kh) {
      const n = Math.max(2, Math.round(nHouseholds * kh.weight / totalW));
      for (let i = 0; i < n; i++) {
        hIdx++;
        const ang = r() * Math.PI * 2, rad = Math.sqrt(r()) * 0.011;
        const lat = kh.lat + Math.cos(ang) * rad * 0.62;
        const lng = kh.lng + Math.sin(ang) * rad;
        const housing = pick(r, HOUSING);
        const fam = ri(r, 1, housing === 'Гэр' ? 7 : 6);
        const street = pick(r, STREETS);
        const surname = pick(r, SURNAMES);
        const headMale = r() < 0.62;
        const headName = pick(r, headMale ? NAMES_M : NAMES_F);

        // Хорооны суурь + өрхийн санамсаргүй хазайлт → дэмжлэгийн түвшин
        const lean = Math.max(0, Math.min(1, kh.base + (r() - 0.5) * 0.55));
        let sup;
        if (r() < 0.09) sup = 0;
        else if (lean > 0.76) sup = 5;
        else if (lean > 0.58) sup = 4;
        else if (lean > 0.40) sup = 3;
        else if (lean > 0.24) sup = 2;
        else sup = 1;

        const party = sup >= 4 ? (r() < 0.72 ? 'МАН' : pick(r, ['Хараат бус', 'ХҮН нам', 'Тодорхойгүй']))
          : sup <= 2 ? pick(r, ['АН', 'ХҮН нам', 'Бусад нам', 'Тодорхойгүй'])
            : pick(r, PARTIES);

        const nProg = r() < 0.42 ? ri(r, 1, 3) : 0;
        const progs = [];
        for (let p = 0; p < nProg; p++) {
          const pg = pick(r, programs).id;
          if (progs.indexOf(pg) < 0) progs.push(pg);
        }

        const lastDays = r() < 0.72 ? ri(r, 1, 400) : null;
        const hid = 'hh_' + String(hIdx).padStart(5, '0');

        households.push({
          id: hid,
          code: 'ӨР-' + String(hIdx).padStart(5, '0'),
          district: kh.district,
          khoroo: kh.khoroo,
          street: street,
          building: housing === 'Орон сууц' ? String(ri(r, 1, 60)) + '-р байр' : String(ri(r, 1, 240)) + '-р хашаа',
          apartment: housing === 'Орон сууц' ? String(ri(r, 1, 90)) + ' тоот' : '',
          address: kh.district + ' дүүрэг, ' + kh.khoroo + '-р хороо, ' + street,
          lat: +lat.toFixed(6), lng: +lng.toFixed(6),
          head: surname.slice(0, 1) + '.' + headName,
          family_size: fam,
          phone: '9' + ri(r, 1, 9) + String(ri(r, 100000, 999999)),
          housing: housing,
          income: pick(r, INCOME),
          support: sup,
          party: party,
          programs: progs,
          last_contact: lastDays ? daysAgo(lastDays) : '',
          tags: r() < 0.13 ? [pick(r, ['Идэвхтэн', 'Гол өрх', 'Ахмад', 'Олон хүүхэдтэй', 'Шинэ суурьшил'])] : [],
          notes: '',
          verified: r() < 0.55,
          updated_at: daysAgo(ri(r, 0, 120))
        });

        // Иргэд
        const nAdults = Math.min(fam, ri(r, 1, 3));
        for (let c = 0; c < fam; c++) {
          const isAdult = c < nAdults;
          const male = c === 0 ? headMale : r() < 0.5;
          const birth = isAdult ? ri(r, 1948, 2008) : ri(r, 2009, 2024);
          citizens.push({
            id: 'ct_' + hid.slice(3) + '_' + c,
            household_id: hid,
            name: (c === 0 ? surname.slice(0, 1) + '.' + headName : surname.slice(0, 1) + '.' + pick(r, male ? NAMES_M : NAMES_F)),
            gender: male ? 'Эр' : 'Эм',
            birth_year: birth,
            is_voter: (2026 - birth) >= 18,
            relation: c === 0 ? 'Өрхийн тэргүүн' : pick(r, ['Эхнэр/нөхөр', 'Хүү', 'Охин', 'Эцэг/эх', 'Хамаатан']),
            education: (2026 - birth) >= 18 ? pick(r, EDU) : '',
            occupation: (2026 - birth) >= 18 ? pick(r, OCCUPATIONS) : 'Сурагч',
            phone: c === 0 ? '' : (r() < 0.3 ? '9' + ri(r, 1, 9) + String(ri(r, 100000, 999999)) : ''),
            support: c === 0 ? sup : (r() < 0.66 ? sup : Math.max(0, Math.min(5, sup + ri(r, -1, 1)))),
            party: c === 0 ? party : (r() < 0.7 ? party : pick(r, PARTIES)),
            notes: ''
          });
        }

        // Холбоо барилтын түүх
        if (lastDays !== null) {
          const nInt = ri(r, 1, 4);
          for (let k2 = 0; k2 < nInt; k2++) {
            interactions.push({
              id: uid('in'),
              household_id: hid,
              date: daysAgo(lastDays + k2 * ri(r, 20, 90)),
              type: pick(r, CONTACT_TYPES),
              canvasser: pick(r, ['Б.Ундрах', 'Д.Мөнхбат', 'С.Оюунаа', 'Т.Ганбаатар', 'Н.Энхжаргал', 'Ц.Батмөнх']),
              result: pick(r, ['Эерэг', 'Эерэг', 'Саармаг', 'Сөрөг', 'Гэрт байгаагүй', 'Татгалзсан']),
              note: ''
            });
          }
        }

        // Санал гомдол
        if (r() < 0.16) {
          issues.push({
            id: uid('is'),
            household_id: hid,
            district: kh.district, khoroo: kh.khoroo,
            category: pick(r, ISSUE_CATS),
            title: pick(r, ['Гэрэлтүүлэг байхгүй', 'Зам эвдэрсэн', 'Ус тасардаг', 'Хог цуглардаг',
              'Цэцэрлэгийн хүрэлцээ', 'Дулаан муу', 'Автобусны буудал алслагдсан', 'Нохой олширсон',
              'Ажлын байр хэрэгтэй', 'Эмнэлгийн үйлчилгээ']),
            priority: pick(r, ['Өндөр', 'Дунд', 'Дунд', 'Бага']),
            status: pick(r, ['Шинэ', 'Хүлээгдэж буй', 'Хүлээгдэж буй', 'Шийдэгдсэн']),
            date: daysAgo(ri(r, 1, 300)),
            note: ''
          });
        }
      }
    });

    /* --- Багийн гишүүд --- */
    const staff = STAFF_SEED.map(function (s, i) {
      return {
        id: 'st_' + (i + 1),
        name: s.name,
        role: s.role,
        phone: s.phone,
        email: '',
        team: s.team,
        active: true,
        joined: daysAgo(ri(r, 40, 500)),
        target: ri(r, 120, 400)   // 7 хоногийн зорилтот өрх
      };
    });

    /* Өрх бүрийг хариуцсан ухуулагчид хуваарилах */
    const byTeam = {};
    staff.forEach(s => { if (!byTeam[s.team]) byTeam[s.team] = []; byTeam[s.team].push(s); });
    households.forEach(function (h, i) {
      const pool = byTeam[h.district] && byTeam[h.district].length
        ? byTeam[h.district]
        : staff.filter(s => s.role === 'canvasser' || s.role === 'manager');
      h.assigned_to = pool[i % pool.length].id;
    });

    /* Холбоо барилтыг жинхэнэ ухуулагчид холбох */
    const byName = {};
    staff.forEach(s => { byName[s.name] = s.id; });
    interactions.forEach(function (it) {
      it.staff_id = byName[it.canvasser] || staff[0].id;
    });

    /* --- Даалгаврууд --- */
    const tasks = TASK_SEED.map(function (t, i) {
      const owner = staff[i % staff.length];
      return {
        id: 'tk_' + (i + 1),
        title: t.t,
        status: t.s,
        priority: t.p,
        tag: t.tag,
        progress: t.pr,
        owner_id: owner.id,
        due: daysAgo(-t.due),
        created: daysAgo(ri(r, 5, 60)),
        comments: ri(r, 0, 5),
        note: ''
      };
    });

    return { households, citizens, programs, interactions, issues, staff, tasks };
  }

  /* ---------- Store ---------- */

  const LS_KEY = 'civicos.db.v1';
  const LS_CFG = 'civicos.cfg.v1';

  const Store = {
    TABLES: ['households', 'citizens', 'programs', 'interactions', 'issues', 'staff', 'tasks'],
    db: { households: [], citizens: [], programs: [], interactions: [], issues: [], staff: [], tasks: [] },
    cfg: { sbUrl: '', sbKey: '', seeded: false, demo: true },
    sb: null,
    user: null,
    role: 'viewer',
    listeners: [],

    /* --- init --- */
    async init() {
      this.loadCfg();
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        try { this.db = JSON.parse(raw); } catch (e) { console.warn('DB parse fail', e); }
      }
      if (!this.db.households || !this.db.households.length) {
        this.db = generateSeed(1400);
        this.cfg.seeded = true;
        this.persist();
      }
      this.normalize();
      return this.db;
    },

    loadCfg() {
      try {
        const c = JSON.parse(localStorage.getItem(LS_CFG) || '{}');
        Object.assign(this.cfg, c);
      } catch (e) { /* noop */ }
    },
    saveCfg() { localStorage.setItem(LS_CFG, JSON.stringify(this.cfg)); },

    /* Хүснэгт хоорондын индекс — O(1) хайлт */
    buildIndex() {
      const idx = { cit: new Map(), int: new Map(), iss: new Map() };
      this.db.citizens.forEach(c => {
        if (!idx.cit.has(c.household_id)) idx.cit.set(c.household_id, []);
        idx.cit.get(c.household_id).push(c);
      });
      this.db.interactions.forEach(i => {
        if (!idx.int.has(i.household_id)) idx.int.set(i.household_id, []);
        idx.int.get(i.household_id).push(i);
      });
      idx.int.forEach(list => list.sort((a, b) => (b.date || '').localeCompare(a.date || '')));
      this.db.issues.forEach(i => {
        if (!idx.iss.has(i.household_id)) idx.iss.set(i.household_id, []);
        idx.iss.get(i.household_id).push(i);
      });
      this._idx = idx;
      this._rev = (this._rev || 0) + 1;
      if (global.CivicAI) global.CivicAI.invalidate();
    },

    normalize() {
      const d = this.db;
      this.TABLES.forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
      d.households.forEach(h => {
        if (!Array.isArray(h.programs)) h.programs = [];
        if (!Array.isArray(h.tags)) h.tags = [];
        h.family_size = +h.family_size || 1;
        h.support = h.support == null ? 0 : +h.support;
        h.khoroo = +h.khoroo || 0;
      });
      this.buildIndex();
    },

    persist() {
      this.buildIndex();
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(this.db));
      } catch (e) {
        console.error('localStorage дүүрсэн', e);
        if (global.CivicUI) global.CivicUI.toast('Хадгалах багтаамж дүүрсэн — экспорт хийж цэвэрлэнэ үү', 'err');
      }
      this.emit();
    },

    on(fn) { this.listeners.push(fn); },
    emit() { this.listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } }); },

    /* --- CRUD: households --- */
    addHousehold(h) {
      h.id = h.id || uid('hh');
      h.code = h.code || 'ӨР-' + String(this.db.households.length + 1).padStart(5, '0');
      h.updated_at = today();
      if (!Array.isArray(h.programs)) h.programs = [];
      if (!Array.isArray(h.tags)) h.tags = [];
      this.db.households.push(h);
      this.persist();
      return h;
    },
    updateHousehold(id, patch) {
      const h = this.db.households.find(x => x.id === id);
      if (!h) return null;
      Object.assign(h, patch, { updated_at: today() });
      this.persist();
      return h;
    },
    deleteHousehold(id) {
      this.db.households = this.db.households.filter(h => h.id !== id);
      this.db.citizens = this.db.citizens.filter(c => c.household_id !== id);
      this.db.interactions = this.db.interactions.filter(i => i.household_id !== id);
      this.db.issues = this.db.issues.filter(i => i.household_id !== id);
      this.persist();
    },
    deleteMany(ids) {
      const set = new Set(ids);
      this.db.households = this.db.households.filter(h => !set.has(h.id));
      this.db.citizens = this.db.citizens.filter(c => !set.has(c.household_id));
      this.db.interactions = this.db.interactions.filter(i => !set.has(i.household_id));
      this.db.issues = this.db.issues.filter(i => !set.has(i.household_id));
      this.persist();
    },

    /* --- CRUD: citizens --- */
    addCitizen(c) {
      c.id = c.id || uid('ct');
      this.db.citizens.push(c);
      this.persist();
      return c;
    },
    updateCitizen(id, patch) {
      const c = this.db.citizens.find(x => x.id === id);
      if (!c) return null;
      Object.assign(c, patch);
      this.persist();
      return c;
    },
    deleteCitizen(id) {
      this.db.citizens = this.db.citizens.filter(c => c.id !== id);
      this.persist();
    },

    /* --- interactions / issues / programs --- */
    addInteraction(i) {
      i.id = i.id || uid('in');
      this.db.interactions.push(i);
      const h = this.db.households.find(x => x.id === i.household_id);
      if (h && (!h.last_contact || i.date > h.last_contact)) h.last_contact = i.date;
      this.persist();
      return i;
    },
    addIssue(i) { i.id = i.id || uid('is'); this.db.issues.push(i); this.persist(); return i; },
    updateIssue(id, patch) {
      const i = this.db.issues.find(x => x.id === id);
      if (i) { Object.assign(i, patch); this.persist(); }
      return i;
    },
    deleteIssue(id) { this.db.issues = this.db.issues.filter(x => x.id !== id); this.persist(); },
    addProgram(p) { p.id = p.id || uid('pg'); this.db.programs.push(p); this.persist(); return p; },
    updateProgram(id, patch) {
      const p = this.db.programs.find(x => x.id === id);
      if (p) { Object.assign(p, patch); this.persist(); }
      return p;
    },
    deleteProgram(id) {
      this.db.programs = this.db.programs.filter(p => p.id !== id);
      this.db.households.forEach(h => { h.programs = (h.programs || []).filter(x => x !== id); });
      this.persist();
    },

    /* --- CRUD: staff (багийн гишүүд) --- */
    addStaff(s) {
      s.id = s.id || uid('st');
      s.active = s.active !== false;
      s.joined = s.joined || today();
      this.db.staff.push(s);
      this.persist();
      return s;
    },
    updateStaff(id, patch) {
      const s = this.db.staff.find(x => x.id === id);
      if (s) { Object.assign(s, patch); this.persist(); }
      return s;
    },
    deleteStaff(id) {
      this.db.staff = this.db.staff.filter(s => s.id !== id);
      this.db.households.forEach(h => { if (h.assigned_to === id) h.assigned_to = ''; });
      this.db.tasks.forEach(t => { if (t.owner_id === id) t.owner_id = ''; });
      this.persist();
    },
    staffMember(id) { return this.db.staff.find(s => s.id === id); },
    staffName(id) { const s = this.staffMember(id); return s ? s.name : '—'; },

    /* Ухуулагч тус бүрийн гүйцэтгэл */
    staffKpi(id, days) {
      days = days || 30;
      const since = daysAgo(days);
      const mine = this.db.households.filter(h => h.assigned_to === id);
      const ints = this.db.interactions.filter(i => i.staff_id === id && (i.date || '') >= since);
      const reached = new Set(ints.map(i => i.household_id)).size;
      const positive = ints.filter(i => i.result === 'Эерэг').length;
      const st = this.stats(mine);
      const tasks = this.db.tasks.filter(t => t.owner_id === id);
      const s = this.staffMember(id) || {};
      return {
        assigned: mine.length,
        reached: reached,
        contacts: ints.length,
        positive: positive,
        hitRate: ints.length ? positive / ints.length : 0,
        coverage: mine.length ? reached / mine.length : 0,
        supporters: st.supporters,
        supportRate: st.supportRate,
        avgProb: st.avgProb,
        openTasks: tasks.filter(t => t.status !== 'Дууссан').length,
        doneTasks: tasks.filter(t => t.status === 'Дууссан').length,
        target: s.target || 0,
        targetPct: s.target ? Math.min(1, reached / s.target) : 0
      };
    },

    /* --- CRUD: tasks (даалгавар) --- */
    addTask(t) {
      t.id = t.id || uid('tk');
      t.created = t.created || today();
      t.progress = +t.progress || 0;
      t.status = t.status || 'Хүлээгдэж буй';
      t.priority = t.priority || 'Дунд';
      this.db.tasks.push(t);
      this.persist();
      return t;
    },
    updateTask(id, patch) {
      const t = this.db.tasks.find(x => x.id === id);
      if (t) {
        Object.assign(t, patch);
        if (t.status === 'Дууссан') t.progress = 100;
        this.persist();
      }
      return t;
    },
    deleteTask(id) { this.db.tasks = this.db.tasks.filter(t => t.id !== id); this.persist(); },

    taskStats() {
      const t = this.db.tasks;
      const overdue = t.filter(x => x.status !== 'Дууссан' && x.due && x.due < today());
      return {
        total: t.length,
        open: t.filter(x => x.status !== 'Дууссан').length,
        done: t.filter(x => x.status === 'Дууссан').length,
        overdue: overdue.length,
        highOpen: t.filter(x => x.status !== 'Дууссан' && x.priority === 'Өндөр').length,
        byStatus: TASK_STATUS.map(s => ({ status: s, n: t.filter(x => x.status === s).length }))
      };
    },

    /* --- эрх шалгах --- */
    can(action) {
      const r = ROLES[this.role] || ROLES.viewer;
      return r.can.indexOf(action) >= 0;
    },

    /* --- lookups --- */
    household(id) { return this.db.households.find(h => h.id === id); },
    citizensOf(id) { return (this._idx && this._idx.cit.get(id)) || []; },
    interactionsOf(id) { return (this._idx && this._idx.int.get(id)) || []; },
    issuesOf(id) { return (this._idx && this._idx.iss.get(id)) || []; },
    program(id) { return this.db.programs.find(p => p.id === id); },
    programName(id) { const p = this.program(id); return p ? p.name : id; },

    districts() {
      const s = new Set(this.db.households.map(h => h.district).filter(Boolean));
      return Array.from(s).sort();
    },
    khoroosOf(district) {
      const s = new Set(this.db.households.filter(h => !district || h.district === district)
        .map(h => h.khoroo).filter(k => k || k === 0));
      return Array.from(s).sort((a, b) => a - b);
    },
    streetsOf(district, khoroo) {
      const s = new Set(this.db.households.filter(h =>
        (!district || h.district === district) && (!khoroo || +h.khoroo === +khoroo)
      ).map(h => h.street).filter(Boolean));
      return Array.from(s).sort();
    },

    /* --- filtering --- */
    filter(f) {
      f = f || {};
      const q = (f.q || '').trim().toLowerCase();
      return this.db.households.filter(h => {
        if (f.district && h.district !== f.district) return false;
        if (f.khoroo && +h.khoroo !== +f.khoroo) return false;
        if (f.street && h.street !== f.street) return false;
        if (f.support !== '' && f.support != null && +h.support !== +f.support) return false;
        if (f.party && h.party !== f.party) return false;
        if (f.housing && h.housing !== f.housing) return false;
        if (f.program && (h.programs || []).indexOf(f.program) < 0) return false;
        if (f.tag && (h.tags || []).indexOf(f.tag) < 0) return false;
        if (f.staff && h.assigned_to !== f.staff) return false;
        if (f.minProb != null && (global.CivicAI.score(h).prob * 100) < f.minProb) return false;
        if (f.uncontacted && h.last_contact) return false;
        if (q) {
          const hay = [h.code, h.head, h.address, h.street, h.phone, h.district,
            h.khoroo + '-р хороо', (h.tags || []).join(' ')].join(' ').toLowerCase();
          if (hay.indexOf(q) < 0) {
            const cs = this.citizensOf(h.id);
            if (!cs.some(c => (c.name || '').toLowerCase().indexOf(q) >= 0 ||
              (c.phone || '').indexOf(q) >= 0)) return false;
          }
        }
        return true;
      });
    },

    /* --- statistics --- */
    stats(rows) {
      rows = rows || this.db.households;
      const ids = new Set(rows.map(h => h.id));
      const cits = this.db.citizens.filter(c => ids.has(c.household_id));
      const voters = cits.filter(c => c.is_voter);
      const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, 0: 0 };
      let people = 0, contacted = 0, probSum = 0, inProg = 0;
      rows.forEach(h => {
        dist[h.support] = (dist[h.support] || 0) + 1;
        people += +h.family_size || 0;
        if (h.last_contact) contacted++;
        if ((h.programs || []).length) inProg++;
        probSum += global.CivicAI.score(h).prob;
      });
      const supporters = dist[5] + dist[4];
      return {
        households: rows.length,
        people: people,
        citizens: cits.length,
        voters: voters.length,
        dist: dist,
        supporters: supporters,
        supportRate: rows.length ? supporters / rows.length : 0,
        contacted: contacted,
        coverage: rows.length ? contacted / rows.length : 0,
        avgProb: rows.length ? probSum / rows.length : 0,
        inProgram: inProg,
        programRate: rows.length ? inProg / rows.length : 0
      };
    },

    byKhoroo(rows) {
      rows = rows || this.db.households;
      const m = new Map();
      rows.forEach(h => {
        const k = h.district + '|' + h.khoroo;
        if (!m.has(k)) m.set(k, { district: h.district, khoroo: h.khoroo, rows: [], lat: 0, lng: 0 });
        const e = m.get(k);
        e.rows.push(h);
        e.lat += +h.lat || 0; e.lng += +h.lng || 0;
      });
      return Array.from(m.values()).map(e => {
        const s = this.stats(e.rows);
        return Object.assign({
          key: e.district + ' ' + e.khoroo + '-р хороо',
          district: e.district, khoroo: e.khoroo,
          lat: e.lat / e.rows.length, lng: e.lng / e.rows.length
        }, s);
      });
    },

    byDistrict(rows) {
      rows = rows || this.db.households;
      const m = new Map();
      rows.forEach(h => {
        if (!m.has(h.district)) m.set(h.district, []);
        m.get(h.district).push(h);
      });
      return Array.from(m.entries()).map(([name, rs]) =>
        Object.assign({ name: name }, this.stats(rs))
      ).sort((a, b) => b.households - a.households);
    },

    /* --- trend (сүүлийн 12 сарын хамрагдалт) --- */
    trend(months) {
      months = months || 12;
      const out = [];
      const now = new Date();
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toISOString().slice(0, 7);
        const ints = this.db.interactions.filter(x => (x.date || '').slice(0, 7) === key);
        const pos = ints.filter(x => x.result === 'Эерэг').length;
        out.push({
          month: key,
          label: (d.getMonth() + 1) + '-р сар',
          contacts: ints.length,
          positive: pos,
          rate: ints.length ? pos / ints.length : 0
        });
      }
      return out;
    },

    /* --- бүрэн сольж оруулах (import) --- */
    replaceAll(db) {
      this.db = db;
      this.normalize();
      this.persist();
    },
    reseed(n) {
      this.db = generateSeed(n || 1400);
      this.persist();
    },
    clearAll() {
      this.db = { households: [], citizens: [], programs: [], interactions: [], issues: [], staff: [], tasks: [] };
      this.persist();
    },

    /* --- Supabase (нэмэлт) --- */
    async connectSupabase(url, key) {
      if (!url || !key || !global.supabase) return false;
      this.sb = global.supabase.createClient(url, key);
      this.cfg.sbUrl = url; this.cfg.sbKey = key;
      this.saveCfg();
      return true;
    },
    async pushToSupabase() {
      if (!this.sb) throw new Error('Supabase холбогдоогүй');
      const chunks = (arr, n) => {
        const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o;
      };
      for (const t of this.TABLES) {
        for (const c of chunks(this.db[t], 500)) {
          const { error } = await this.sb.from(t).upsert(c);
          if (error) throw error;
        }
      }
      return true;
    },
    async pullFromSupabase() {
      if (!this.sb) throw new Error('Supabase холбогдоогүй');
      const db = {};
      for (const t of this.TABLES) {
        const { data, error } = await this.sb.from(t).select('*').limit(50000);
        if (error) throw error;
        db[t] = data || [];
      }
      this.replaceAll(db);
      return db;
    }
  };

  global.CivicStore = Store;
  global.CivicConst = {
    SUPPORT, PARTIES, HOUSING, INCOME, EDU, CONTACT_TYPES, ISSUE_CATS,
    DISTRICTS, STREETS, PROGRAM_SEED, ROLES, TASK_STATUS, TASK_PRIO, TASK_TAGS,
    uid, today, daysAgo, prng
  };

})(window);
