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
    enabled: false, // станет true, когда в Модуле 5 подключим Supabase
    client: null,   // сюда положим клиент Supabase (createClient(url, anonKey))

    // Настроить онлайн-хранилище (вызовем в Модуле 5). Реальные ключи — НЕ здесь, а в .env/конфиге.
    configure(client) {
      this.client = client || null;
      this.enabled = !!client;
    },

    // Отправить рекорд/счёт онлайн. Пока заглушка — не падает офлайн и без Supabase.
    async saveScoreOnline(score, meta) {
      if (!isOnline() || !this.enabled || !this.client) {
        return { ok: false, reason: 'offline_or_not_configured' }; // штатно, без исключений
      }
      // TODO (Модуль 5): await this.client.from('scores').insert({ score, ...(meta || {}) });
      return { ok: false, reason: 'not_implemented' };
    },

    // Загрузить таблицу лидеров онлайн. Пока пусто.
    async loadLeaderboardOnline() {
      if (!isOnline() || !this.enabled || !this.client) {
        return { ok: false, data: [] };
      }
      // TODO (Модуль 5): const { data } = await this.client.from('scores').select('*').order('score', { ascending: false }).limit(20);
      return { ok: false, data: [] };
    },
  };

  return { KEYS, get, set, remove, isOnline, online };
});
