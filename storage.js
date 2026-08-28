// ===== Единый модуль хранения данных игры =====
// ВСЕ операции с localStorage идут ТОЛЬКО через этот модуль (get/set/remove).
// Здесь же — точка будущего подключения онлайна (Supabase, Модуль 5).
// Реальный Supabase НЕ подключён и ключи НЕ вставлены — только подготовлено место.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // Node
  if (typeof window !== 'undefined') window.GameStorage = api;                 // браузер
})(this, function () {

  // Все ключи хранилища — в одном месте
  const KEYS = {
    best: 'snakeBestScore',
    coins: 'snakeCoins',
    owned: 'snakeOwnedSkins',
    selected: 'snakeSelectedSkin',
    muted: 'snakeMuted',
    vibro: 'snakeVibro',
    colorblind: 'snakeColorblind',
    consent: 'snakeLeaderboardConsent', // согласие на отправку в общий топ: 'granted' | 'declined'
    playerName: 'snakePlayerName',       // имя игрока для таблицы рекордов
    auth: 'snakeAuth',                    // сессия анонимного аккаунта: {userId, accessToken, refreshToken, nickname}
  };

  // Есть ли доступ к localStorage (в приватном режиме/старых браузерах может не быть)
  function hasLS() {
    try { return typeof localStorage !== 'undefined' && localStorage !== null; }
    catch (e) { return false; }
  }

  // Безопасные обёртки: при любой проблеме не роняют игру, а тихо возвращают null/false.
  function get(key) {
    if (!hasLS()) return null;
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function set(key, value) {
    if (!hasLS()) return false;
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
  function remove(key) {
    if (!hasLS()) return false;
    try { localStorage.removeItem(key); return true; } catch (e) { return false; }
  }

  // Есть ли сеть (по мнению браузера). Если API нет — считаем, что есть.
  function isOnline() {
    try { return typeof navigator !== 'undefined' ? navigator.onLine !== false : true; }
    catch (e) { return true; }
  }

  // ===== ТОЧКА ПОДКЛЮЧЕНИЯ ОНЛАЙНА (Supabase — Модуль 5) =====
  // Сейчас это ЗАГЛУШКИ. Они безопасны: без сети или без настроенного Supabase
  // просто ничего не делают и не бросают ошибок.
  const online = {
    enabled: false,  // true, когда есть конфиг (url + anonKey)
    config: null,    // { url, anonKey }

    // Настроить онлайн через REST API Supabase. Никакого внешнего SDK — только fetch.
    configure(cfg) {
      if (cfg && cfg.url && cfg.anonKey) {
        this.config = { url: String(cfg.url).replace(/\/+$/, ''), anonKey: cfg.anonKey };
        this.enabled = true;
      } else {
        this.config = null;
        this.enabled = false;
      }
    },

    _headers() {
      return {
        'apikey': this.config.anonKey,
        'Authorization': 'Bearer ' + this.config.anonKey,
        'Content-Type': 'application/json',
      };
    },

    // Отправить рекорд в общий топ (таблица leaderboard). Безопасно: любые ошибки
    // (офлайн, нет конфига, лимит частоты на сервере) возвращаются как {ok:false}, без исключений.
    async saveScoreOnline(score, meta) {
      if (!isOnline() || !this.enabled || !this.config) {
        return { ok: false, reason: 'offline_or_not_configured' };
      }
      try {
        const name = (meta && meta.player_name ? String(meta.player_name) : '').trim().slice(0, 24);
        // Валидация в коде (дублирует правила RLS): целый счёт > 0 и непустое имя.
        // Так мы не шлём заведомо плохие запросы и даём понятный результат.
        if (!Number.isInteger(score) || score <= 0 || name.length === 0) {
          return { ok: false, reason: 'invalid_input' };
        }
        const resp = await fetch(this.config.url + '/rest/v1/leaderboard', {
          method: 'POST',
          headers: this._headers(),
          body: JSON.stringify({ player_name: name, score: score }),
        });
        if (!resp.ok) {
          let msg = 'http_' + resp.status;
          try { const j = await resp.json(); msg = j.message || j.error || msg; } catch (e) {}
          return { ok: false, reason: msg }; // напр. срабатывание лимита частоты на сервере
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: String(e) };
      }
    },

    // Загрузить топ (по убыванию очков). {ok, data:[{player_name, score, created_at}]}.
    async loadLeaderboardOnline(limit) {
      if (!isOnline() || !this.enabled || !this.config) {
        return { ok: false, data: [] };
      }
      try {
        // Читаем ТОЛЬКО через view leaderboard_top — она уже ограничена топ-50 по убыванию score.
        // Лимит в запросе дополнительно ограничиваем 50 (view всё равно не отдаст больше).
        const cap = Math.min(Number(limit) || 20, 50);
        const url = this.config.url +
          '/rest/v1/leaderboard_top?select=player_name,score,created_at&order=score.desc&limit=' + cap;
        const resp = await fetch(url, { headers: this._headers() });
        if (!resp.ok) return { ok: false, data: [], reason: 'http_' + resp.status };
        const data = await resp.json();
        return { ok: true, data: Array.isArray(data) ? data : [] };
      } catch (e) {
        return { ok: false, data: [], reason: String(e) };
      }
    },

    // ===== АВТОРИЗАЦИЯ: анонимный аккаунт Supabase =====
    // Заголовки от имени вошедшего пользователя (access_token), чтобы работал auth.uid() в RLS.
    _authHeaders(accessToken) {
      return {
        'apikey': this.config.anonKey,
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      };
    },

    // Анонимный вход. {ok, session:{userId, accessToken, refreshToken}} либо {ok:false, reason}.
    async signInAnonymously() {
      if (!isOnline() || !this.enabled || !this.config) return { ok: false, reason: 'offline_or_not_configured' };
      try {
        const resp = await fetch(this.config.url + '/auth/v1/signup', {
          method: 'POST',
          headers: { 'apikey': this.config.anonKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: {}, gotrue_meta_security: {} }),
        });
        const j = await resp.json().catch(function () { return {}; });
        if (!resp.ok || !j.access_token) {
          return { ok: false, reason: j.msg || j.error_description || j.error_code || ('http_' + resp.status) };
        }
        return { ok: true, session: { userId: j.user.id, accessToken: j.access_token, refreshToken: j.refresh_token } };
      } catch (e) { return { ok: false, reason: String(e) }; }
    },

    // Обновить access_token по refresh_token (сессия живёт долго). {ok, session}.
    async refreshSession(refreshToken) {
      if (!isOnline() || !this.enabled || !this.config || !refreshToken) return { ok: false };
      try {
        const resp = await fetch(this.config.url + '/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          headers: { 'apikey': this.config.anonKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        const j = await resp.json().catch(function () { return {}; });
        if (!resp.ok || !j.access_token) return { ok: false };
        return { ok: true, session: { userId: j.user.id, accessToken: j.access_token, refreshToken: j.refresh_token } };
      } catch (e) { return { ok: false }; }
    },

    // Создать/обновить профиль (upsert по user_id). profile={nickname,coins,owned_skins,selected_skin,best_score}.
    async saveProfile(session, profile) {
      if (!isOnline() || !this.enabled || !this.config || !session) return { ok: false, reason: 'offline_or_no_session' };
      try {
        const body = Object.assign({ user_id: session.userId }, profile);
        const resp = await fetch(this.config.url + '/rest/v1/profiles?on_conflict=user_id', {
          method: 'POST',
          headers: Object.assign(this._authHeaders(session.accessToken), { 'Prefer': 'resolution=merge-duplicates' }),
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          let m = 'http_' + resp.status;
          try { const j = await resp.json(); m = j.message || m; } catch (e) {}
          return { ok: false, reason: m, status: resp.status };
        }
        return { ok: true };
      } catch (e) { return { ok: false, reason: String(e) }; }
    },

    // Загрузить профиль текущего пользователя. {ok, profile|null}.
    async loadProfile(session) {
      if (!isOnline() || !this.enabled || !this.config || !session) return { ok: false, profile: null };
      try {
        const resp = await fetch(this.config.url + '/rest/v1/profiles?select=*&user_id=eq.' + session.userId, {
          headers: this._authHeaders(session.accessToken),
        });
        if (!resp.ok) return { ok: false, profile: null, reason: 'http_' + resp.status, status: resp.status };
        const arr = await resp.json();
        return { ok: true, profile: Array.isArray(arr) && arr[0] ? arr[0] : null };
      } catch (e) { return { ok: false, profile: null, reason: String(e) }; }
    },

    // ===== ВХОД ПО EMAIL (OTP-код) =====
    // Запросить код на email. Если передана anon-сессия — ПРИВЯЗЫВАЕМ email к текущему аккаунту
    // (PUT /user), иначе — обычный OTP-вход (создаст аккаунт при необходимости).
    // {ok, linking:bool, reason?}
    async requestEmailCode(email, session) {
      if (!isOnline() || !this.enabled || !this.config) return { ok: false, reason: 'offline_or_not_configured' };
      email = String(email || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: 'invalid_email' };
      try {
        if (session && session.accessToken) {
          // Привязка email к текущему анонимному аккаунту (прогресс сохранится)
          const resp = await fetch(this.config.url + '/auth/v1/user', {
            method: 'PUT',
            headers: this._authHeaders(session.accessToken),
            body: JSON.stringify({ email: email }),
          });
          if (!resp.ok) { let m = 'http_' + resp.status; try { const j = await resp.json(); m = j.msg || j.error_description || m; } catch (e) {} return { ok: false, reason: m }; }
          return { ok: true, linking: true };
        } else {
          // Обычный вход по email
          const resp = await fetch(this.config.url + '/auth/v1/otp', {
            method: 'POST',
            headers: { 'apikey': this.config.anonKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, create_user: true }),
          });
          if (!resp.ok) { let m = 'http_' + resp.status; try { const j = await resp.json(); m = j.msg || j.error_description || m; } catch (e) {} return { ok: false, reason: m }; }
          return { ok: true, linking: false };
        }
      } catch (e) { return { ok: false, reason: String(e) }; }
    },

    // Подтвердить код из письма. linking=true — подтверждение привязки email (email_change),
    // иначе — обычный вход (email). {ok, session?, reason?}
    async verifyEmailCode(email, token, linking) {
      if (!isOnline() || !this.enabled || !this.config) return { ok: false, reason: 'offline_or_not_configured' };
      try {
        const type = linking ? 'email_change' : 'email';
        const resp = await fetch(this.config.url + '/auth/v1/verify', {
          method: 'POST',
          headers: { 'apikey': this.config.anonKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: type, email: String(email).trim(), token: String(token).trim() }),
        });
        const j = await resp.json().catch(function () { return {}; });
        if (!resp.ok) return { ok: false, reason: j.msg || j.error_description || ('http_' + resp.status) };
        const s = j.access_token ? { userId: (j.user || {}).id, accessToken: j.access_token, refreshToken: j.refresh_token, email: (j.user || {}).email || email } : null;
        return { ok: true, session: s };
      } catch (e) { return { ok: false, reason: String(e) }; }
    },
  };

  return { KEYS, get, set, remove, isOnline, online };
});
