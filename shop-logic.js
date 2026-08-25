// ===== Чистая логика магазина и монет =====
// Без DOM и localStorage — только правила. Используется и игрой (index.html),
// и автотестами (npm test). Одна логика — один источник правды.
//
// Формат состояния игрока: { coins: Number, owned: [id...], selected: id }

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // Node / тесты
  if (typeof window !== 'undefined') window.ShopLogic = api;                  // браузер / игра
})(this, function () {

  // Простой строковый хеш (djb2) от соли + значения. Не криптография —
  // цель: чтобы ручная правка монет без пересчёта хеша не прошла проверку.
  function coinsHash(n, salt) {
    const s = salt + ':' + n;
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  // Кодируем баланс в строку "значение|контрольная_сумма"
  function encodeCoins(n, salt) {
    return n + '|' + coinsHash(n, salt);
  }

  // Декодируем и проверяем. Если формат сломан или сумма не сходится — вернём 0.
  function decodeCoins(raw, salt) {
    if (!raw) return 0;
    const sep = String(raw).indexOf('|');
    if (sep === -1) return 0;
    const val = Number(String(raw).slice(0, sep));
    const hash = String(raw).slice(sep + 1);
    if (!Number.isInteger(val) || val < 0 || hash !== coinsHash(val, salt)) return 0;
    return val;
  }

  // Можно ли купить скин: ещё не куплен И хватает монет
  function canBuy(state, skin) {
    return !state.owned.includes(skin.id) && state.coins >= skin.price;
  }

  // Покупка. Возвращает { ok, reason, state } — state НОВЫЙ (без мутации входного).
  function buy(state, skin) {
    if (state.owned.includes(skin.id)) {
      return { ok: false, reason: 'already_owned', state: state };
    }
    if (state.coins < skin.price) {
      return { ok: false, reason: 'not_enough_coins', state: state };
    }
    return {
      ok: true,
      reason: 'ok',
      state: {
        coins: state.coins - skin.price,
        owned: state.owned.concat(skin.id),
        selected: skin.id, // купил — сразу выбран
      },
    };
  }

  // Выбор скина. Разрешён только если скин куплен.
  function select(state, id) {
    if (!state.owned.includes(id)) {
      return { ok: false, reason: 'not_owned', state: state };
    }
    return { ok: true, reason: 'ok', state: Object.assign({}, state, { selected: id }) };
  }

  // Активный скин, который использует игра при отрисовке (fallback — первый).
  function activeSkin(skins, id) {
    return skins.find(function (s) { return s.id === id; }) || skins[0];
  }

  return {
    coinsHash: coinsHash,
    encodeCoins: encodeCoins,
    decodeCoins: decodeCoins,
    canBuy: canBuy,
    buy: buy,
    select: select,
    activeSkin: activeSkin,
  };
});
