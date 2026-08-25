// ===== Чистая логика движения «Змейки» =====
// Без рисования, звука, DOM и localStorage — только правила игры.
// Используется и игрой (index.html), и автотестами (npm test).
//
// Змейка — массив сегментов [{x,y}, ...], [0] — голова.
// Направление — {x, y}, например {x:1,y:0} — вправо.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // Node / тесты
  if (typeof window !== 'undefined') window.GameLogic = api;                   // браузер / игра
})(this, function () {

  // Новая голова = старая голова + направление
  function nextHead(head, dir) {
    return { x: head.x + dir.x, y: head.y + dir.y };
  }

  // Голова за стеной? (поле cells × cells)
  function hitsWall(head, cells) {
    return head.x < 0 || head.x >= cells || head.y < 0 || head.y >= cells;
  }

  // Голова врезалась в тело змейки?
  function hitsSelf(head, snake) {
    return snake.some(function (seg) { return seg.x === head.x && seg.y === head.y; });
  }

  // Это разворот на 180°? (нельзя — змейка врежется в себя)
  function isReverse(dir, x, y) {
    return dir.x === -x && dir.y === -y;
  }

  // Итоговое направление с учётом запрета разворота.
  // Если запрошен разворот на 180° — оставляем текущее направление.
  function safeDirection(current, req) {
    if (isReverse(current, req.x, req.y)) return { x: current.x, y: current.y };
    return { x: req.x, y: req.y };
  }

  // Один шаг змейки. НИЧЕГО не рисует и не звучит — только считает новое состояние.
  // Возвращает { gameOver, ate, snake }:
  //  - gameOver: true, если врезались в стену или в себя (тогда snake не меняется);
  //  - ate: true, если съели еду (тогда длина выросла на 1);
  //  - snake: новый массив сегментов.
  function advance(snake, dir, food, cells) {
    const head = nextHead(snake[0], dir);

    if (hitsWall(head, cells) || hitsSelf(head, snake)) {
      return { gameOver: true, ate: false, snake: snake };
    }

    const grown = [head].concat(snake); // добавили голову вперёд
    const ate = !!food && head.x === food.x && head.y === food.y;
    if (!ate) grown.pop();              // не ели — убрали хвост (длина не меняется)

    return { gameOver: false, ate: ate, snake: grown };
  }

  return {
    nextHead: nextHead,
    hitsWall: hitsWall,
    hitsSelf: hitsSelf,
    isReverse: isReverse,
    safeDirection: safeDirection,
    advance: advance,
  };
});
