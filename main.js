// ===== DOM 引用 =====
const $ = (s) => document.querySelector(s);
const canvas = $('#gameCanvas'), ctx = canvas.getContext('2d');
const mini = $('#miniMap'), mctx = mini.getContext('2d');
const ui = {
  overlay: $('#gameOverlay'), start: $('#startButton'), score: $('#scoreValue'),
  length: $('#lengthValue'), kills: $('#killsValue'), best: $('#bestValue'),
  rank: $('#rankList'), progress: $('#challengeProgress'), challenge: $('#challengeText'),
  status: $('#statusText'), sound: $('#soundButton'), wheel: $('#directionWheel'),
  knob: $('.wheel-knob'), boost: $('#boostButton'), difficultyBadge: $('#difficultyBadge'),
  energyFill: $('#energyFill'), energyMeter: $('.energy-meter'),
  buffBar: $('#buffBar'), resultStats: $('#resultStats'),
  fullscreen: $('#fullscreenButton'),
};

// ===== 常量配置 =====
const W = canvas.width, H = canvas.height, cell = 16;
const arena = { w: 60, h: 40 };
const BOT_SPEED = .5, BOT_TURN_RATE = .3; // AI 蛇每步前进距离 / 最大转向角(弧度)
const BOT_NAMES = ['RIFT', 'NOVA', 'PIXEL', 'ECHO', 'GHOST', 'VIPER', 'ONYX', 'ZETA', 'BYTE', 'QUARK', 'BLITZ', 'FANG', 'HYDRA', 'WRAITH'];
const BOT_COLORS = ['#ffbb4e', '#f474cc', '#9a7bff', '#4bc7ff', '#ff785c', '#7cf07c'];
const difficultyConfig = { // iq:AI 智能系数(影响前瞻距离/威胁敏感度/手抖噪声);maxBots:场上 AI 数量上限
  easy: { label: '新手', step: 74, bots: 3, boost: .76, iq: .72, maxBots: 6 },
  normal: { label: '标准', step: 64, bots: 5, boost: .9, iq: 1, maxBots: 10 },
  hard: { label: '极限', step: 48, bots: 8, boost: 1.06, iq: 1.25, maxBots: 14 },
};
const COMBO_WINDOW = 2400;                                    // 连击判定窗口(ms)
const REPLAY_ICON = '<svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>'; // 再来一局按钮的重玩图标
const ENERGY_MAX = 100, ENERGY_DRAIN = 30, ENERGY_REGEN = 11, ENERGY_UNLOCK = 18;
const HEAD_RGB = [212, 255, 96], TAIL_RGB = [16, 150, 148];   // 蛇身头尾渐变色

// ===== 运行状态 =====
let soundOn = true, running = false, paused = false, wheelActive = false;
let last = 0, accumulator = 0, step = 64;
let score = 0, kills = 0, best = Number(localStorage.snakeArenaBest || 0);
let difficulty = 'easy';
let snake, bots, foods, remains, powerUps, sparks, popups;
let direction, nextDirection;
let boosting = false, boostLock = false, energy = ENERGY_MAX;
let combo = 0, comboTimer = 0, maxCombo = 0, foodsEaten = 0, starsEaten = 0;
let magnetTimer = 0, playerShield = 0, shieldTotal = 1; // shieldTotal:当前护盾总时长(用于进度条)
let shieldTouchCd = 0; // 护盾碰撞提示冷却(ms),穿身时限频防刷屏
let botSpawnTimer = 0, nextBotSpawn = 2500, powerUpTimer = 0;
let countdown = 0, lastCount = 0, goFlash = 0;
let shake = 0, deathFlash = 0, elapsed = 0, deathToken = 0;

// ===== 工具函数 =====
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hexToRgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const bodyColor = (t) => `rgb(${Math.round(lerp(HEAD_RGB[0], TAIL_RGB[0], t))},${Math.round(lerp(HEAD_RGB[1], TAIL_RGB[1], t))},${Math.round(lerp(HEAD_RGB[2], TAIL_RGB[2], t))})`;

// ===== 音效(复用单个 AudioContext,避免上下文耗尽) =====
let audioCtx = null;
function audio() {
  if (!soundOn) return null;
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function beep(freq, duration, volume = .04, type = 'triangle', delay = 0) {
  const ac = audio(); if (!ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(.0008, t + duration);
  o.connect(g).connect(ac.destination);
  o.start(t); o.stop(t + duration + .02);
}

// ===== 实体生成 =====
function makeFood() {
  const star = Math.random() < .16;
  return { x: 2 + Math.random() * 56, y: 2 + Math.random() * 36, hue: star ? 45 : Math.random() * 80 + 140, pulse: Math.random() * 6, star };
}
function makeBot(name, color, x, y, angle) {
  const body = [];
  const segs = 10 + Math.floor(Math.random() * 14); // 每节间距 .5 格,视觉长度 5~12 格
  for (let i = 0; i < segs; i++) body.push({ x: x - Math.cos(angle) * BOT_SPEED * i, y: y - Math.sin(angle) * BOT_SPEED * i });
  return {
    name, color, body, angle, targetAngle: angle, steerCd: 0,
    score: body.length * 7, shield: 5000, growth: 0,
    greed: .75 + Math.random() * .5,    // 性格:贪食度(食物吸引权重)
    caution: .75 + Math.random() * .55, // 性格:谨慎度(威胁规避权重)
    inertia: .1 + Math.random() * .09,  // 性格:惯性(转向代价)
    aggro: Math.random(),               // 性格:侵略性(高者会预判截击玩家)
  };
}
function spawnBot() {
  const edge = Math.floor(Math.random() * 4), margin = 3;
  const x = edge < 2 ? (edge ? arena.w - margin : margin) : margin + Math.random() * (arena.w - margin * 2);
  const y = edge > 1 ? (edge === 2 ? margin : arena.h - margin) : margin + Math.random() * (arena.h - margin * 2);
  const angle = Math.atan2(arena.h / 2 - y, arena.w / 2 - x) + (Math.random() - .5) * 1.2; // 朝场内 ± 随机偏移
  bots.push(makeBot(BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)], BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)], x, y, angle));
  burst(x, y, '#7defff');
}
function spawnPowerUp() {
  const type = Math.random() < .5 ? 'magnet' : 'shield', angle = Math.random() * Math.PI * 2, speed = .025 + Math.random() * .03;
  powerUps.push({ type, x: 4 + Math.random() * 52, y: 4 + Math.random() * 32, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, life: 7000 + Math.random() * 6000, pulse: Math.random() * 6 });
}

// ===== 流程控制 =====
// 随机出生点:避开边缘与 AI 蛇头,随机朝向
function randomSpawn() {
  for (let tries = 0; tries < 40; tries++) {
    const x = 8 + Math.random() * (arena.w - 16), y = 7 + Math.random() * (arena.h - 14);
    if (bots.every((b) => dist({ x, y }, b.body[0]) > 7)) return { x, y, angle: Math.random() * Math.PI * 2 };
  }
  return { x: arena.w / 2, y: arena.h / 2, angle: Math.random() * Math.PI * 2 };
}
function reset() {
  const config = difficultyConfig[difficulty];
  step = config.step;
  score = 0; kills = 0; sparks = []; popups = []; remains = []; powerUps = [];
  powerUpTimer = 0; magnetTimer = 0; playerShield = 0; shieldTotal = 1; shieldTouchCd = 0;
  combo = 0; comboTimer = 0; maxCombo = 0; foodsEaten = 0; starsEaten = 0;
  energy = ENERGY_MAX; boostLock = false; setBoost(false);
  foods = Array.from({ length: 35 }, makeFood);
  bots = [];
  for (let i = 0; i < config.bots; i++) spawnBot();
  const spawn = randomSpawn();
  direction = nextDirection = { x: Math.cos(spawn.angle), y: Math.sin(spawn.angle) };
  snake = Array.from({ length: 22 }, (_, i) => ({ x: spawn.x - direction.x * .36 * i, y: spawn.y - direction.y * .36 * i }));
  elapsed = 0; shake = 0; deathFlash = 0;
  updateUI(); setKnob(direction);
}
function start() {
  audio(); // 在用户手势内解锁音频
  reset();
  ui.resultStats.classList.add('hidden');
  ui.start.classList.remove('again');
  botSpawnTimer = 0; nextBotSpawn = 1800 + Math.random() * 3200;
  running = true; paused = false;
  countdown = 2400; lastCount = 4; goFlash = 0;
  playerShield = 5000; shieldTotal = 5000; // 出生 5 秒保护罩
  updateUI(); // 倒计时期间也显示护盾状态
  ui.overlay.classList.add('hidden');
  ui.status.textContent = '准备中';
  last = performance.now();
  requestAnimationFrame(loop);
}
function togglePause() {
  if (!running) return;
  paused = !paused;
  ui.status.textContent = paused ? '已暂停' : '正在战斗';
}
function gameOver() {
  running = false;
  const head = snake[0];
  burst(head.x, head.y, '#ff785c', 26);
  burst(head.x, head.y, '#ffe06b', 18);
  shake = 16; deathFlash = 650;
  const prevBest = best;
  best = Math.max(best, score);
  localStorage.snakeArenaBest = best;
  const length = Math.floor(snake.length / 3);
  const survived = Math.round(elapsed / 1000);
  const isRecord = score > prevBest && score > 0;
  ui.status.textContent = '本局结束';
  ui.best.textContent = best;
  ui.kills.textContent = kills;
  ui.overlay.querySelector('h1').textContent = '战斗结束';
  ui.overlay.querySelector('p').textContent = `获得 ${score} 分 · 蛇身长度 ${length}`;
  ui.resultStats.innerHTML = `
    <div class="rs${isRecord ? ' hot' : ''}"><span>存活时间</span><strong>${survived}s</strong></div>
    <div class="rs"><span>击败对手</span><strong>${kills}</strong></div>
    <div class="rs"><span>食物 / 星星</span><strong>${foodsEaten} / ${starsEaten}</strong></div>
    <div class="rs"><span>最高连击</span><strong>×${Math.max(maxCombo, 1)}</strong></div>
    ${isRecord ? '<em class="record-badge">★ 新纪录</em>' : ''}`;
  ui.resultStats.classList.remove('hidden');
  ui.start.innerHTML = `${REPLAY_ICON}<span>再来一局</span>`;
  ui.start.classList.add('again');
  beep(196, .3, .06, 'sawtooth');
  beep(130, .45, .05, 'sawtooth', .12);
  // 死亡爆炸动画结束后再弹结算面板
  const token = ++deathToken;
  let deathLast = performance.now();
  const deathStart = deathLast;
  const deathLoop = (now) => {
    if (token !== deathToken || running) return;
    const delta = Math.min(now - deathLast, 100); deathLast = now;
    updateEffects(delta);
    shake = Math.max(0, shake - delta * .02);
    deathFlash = Math.max(0, deathFlash - delta);
    draw(now);
    if (now - deathStart < 950) requestAnimationFrame(deathLoop);
    else ui.overlay.classList.remove('hidden');
  };
  requestAnimationFrame(deathLoop);
}

// ===== 主循环 =====
function loop(now) {
  if (!running) return;
  const delta = Math.min(now - last, 100); last = now;
  if (!paused) {
    updateEffects(delta);
    if (countdown > 0) {
      countdown -= delta;
      const count = Math.ceil(countdown / 800);
      if (count !== lastCount && count > 0) { lastCount = count; beep(420, .09, .045); }
      if (countdown <= 0) { goFlash = 500; ui.status.textContent = '正在战斗'; beep(760, .16, .05); }
    } else {
      elapsed += delta;
      goFlash = Math.max(0, goFlash - delta);
      // 计时器
      botSpawnTimer += delta; powerUpTimer += delta;
      magnetTimer = Math.max(0, magnetTimer - delta);
      playerShield = Math.max(0, playerShield - delta);
      shieldTouchCd = Math.max(0, shieldTouchCd - delta);
      bots.forEach((bot) => (bot.shield = Math.max(0, bot.shield - delta)));
      comboTimer = Math.max(0, comboTimer - delta);
      if (!comboTimer) combo = 0;
      // 加速能量
      const burning = boosting && !boostLock && energy > 0;
      if (burning) {
        energy = Math.max(0, energy - (ENERGY_DRAIN * delta) / 1000);
        if (energy <= 0) boostLock = true;
      } else {
        energy = Math.min(ENERGY_MAX, energy + (ENERGY_REGEN * delta) / 1000);
        if (boostLock && energy > ENERGY_UNLOCK) boostLock = false;
      }
      // 道具漂移
      powerUps = powerUps.filter((item) => {
        item.life -= delta; item.x += item.dx * delta; item.y += item.dy * delta;
        if (item.x < 2 || item.x > 58) item.dx *= -1;
        if (item.y < 2 || item.y > 38) item.dy *= -1;
        return item.life > 0;
      });
      if (botSpawnTimer > nextBotSpawn) {
        botSpawnTimer = 0; nextBotSpawn = 1800 + Math.random() * 3200;
        if (bots.length < difficultyConfig[difficulty].maxBots) spawnBot(); // AI 变聪明后存活更久,限制场上数量
      }
      if (powerUpTimer > 5000 + Math.random() * 4000 && powerUps.length < 2) { spawnPowerUp(); powerUpTimer = 0; }
      accumulator += delta;
      while (accumulator > step) { tick(); accumulator -= step; }
    }
  }
  draw(now);
  requestAnimationFrame(loop);
}

// ===== 单步逻辑 =====
function tick() {
  if (!running) return;
  direction = nextDirection;
  const burning = boosting && !boostLock && energy > 0;
  const speed = burning ? difficultyConfig[difficulty].boost : .48;
  const head = { x: snake[0].x + direction.x * speed, y: snake[0].y + direction.y * speed };

  // 碰撞判定(自身可缠绕,自撞不死)
  const hitWall = head.x < .45 || head.y < .45 || head.x > arena.w - .45 || head.y > arena.h - .45;
  let hitBot = null; // 玩家撞到的那条 AI 蛇
  for (const bot of bots) {
    if (bot.body.some((p) => dist(head, p) < .66)) { hitBot = bot; break; }
  }
  // 碰撞规则:撞到 AI 蛇时任一方有护盾则相安无事;双方都无护盾时,撞击方(玩家)死亡、被撞的 AI 蛇存活
  const harmless = !!hitBot && (playerShield > 0 || hitBot.shield > 0);
  if (hitBot && !harmless) { gameOver(); return; }           // 蛇头对撞也不再同归于尽,只有玩家死
  if (hitWall && playerShield <= 0) { gameOver(); return; }  // 无护盾撞墙即死
  if (harmless && shieldTouchCd <= 0) {                      // 护盾抵挡提示(限频防刷屏)
    popup(head.x, head.y, '护盾抵挡!', '#79f3ff', 11);
    beep(320, .06, .035);
    shieldTouchCd = 700;
  }
  if (hitWall && playerShield) { // 护盾状态下撞墙反弹,避免穿出边界
    if (head.x < .45 || head.x > arena.w - .45) { direction = nextDirection = { x: -direction.x, y: direction.y }; head.x = clamp(head.x, .46, arena.w - .46); }
    if (head.y < .45 || head.y > arena.h - .45) { direction = nextDirection = { x: direction.x, y: -direction.y }; head.y = clamp(head.y, .46, arena.h - .46); }
    setKnob(direction);
    popup(head.x, head.y, '弹开!', '#79f3ff', 11);
    beep(300, .08, .04);
  }

  // 道具拾取
  powerUps = powerUps.filter((item) => {
    if (dist(head, item) < .9) {
      const color = item.type === 'magnet' ? '#ff687b' : '#79f3ff';
      if (item.type === 'magnet') magnetTimer = 7000; else { playerShield = 7000; shieldTotal = 7000; }
      burst(item.x, item.y, color, 16);
      popup(item.x, item.y, item.type === 'magnet' ? '磁力吸附!' : '护盾展开!', color, 14);
      beep(item.type === 'magnet' ? 520 : 760, .12, .05);
      beep(item.type === 'magnet' ? 660 : 980, .1, .035, 'triangle', .09);
      return false;
    }
    return true;
  });

  snake.unshift(head);
  let growth = 0;

  // 磁力吸引食物
  if (magnetTimer) foods.forEach((f) => {
    const dx = head.x - f.x, dy = head.y - f.y, d = Math.hypot(dx, dy);
    if (d < 7 && d > .1) { f.x += (dx / d) * .22; f.y += (dy / d) * .22; }
  });

  // 进食:连击加成
  for (let i = foods.length - 1; i >= 0; i--) {
    const f = foods[i];
    if (dist(head, f) < .75) {
      foods.splice(i, 1); foods.push(makeFood());
      combo = Math.min(combo + 1, 9); comboTimer = COMBO_WINDOW; maxCombo = Math.max(maxCombo, combo);
      const multiplier = 1 + Math.min(combo - 1, 4) * .5; // 最高 ×3
      const gained = Math.round((f.star ? 35 : 10) * multiplier);
      if (f.star) starsEaten++; else foodsEaten++;
      score += gained; growth += f.star ? 12 : 3;
      burst(f.x, f.y, f.star ? '#ffe06b' : '#bfff57');
      popup(f.x, f.y, `+${gained}`, f.star ? '#ffe06b' : '#cdff6e', f.star ? 15 : 12);
      if (combo >= 2) popup(f.x, f.y - 1, `COMBO ×${combo}`, '#ff9d5c', 11);
      beep(f.star ? 880 : 560 + Math.min(combo, 8) * 40, .07, .05);
      if (f.star) { beep(1175, .1, .035, 'triangle', .08); shake = Math.max(shake, 3); }
    }
  }

  // 吞食残骸
  remains = remains.filter((part) => {
    if (dist(head, part) < .72) { score += 4; growth += 1; burst(part.x, part.y, part.color); return false; }
    return true;
  });

  // 加速尾焰
  if (burning) for (let i = 0; i < 2; i++) {
    sparks.push({
      x: head.x, y: head.y,
      vx: (Math.random() - .5) * .05 - direction.x * .06,
      vy: (Math.random() - .5) * .05 - direction.y * .06,
      life: 420, max: 420, color: Math.random() < .5 ? '#ffd87a' : '#7defff',
    });
  }

  const targetLength = 22 + (score / 10) * 3 + growth;
  while (snake.length > targetLength) snake.pop();
  bots.forEach(moveBot);
  updateUI();
}

// ===== AI 蛇(360° 连续游动 · 前瞻模拟决策) =====
const normAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const angleDiff = (a, b) => normAngle(a - b);
const dist2 = (dx, dy) => dx * dx + dy * dy;
const BOT_STEER_OFFSETS = [0, .35, -.35, .75, -.75, 1.2, -1.2, 1.9, -1.9, 2.6, -2.6]; // 候选目标航向(几乎覆盖后半圆)
const BOT_GROW_CAP = 46; // AI 蛇身体节数上限(约 23 格,保持比成长后的玩家短)

// 沿角度 a 探测前方畅通距离(碰墙/玩家蛇/其他蛇身体即返回),护盾急转时快速判断哪侧更开阔
function rayClear(h, a, bot) {
  const dx = Math.cos(a), dy = Math.sin(a);
  for (let d = .6; d <= 5.2; d += .6) {
    const x = h.x + dx * d, y = h.y + dy * d;
    if (x < .7 || x > arena.w - .7 || y < .7 || y > arena.h - .7) return d;
    if (snake.some((p) => dist2(x - p.x, y - p.y) < .36)) return d;
    for (const o of bots) {
      if (o === bot) continue;
      if (o.body.some((p) => dist2(x - p.x, y - p.y) < .3)) return d;
    }
  }
  return 6;
}

// 收集前瞻范围内的硬障碍点(玩家蛇身 + 其他 AI 蛇身;本游戏自撞不死,忽略自身)
function nearbyObstacles(bot, range) {
  const h = bot.body[0], r2 = range * range, out = [];
  for (const p of snake) { const dx = p.x - h.x, dy = p.y - h.y; if (dx * dx + dy * dy < r2) out.push(p); }
  for (const o of bots) {
    if (o === bot) continue;
    for (const p of o.body) { const dx = p.x - h.x, dy = p.y - h.y; if (dx * dx + dy * dy < r2) out.push(p); }
  }
  return out;
}

// 收集威胁点:各蛇头沿当前航向的预测位置(有护盾的一方撞不死 AI,跳过不设威胁)
function predictedDangers(bot) {
  const out = [];
  const push = (x, y) => { if (x > 1 && x < arena.w - 1 && y > 1 && y < arena.h - 1) out.push({ x, y }); };
  if (playerShield <= 0) {
    const ph = snake[0];
    const pSpeed = boosting && !boostLock && energy > 0 ? difficultyConfig[difficulty].boost : .48; // 玩家加速时威胁延伸更远
    push(ph.x + direction.x * pSpeed * 2, ph.y + direction.y * pSpeed * 2);
    push(ph.x + direction.x * pSpeed * 4, ph.y + direction.y * pSpeed * 4);
  }
  for (const o of bots) {
    if (o === bot || o.shield > 0) continue;
    const b = o.body[0];
    push(b.x + Math.cos(o.angle), b.y + Math.sin(o.angle));
  }
  return out;
}

// 目标选择:食物/残骸/截击点按"价值÷距离"择优,落在威胁圈附近的目标降权
function chooseGoal(bot, dangers) {
  const h = bot.body[0];
  let best = null, bestScore = 0;
  const consider = (x, y, value) => {
    let s = value / (Math.hypot(x - h.x, y - h.y) + .001);
    for (const g of dangers) { if (dist2(x - g.x, y - g.y) < 9) { s *= .45; break; } }
    if (s > bestScore) { bestScore = s; best = { x, y }; }
  };
  for (const f of foods) consider(f.x, f.y, f.star ? 95 : 30); // 星星价值更高
  for (const r of remains) consider(r.x, r.y, 16);              // 残骸次之,顺手扫食
  // 高侵略性 AI 且玩家无护盾:预判玩家前进路线,把身体横在玩家前方(截击)
  if (bot.aggro > .7 && playerShield <= 0 && difficultyConfig[difficulty].iq >= 1) {
    const ph = snake[0], cx = ph.x + direction.x * 5, cy = ph.y + direction.y * 5;
    if (dist2(cx - h.x, cy - h.y) < 100) consider(cx, cy, 55);
  }
  return best;
}

// 前瞻模拟:按实际转向速率画弧线前进(而非直线射线),返回能存活的步数,轨迹写入 path 复用
function simulateBotPath(bot, targetAngle, obstacles, path) {
  const h = bot.body[0];
  let x = h.x, y = h.y, a = bot.angle, alive = 0;
  for (let i = 0; i < path.length; i++) {
    a = normAngle(a + clamp(angleDiff(targetAngle, a), -BOT_TURN_RATE, BOT_TURN_RATE));
    x += Math.cos(a) * BOT_SPEED;
    y += Math.sin(a) * BOT_SPEED;
    if (x < .62 || x > arena.w - .62 || y < .62 || y > arena.h - .62) break;
    let hit = false;
    for (const p of obstacles) { const dx = x - p.x, dy = y - p.y; if (dx * dx + dy * dy < .37) { hit = true; break; } } // 碰撞半径略放大留安全余量
    if (hit) break;
    path[i].x = x; path[i].y = y; alive++;
  }
  return alive;
}

// 决策主逻辑:对每个候选航向做前瞻模拟,综合"存活 + 威胁规避 + 目标接近 + 惯性"打分
function botSteer(bot) {
  const h = bot.body[0];
  const iq = difficultyConfig[difficulty].iq;
  const look = clamp(Math.round(9 * iq), 5, 12);        // 难度越高看得越远
  const obstacles = nearbyObstacles(bot, look * BOT_SPEED + 4);
  const dangers = predictedDangers(bot);
  const goal = chooseGoal(bot, dangers);
  const path = Array.from({ length: look }, () => ({ x: 0, y: 0 }));
  let best = bot.angle, bestAlive = 0, bestScore = -1e9;
  for (const o of BOT_STEER_OFFSETS) {
    const a = normAngle(bot.angle + o);
    const alive = simulateBotPath(bot, a, obstacles, path);
    if (!alive) continue;
    let s = alive * alive * .3 - (look - alive) * 3.5;   // 生存永远第一:早死一步重罚
    s -= Math.abs(o) * bot.inertia;                     // 少转弯,保持游动惯性
    for (let i = 0; i < alive; i++) {                   // 轨迹越早贴近预测蛇头,罚分越重
      for (const g of dangers) {
        const q = 6.25 - dist2(path[i].x - g.x, path[i].y - g.y); // 半径 2.5 的威胁圈
        if (q > 0) s -= q * (1 - i / look) * .35 * bot.caution * iq;
      }
    }
    if (goal) {                                         // 靠近目标加分(距离封顶防近距离爆分)
      const d0 = Math.max(Math.hypot(goal.x - h.x, goal.y - h.y), 2);
      const d1 = Math.max(Math.hypot(goal.x - path[alive - 1].x, goal.y - path[alive - 1].y), 2);
      s += (1 / d1 - 1 / d0) * 40 * bot.greed * (.55 + .45 * iq);
    }
    s += (Math.random() - .5) * (1.8 - iq);             // 低难度 AI 会"手抖"
    if (s > bestScore) { bestScore = s; best = a; bestAlive = alive; }
  }
  if (bestAlive < 3) {                                  // 陷入重围:全周扫描选活路最长的方向(替代随机掉头)
    for (let k = 1; k <= 14; k++) {
      const a = normAngle(bot.angle + (k / 14) * Math.PI * 2);
      const alive = simulateBotPath(bot, a, obstacles, path);
      if (alive > bestAlive) { bestAlive = alive; best = a; }
    }
  }
  bot.targetAngle = best;
}
// AI 蛇死亡:化为尸体残留,若死于玩家则计一次击杀
function killBot(bot, byPlayer, text = '击杀!') {
  const h = bot.body[0];
  remains.push(...bot.body.map((part) => ({ ...part, color: bot.color })));
  bots.splice(bots.indexOf(bot), 1);
  burst(h.x, h.y, bot.color, 16);
  if (byPlayer) {
    kills++;
    popup(h.x, h.y, text, bot.color, 13);
    beep(240, .12, .035, 'sawtooth');
    shake = Math.max(shake, 5);
  }
}
function moveBot(bot) {
  if (bot.steerCd-- <= 0) { botSteer(bot); bot.steerCd = 1 + Math.floor(Math.random() * 2); }
  // 平滑转向:每步最多转 BOT_TURN_RATE 弧度,形成弧线游动
  const diff = angleDiff(bot.targetAngle, bot.angle);
  bot.angle = normAngle(bot.angle + clamp(diff, -BOT_TURN_RATE, BOT_TURN_RATE));
  const h = bot.body[0];
  const n = { x: h.x + Math.cos(bot.angle) * BOT_SPEED, y: h.y + Math.sin(bot.angle) * BOT_SPEED };
  const hitWall = n.x < .5 || n.x > arena.w - .5 || n.y < .5 || n.y > arena.h - .5;
  const hitPlayer = snake.some((p) => dist(n, p) < .6);
  let hitBot = null; // 撞到的其他 AI 蛇
  for (const o of bots) if (o !== bot && o.body.some((p) => dist(n, p) < .55)) { hitBot = o; break; }
  if (hitWall || hitPlayer || hitBot) {
    // 碰撞规则:任一方有护盾则相安无事;双方都无护盾时,撞击方(AI)死亡、被撞方存活
    const harmless = bot.shield > 0 || (!hitWall && ((hitPlayer && playerShield > 0) || (hitBot && hitBot.shield > 0)));
    if (harmless) { // 护盾:朝更开阔的一侧急转绕行,双方相安无事(随机转向容易转进墙)
      bot.steerCd = 0;
      const left = rayClear(h, bot.angle - 1.5, bot);
      const right = rayClear(h, bot.angle + 1.5, bot);
      bot.targetAngle = normAngle(bot.angle + (left >= right ? -1 : 1) * (1.1 + Math.random() * .5));
      return;
    }
    killBot(bot, hitPlayer); // 无护盾对撞:AI 死亡变尸体,撞玩家蛇身则计一次击杀
    return;
  }
  bot.body.unshift(n);
  // 进食:与玩家争夺场上食物
  for (let i = foods.length - 1; i >= 0; i--) {
    const f = foods[i];
    if (dist2(n.x - f.x, n.y - f.y) < .4) {
      foods.splice(i, 1); foods.push(makeFood());
      bot.score += f.star ? 35 : 10;
      bot.growth = Math.min(bot.growth + (f.star ? 4 : 1), 12);
      burst(f.x, f.y, bot.color, 6);
    }
  }
  // 吞食残骸(击杀后的战利品争夺)
  remains = remains.filter((part) => {
    if (dist2(n.x - part.x, n.y - part.y) < .4) {
      bot.score += 4;
      bot.growth = Math.min(bot.growth + 1, 12);
      burst(part.x, part.y, bot.color, 4);
      return false;
    }
    return true;
  });
  // 成长:有剩余成长值时保留尾节(身体变长),达到上限后不再生长
  if (bot.growth > 0 && bot.body.length < BOT_GROW_CAP) bot.growth--;
  else bot.body.pop();
}

// ===== 特效 =====
function burst(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2, speed = 1.4 + Math.random() * 2.6, life = 380 + Math.random() * 320;
    sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, max: life, color });
  }
}
function popup(x, y, text, color, size = 12) {
  popups.push({ x, y, text, color, size, life: 900, max: 900 });
}
function updateEffects(delta) {
  const t = delta / 1000;
  sparks = sparks.filter((s) => { s.life -= delta; s.x += s.vx * t; s.y += s.vy * t; s.vx *= .985; s.vy *= .985; return s.life > 0; });
  popups = popups.filter((p) => (p.life -= delta) > 0);
}

// ===== UI 更新 =====
function renderBuffs() {
  if (!playerShield && !magnetTimer) { ui.buffBar.innerHTML = ''; return; }
  let html = '';
  if (playerShield > 0) html += `<div class="buff shield"><span>🛡</span><div class="buff-meter"><i style="width:${Math.round((playerShield / shieldTotal) * 100)}%"></i></div><b>${(playerShield / 1000).toFixed(1)}s</b></div>`;
  if (magnetTimer > 0) html += `<div class="buff magnet"><span>🧲</span><div class="buff-meter"><i style="width:${Math.round((magnetTimer / 7000) * 100)}%"></i></div><b>${(magnetTimer / 1000).toFixed(1)}s</b></div>`;
  ui.buffBar.innerHTML = html;
}
function updateUI() {
  const length = Math.floor(snake.length / 3);
  ui.score.textContent = String(score).padStart(4, '0');
  ui.length.textContent = length;
  ui.kills.textContent = kills;
  ui.best.textContent = best;
  const p = Math.min((length / 30) * 100, 100);
  ui.progress.style.width = p + '%';
  ui.challenge.textContent = `${length} / 30`;
  ui.energyFill.style.width = energy + '%';
  ui.energyMeter.classList.toggle('low', energy < 30);
  ui.boost.classList.toggle('depleted', boostLock);
  renderBuffs();
  const entries = [
    ...bots.map((b) => ({ name: b.name, color: b.color, score: b.score })),
    { name: '你', color: '#32e6d0', score: score + length * 10, mine: true },
  ].sort((a, b) => b.score - a.score);
  ui.rank.innerHTML = entries.slice(0, 6).map((r, i) =>
    `<div class="rank-item ${r.mine ? 'mine' : ''}"><span class="rank-num">${i + 1}</span><i class="rank-dot" style="background:${r.color}"></i><span class="rank-name">${r.name}</span><span class="rank-score">${r.score}</span></div>`
  ).join('');
}

// ===== 渲染 =====
function draw(time) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#06111e'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (shake > .3) { ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); shake *= .9; } else shake = 0;
  drawGrid();
  foods.forEach((f) => drawFood(f, time));
  powerUps.forEach((item) => drawPowerUp(item, time));
  remains.forEach(drawRemains);
  bots.forEach((bot) => drawBot(bot, time));
  if (snake) drawSnake(time);
  drawSparks();
  drawPopups();
  ctx.restore();
  drawVignette();
  if (deathFlash > 0) { ctx.fillStyle = `rgba(255,60,40,${Math.min(deathFlash / 650, 1) * .22})`; ctx.fillRect(0, 0, W, H); }
  drawRadar(time);
  if (countdown > 0) drawCountdown();
  else if (goFlash > 0) drawGo();
  if (paused) drawPause();
}
function drawGrid() {
  ctx.strokeStyle = 'rgba(89,171,202,.11)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += cell) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += cell) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  const glow = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 500);
  glow.addColorStop(0, 'rgba(21,89,112,.16)'); glow.addColorStop(1, 'rgba(2,8,15,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
}
function drawFood(f, time) {
  const x = f.x * cell, y = f.y * cell, r = 4 + Math.sin(time / 220 + f.pulse) * 1.5;
  ctx.save();
  ctx.shadowBlur = f.star ? 22 : 15;
  ctx.shadowColor = f.star ? '#ffe06b' : `hsl(${f.hue},100%,65%)`;
  ctx.fillStyle = f.star ? '#ffe06b' : `hsl(${f.hue},100%,68%)`;
  if (f.star) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? 3 : r + 2;
      const px = x + Math.cos(angle) * rad, py = y + Math.sin(angle) * rad;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,224,107,.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r + 5, time / 300, time / 300 + 2); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function drawPowerUp(item, time) {
  const x = item.x * cell, y = item.y * cell, bob = Math.sin(time / 180 + item.pulse) * 2;
  const color = item.type === 'magnet' ? '#ff687b' : '#79f3ff';
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.globalAlpha = .35 + Math.sin(time / 260 + item.pulse) * .15;
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 20; ctx.shadowColor = color; ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#07111e';
  ctx.font = "700 9px 'DM Sans',sans-serif";
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(item.type === 'magnet' ? '磁' : '盾', 0, .5);
  ctx.restore();
}
function drawRemains(part) {
  ctx.save();
  ctx.globalAlpha = .68;
  ctx.shadowBlur = 8; ctx.shadowColor = part.color;
  ctx.fillStyle = part.color;
  ctx.beginPath(); ctx.arc(part.x * cell, part.y * cell, 4.2, 0, 7); ctx.fill();
  ctx.restore();
}
// 蛇身通用绘制:描一条发光路径 + 头尾渐变渐细的圆点
function tracePath(points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x * cell, points[0].y * cell);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x * cell, points[i].y * cell);
}
function strokeGlowPath(points, color, width, blur, alpha) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = alpha;
  ctx.shadowBlur = blur; ctx.shadowColor = color;
  tracePath(points); ctx.stroke();
  ctx.restore();
}
function drawTaperedBody(points, headR, tailR, colorAt, alphaAt) {
  const n = points.length;
  for (let i = n - 1; i >= 0; i--) {
    const t = n > 1 ? i / (n - 1) : 0;
    const p = points[i];
    if (alphaAt) ctx.globalAlpha = alphaAt(t);
    ctx.fillStyle = colorAt(t);
    ctx.beginPath();
    ctx.arc(p.x * cell, p.y * cell, lerp(headR, tailR, t), 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawEyes(h, dir, r) {
  const ex = dir.x, ey = dir.y, px = -ey, py = ex;
  const cx = h.x * cell, cy = h.y * cell;
  for (const side of [-1, 1]) {
    const x = cx + ex * r * .45 + px * side * r * .52;
    const y = cy + ey * r * .45 + py * side * r * .52;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill();
    ctx.fillStyle = '#0a2530';
    ctx.beginPath(); ctx.arc(x + ex * 1.1, y + ey * 1.1, 1.3, 0, 7); ctx.fill();
  }
}
function smoothPoints(body, gap = .5) { // 在折点间插值,让 bot 蛇身连贯
  const out = [];
  for (let i = 0; i < body.length - 1; i++) {
    const a = body[i], b = body[i + 1];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.round(d / gap));
    for (let s = 0; s < steps; s++) out.push({ x: lerp(a.x, b.x, s / steps), y: lerp(a.y, b.y, s / steps) });
  }
  out.push(body[body.length - 1]);
  return out;
}
function drawBot(bot, time) {
  const shielded = bot.shield > 0;
  strokeGlowPath(bot.body, bot.color, 9, shielded ? 12 : 0, shielded ? .3 : .15);
  drawTaperedBody(smoothPoints(bot.body), 6.2, 3.2, () => bot.color, (t) => .38 + (1 - t) * .58);
  drawEyes(bot.body[0], { x: Math.cos(bot.angle), y: Math.sin(bot.angle) }, 6.2);
  if (shielded) {
    const h = bot.body[0];
    ctx.save();
    ctx.strokeStyle = 'rgba(123,239,255,.85)'; ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.arc(h.x * cell, h.y * cell, 12 + Math.sin(bot.shield / 170) * 2, 0, 7);
    ctx.stroke(); ctx.restore();
  }
}
function drawSnake(time) {
  const burning = boosting && !boostLock && energy > 0;
  strokeGlowPath(snake, burning ? '#ffd87a' : '#2de4d0', 10, burning ? 24 : 15, .3);
  drawTaperedBody(snake, 6.4, 3.4, (t) => bodyColor(Math.pow(t, .85)));
  // 头部高光
  const h = snake[0], hr = 7.2;
  ctx.save();
  ctx.shadowBlur = 18; ctx.shadowColor = burning ? '#ffd87a' : '#b8ff56';
  const hg = ctx.createRadialGradient(h.x * cell - 2, h.y * cell - 2, 1, h.x * cell, h.y * cell, hr);
  hg.addColorStop(0, '#e8ffa8'); hg.addColorStop(1, burning ? '#ffd87a' : '#9df05f');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(h.x * cell, h.y * cell, hr, 0, 7); ctx.fill();
  ctx.restore();
  drawEyes(h, direction, hr);
  // 护盾:覆盖全身的透明蓝色保护罩
  if (playerShield > 0) {
    const fade = playerShield < 1200 ? .45 + Math.abs(Math.sin(time / 90)) * .55 : 1; // 临期闪烁提醒
    const pulse = 1 + Math.sin(time / 130) * .04;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#79f3ff';
    // 罩体:半透明蓝膜包住整条蛇身
    ctx.globalAlpha = .2 * fade;
    ctx.lineWidth = 19 * pulse;
    ctx.shadowColor = '#79f3ff'; ctx.shadowBlur = 12;
    tracePath(snake); ctx.stroke();
    // 沿身流动的能量脉冲
    ctx.globalAlpha = .5 * fade;
    ctx.lineWidth = 17 * pulse;
    ctx.setLineDash([3, 24]); ctx.lineDashOffset = -time / 22;
    tracePath(snake); ctx.stroke();
    ctx.restore();
    // 头部护盾环
    ctx.save();
    ctx.strokeStyle = 'rgba(121,243,255,.9)'; ctx.lineWidth = 2;
    ctx.shadowBlur = 14; ctx.shadowColor = '#79f3ff';
    ctx.setLineDash([6, 5]); ctx.lineDashOffset = -time / 24;
    ctx.beginPath(); ctx.arc(h.x * cell, h.y * cell, 15 + Math.sin(time / 130) * 2, 0, 7);
    ctx.stroke(); ctx.restore();
  }
}
function drawSparks() {
  sparks.forEach((s) => {
    const a = Math.max(s.life / s.max, 0);
    ctx.globalAlpha = a; ctx.fillStyle = s.color;
    const size = 2 + a * 2.5;
    ctx.fillRect(s.x * cell - size / 2, s.y * cell - size / 2, size, size);
  });
  ctx.globalAlpha = 1;
}
function drawPopups() {
  popups.forEach((p) => {
    const t = 1 - p.life / p.max;
    ctx.globalAlpha = Math.min(1, p.life / 300);
    ctx.font = `700 ${p.size}px 'Barlow Condensed',sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(4,12,20,.8)';
    const x = p.x * cell, y = p.y * cell - 14 - t * 26;
    ctx.strokeText(p.text, x, y);
    ctx.fillStyle = p.color; ctx.fillText(p.text, x, y);
  });
  ctx.globalAlpha = 1;
}
let vignette = null;
function drawVignette() {
  if (!vignette) {
    vignette = ctx.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * .85);
    vignette.addColorStop(0, 'rgba(2,8,15,0)'); vignette.addColorStop(1, 'rgba(2,8,15,.5)');
  }
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
}
function drawCountdown() {
  const n = Math.ceil(countdown / 800), frac = (countdown % 800) / 800;
  ctx.save();
  ctx.fillStyle = 'rgba(3,10,18,.45)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = .35 + frac * .55;
  ctx.font = `700 ${Math.round(64 + (1 - frac) * 22)}px 'Barlow Condensed',sans-serif`;
  ctx.fillStyle = '#eafcff';
  ctx.shadowColor = '#32e6d0'; ctx.shadowBlur = 26;
  ctx.fillText(String(n), W / 2, H / 2);
  ctx.restore();
}
function drawGo() {
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = Math.min(goFlash / 500, 1);
  ctx.font = "700 64px 'Barlow Condensed',sans-serif";
  ctx.fillStyle = '#b8ff56';
  ctx.shadowColor = '#b8ff56'; ctx.shadowBlur = 24;
  ctx.fillText('GO!', W / 2, H / 2);
  ctx.restore();
}
function drawPause() {
  ctx.fillStyle = 'rgba(0,8,18,.6)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#eaf4ff';
  ctx.font = "700 38px 'Barlow Condensed',sans-serif";
  ctx.fillText('已暂停', W / 2, H / 2 - 12);
  ctx.fillStyle = '#8b9ab4';
  ctx.font = "500 13px 'DM Sans',sans-serif";
  ctx.fillText('按 空格 键继续', W / 2, H / 2 + 20);
}
function drawRadar(time) {
  mctx.fillStyle = '#06121e'; mctx.fillRect(0, 0, 132, 88);
  mctx.strokeStyle = 'rgba(84,207,205,.17)'; mctx.strokeRect(1, 1, 130, 86);
  // 扫描扇形
  const sweep = (time / 1500) % (Math.PI * 2);
  if (mctx.createConicGradient) {
    const grad = mctx.createConicGradient(sweep, 66, 44);
    grad.addColorStop(0, 'rgba(50,230,208,.20)');
    grad.addColorStop(.15, 'rgba(50,230,208,0)');
    grad.addColorStop(1, 'rgba(50,230,208,0)');
    mctx.fillStyle = grad;
    mctx.fillRect(2, 2, 128, 84);
  }
  mctx.strokeStyle = 'rgba(50,230,208,.5)';
  mctx.beginPath(); mctx.moveTo(66, 44); mctx.lineTo(66 + Math.cos(sweep) * 70, 44 + Math.sin(sweep) * 70); mctx.stroke();
  foods.forEach((f) => { mctx.fillStyle = '#bfff57'; mctx.fillRect((f.x / 60) * 132, (f.y / 40) * 88, 2, 2); });
  powerUps.forEach((item) => {
    mctx.save();
    mctx.translate((item.x / 60) * 132, (item.y / 40) * 88); mctx.rotate(Math.PI / 4);
    mctx.fillStyle = item.type === 'magnet' ? '#ff687b' : '#79f3ff';
    mctx.fillRect(-1.8, -1.8, 3.6, 3.6);
    mctx.restore();
  });
  bots.forEach((b) => { mctx.fillStyle = b.color; mctx.fillRect((b.body[0].x / 60) * 132, (b.body[0].y / 40) * 88, 4, 4); });
  if (snake) {
    mctx.fillStyle = '#32e6d0';
    mctx.beginPath();
    mctx.arc((snake[0].x / 60) * 132, (snake[0].y / 40) * 88, 2.6 + Math.sin(time / 170) * .8, 0, 7);
    mctx.fill();
  }
}

// ===== 输入 =====
function setDir(dir) {
  const size = Math.hypot(dir.x, dir.y);
  if (!size) return;
  const normalized = { x: dir.x / size, y: dir.y / size };
  if (normalized.x !== -direction.x || normalized.y !== -direction.y) { nextDirection = normalized; setKnob(normalized); }
}
function setKnob(dir) {
  if (!ui.knob) return;
  ui.knob.style.transform = `translate(${dir.x * 26}px, ${dir.y * 26}px)`;
}
function setBoost(active) {
  boosting = active;
  ui.boost.classList.toggle('active', active);
}
function setWheelDirection(event) {
  const rect = ui.wheel.getBoundingClientRect();
  setDir({ x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 });
}

// ===== 全屏控制 =====
const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
async function toggleFullscreen() {
  const root = document.documentElement;
  try {
    if (!fullscreenElement()) {
      if (root.requestFullscreen) await root.requestFullscreen();
      else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen(); // Safari
    } else if (document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); // Safari
  } catch { /* 全屏请求被拒绝时静默忽略 */ }
}
function syncFullscreenUI() {
  const active = !!fullscreenElement();
  document.body.classList.toggle('is-fullscreen', active);
  ui.fullscreen.classList.toggle('active', active);
  ui.fullscreen.setAttribute('aria-label', active ? '退出全屏' : '全屏游戏');
  ui.fullscreen.title = active ? '退出全屏 (F)' : '全屏游戏 (F)';
}

window.addEventListener('keydown', (e) => {
  const map = {
    ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
  };
  if (map[e.key]) { e.preventDefault(); setDir(map[e.key]); }
  if (e.key === 'Shift') setBoost(true);          // 修复:原先用 e.code==='Shift' 永远不匹配
  if (e.code === 'Space') { e.preventDefault(); togglePause(); }
  if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); toggleFullscreen(); }
});
window.addEventListener('keyup', (e) => { if (e.key === 'Shift') setBoost(false); });

ui.wheel.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.wheel-center')) { togglePause(); return; }
  wheelActive = true;
  ui.wheel.setPointerCapture(e.pointerId);
  setWheelDirection(e);
});
ui.wheel.addEventListener('pointermove', (e) => { if (wheelActive) setWheelDirection(e); });
['pointerup', 'pointercancel'].forEach((ev) => ui.wheel.addEventListener(ev, () => (wheelActive = false)));

['pointerdown', 'touchstart'].forEach((ev) => ui.boost.addEventListener(ev, (e) => { e.preventDefault(); setBoost(true); }));
['pointerup', 'pointerleave', 'pointercancel', 'touchend'].forEach((ev) => ui.boost.addEventListener(ev, () => setBoost(false)));

document.querySelectorAll('.difficulty').forEach((button) => button.addEventListener('click', () => {
  if (running) return;
  difficulty = button.dataset.difficulty;
  document.querySelectorAll('.difficulty').forEach((item) => item.classList.toggle('active', item === button));
  ui.difficultyBadge.textContent = difficultyConfig[difficulty].label;
  ui.resultStats.classList.add('hidden');
}));

ui.start.addEventListener('click', start);
ui.sound.addEventListener('click', () => {
  soundOn = !soundOn;
  ui.sound.classList.toggle('off', !soundOn);
  if (soundOn) { audio(); beep(660, .07, .04); }
});

// 全屏按钮:仅在浏览器支持 Fullscreen API 时启用(如 iPhone Safari 不支持则隐藏)
if (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) {
  ui.fullscreen.addEventListener('click', toggleFullscreen);
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => document.addEventListener(ev, syncFullscreenUI));
} else {
  ui.fullscreen.style.display = 'none';
}

// ===== 初始化 =====
reset();
draw(0);
