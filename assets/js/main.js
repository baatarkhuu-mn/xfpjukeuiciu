/* ==========================================================================
   main.js — Нэвтрэлт (Auth) + системийн эхлүүлэлт
   ========================================================================== */
(function (global) {
  'use strict';

  const S = () => global.CivicStore;
  const K = () => global.CivicConst;
  const UI = () => global.CivicUI;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const LS_USERS = 'civicos.users.v1';
  const LS_SESSION = 'civicos.session';

  /* ---------- Нууц үгийн hash ---------- */
  async function hash(pw, salt) {
    const data = new TextEncoder().encode(salt + '::' + pw + '::civicos');
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function newSalt() {
    const a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const Auth = {
    list() {
      try { return JSON.parse(localStorage.getItem(LS_USERS) || '[]'); }
      catch (e) { return []; }
    },
    save(u) { localStorage.setItem(LS_USERS, JSON.stringify(u)); },

    async create(username, password, role) {
      const users = this.list();
      username = String(username || '').trim().toLowerCase();
      if (!username) throw new Error('Нэвтрэх нэр оруулна уу');
      if (String(password || '').length < 6) throw new Error('Нууц үг дор хаяж 6 тэмдэгт байх ёстой');
      if (users.some(x => x.u === username)) throw new Error('Ийм нэртэй хэрэглэгч бүртгэлтэй байна');
      const s = newSalt();
      users.push({ u: username, s: s, h: await hash(password, s), r: role || 'admin', c: new Date().toISOString() });
      this.save(users);
      return true;
    },

    async verify(username, password) {
      const u = this.list().find(x => x.u === String(username || '').trim().toLowerCase());
      if (!u) return null;
      const h = await hash(password, u.s);
      return h === u.h ? u : null;
    },

    remove(username) { this.save(this.list().filter(x => x.u !== username)); },

    session() {
      try { return JSON.parse(sessionStorage.getItem(LS_SESSION) || 'null'); }
      catch (e) { return null; }
    },
    setSession(u) {
      sessionStorage.setItem(LS_SESSION, JSON.stringify({ u: u.u, r: u.r, t: Date.now() }));
    },
    logout() { sessionStorage.removeItem(LS_SESSION); location.reload(); },

    addUserForm() {
      UI().openModal('Хэрэглэгч нэмэх',
        '<div class="field"><label class="fl">Нэвтрэх нэр</label><input class="inp" name="u" id="nuU"></div>' +
        '<div class="field"><label class="fl">Нууц үг (6+ тэмдэгт)</label>' +
        '<input class="inp" type="password" name="p" id="nuP"></div>' +
        '<div class="field"><label class="fl">Эрх</label><select class="inp" id="nuR">' +
        Object.keys(K().ROLES).map(k => '<option value="' + k + '">' + K().ROLES[k].name +
          ' — ' + K().ROLES[k].can.join(', ') + '</option>').join('') + '</select></div>',
        '<button class="btn" onclick="CivicUI.closeModal()">Болих</button>' +
        '<button class="btn primary" id="nuSave">Үүсгэх</button>');
      $('nuSave').onclick = async () => {
        try {
          await Auth.create($('nuU').value, $('nuP').value, $('nuR').value);
          UI().closeModal(); UI().toast('Хэрэглэгч үүслээ', 'ok'); UI().drawUsers();
        } catch (e) { UI().toast(e.message, 'err'); }
      };
    }
  };

  /* ---------- Gate ---------- */
  let setupMode = false;

  function paintGate() {
    setupMode = Auth.list().length === 0;
    const card = document.querySelector('.gate-card');
    if (setupMode) {
      card.querySelector('h1').textContent = 'Анхны тохиргоо';
      card.querySelector('.sub').textContent = 'Штабын админ бүртгэлээ үүсгэнэ үү';
      $('gbtn').textContent = 'Бүртгэл үүсгэх';
      $('gu').placeholder = 'admin';
      $('gp').placeholder = 'Хүчтэй нууц үг (6+)';
      $('gp').autocomplete = 'new-password';
      card.querySelector('.gate-hint').innerHTML =
        'Энэ бол <b>анхны админ</b> бүртгэл. Нууц үг зөвхөн энэ браузерт SHA-256 хэлбэрээр хадгалагдана — ' +
        'сэргээх боломжгүй тул сайн тэмдэглэж ав. Багийнхандаа <b>Тохиргоо → Хэрэглэгчид</b> хэсгээс ' +
        'тус тусад нь эрх олгоно.';
    }
  }

  async function doGate() {
    const u = $('gu').value, p = $('gp').value;
    $('gerr').textContent = '';
    try {
      if (setupMode) {
        await Auth.create(u, p, 'admin');
        const usr = await Auth.verify(u, p);
        Auth.setSession(usr);
        enter(usr);
      } else {
        const usr = await Auth.verify(u, p);
        if (!usr) { $('gerr').textContent = 'Нэр эсвэл нууц үг буруу байна'; return; }
        Auth.setSession(usr);
        enter(usr);
      }
    } catch (e) { $('gerr').textContent = e.message; }
  }

  /* ---------- Систем эхлүүлэх ---------- */
  async function enter(usr) {
    $('gate').classList.add('hide');
    $('app').classList.remove('hide');

    S().user = usr.u;
    S().role = usr.r || 'viewer';
    $('unm').textContent = usr.u;
    $('url').textContent = (K().ROLES[usr.r] || {}).name || usr.r;
    $('uav').textContent = UI().initials(usr.u);

    await S().init();

    /* Хадгалсан загварын жин */
    try {
      const w = JSON.parse(localStorage.getItem('civicos.weights') || 'null');
      if (w) global.CivicAI.setWeights(w);
    } catch (e) { /* noop */ }

    /* Supabase автомат холболт */
    if (S().cfg.sbUrl && S().cfg.sbKey) {
      try { await S().connectSupabase(S().cfg.sbUrl, S().cfg.sbKey); } catch (e) { console.warn(e); }
    }

    applyRole();
    bindShell();

    const start = (location.hash || '').slice(1) || 'dashboard';
    UI().go(document.querySelector('.page[data-page="' + start + '"]') ? start : 'dashboard');

    S().on(() => UI().badges());
  }

  function applyRole() {
    const canEdit = S().can('edit');
    if (!canEdit) {
      ['hhAdd', 'pgAdd', 'tmAdd', 'tkAdd'].forEach(id => { if ($(id)) $(id).classList.add('hide'); });
    }
    if (!S().can('manage')) {
      const nav = document.querySelector('.nav-item[data-page="settings"]');
      if (nav) nav.classList.add('hide');
    }
    if (!S().can('export')) {
      const nav = document.querySelector('.nav-item[data-page="io"]');
      if (nav) nav.classList.add('hide');
    }
  }

  function bindShell() {
    document.querySelectorAll('.nav-item').forEach(n =>
      n.onclick = () => UI().go(n.dataset.page));
    $('ulogout').onclick = () => UI().confirmBox('Гарах уу?', 'Системээс гарна.', Auth.logout);

    /* Глобал хайлт */
    let t;
    $('globalSearch').oninput = e => {
      clearTimeout(t);
      t = setTimeout(() => {
        const q = e.target.value.trim();
        if (!q) return;
        UI().go('households');
        setTimeout(() => {
          $('hhQ').value = q;
          $('hhQ').dispatchEvent(new Event('input'));
        }, 60);
      }, 420);
    };

    /* Товчлол */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { UI().closeModal(); UI().closeDrawer(); }
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        UI().go('dashboard');
        setTimeout(() => $('globalSearch').focus(), 80);
      }
    });

    window.addEventListener('hashchange', () => {
      const p = location.hash.slice(1);
      if (p && document.querySelector('.page[data-page="' + p + '"]')) UI().go(p);
    });
  }

  /* ---------- Boot ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    paintGate();
    $('gbtn').onclick = doGate;
    ['gu', 'gp'].forEach(id => $(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') doGate();
    }));

    const s = Auth.session();
    if (s) {
      const u = Auth.list().find(x => x.u === s.u);
      if (u) { enter(u); return; }
    }
    $('gu').focus();
  });

  global.CivicAuth = Auth;

})(window);
