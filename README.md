# Snake Arena · 蛇域竞技场

**English** | **中文**

A neon-style 360° snake arena with smart AI opponents, a shared reinforcement-learning brain, power-ups, and an immersive player-follow camera.

## Run Locally

```bash
npm install
npm run dev
```

## Build

Multi-page build (arena / records / guide) via Vite:

```bash
npm run build
```

## Controls

- Drag the floating wheel (bottom-left of the arena) for 360° steering.
- `WASD` / arrow keys for directional movement.
- `Space` or the wheel center to pause.
- `F` or the topbar button to toggle fullscreen. Starting a round enters fullscreen automatically.

## Gameplay

- **Player camera**: the view follows your snake head with forward lead at 2x zoom — only your surroundings are visible; the radar (top-3 snakes only) is your sole global intel.
- **Food**: energy orbs (+10), drifting golden stars (+35, they move like power-ups do), and remains dropped by killed snakes (+4).
- **Power-ups**:
  - **Shield** (7s): snake-to-snake collisions pass through harmlessly when either side is shielded. Walls still kill — shields cannot save you there.
  - **Magnet** (7s): pulls foods, remains and drifting stars within radius toward you; anything outside the radius stays perfectly still. Power-ups are immune to the field.
- **Collision rules**: hitting a wall always kills (even with a shield); hitting another snake without shields kills the one that moved into the other.
- **AI snakes**: human-like bots — limited vision (they only see their own "screen"), reaction delay, target locking with chase-out-of-view persistence, panic reflexes on close threats, per-bot skill levels and personalities (greed / caution / inertia / aggression), plus lookahead pathfinding and threat prediction. They hunt food, grow long, and burn body length when sprinting, same growth formula as the player.
- **Learning brain**: all AI snakes share an online reinforcement-learning brain (TD(0) with ε-greedy exploration) that keeps training during play and persists across sessions in `localStorage`.
- **Records & guide**: every battle is saved locally (last 50) on the records page; the guide page documents all mechanics.

## 中文

**English** | **中文**

霓虹风格的 360° 蛇竞技场：智能 AI 对手、共享强化学习大脑、道具系统与沉浸式玩家跟随视角。

## 本地运行

```bash
npm install
npm run dev
```

## 构建

基于 Vite 的多页面构建（竞技场 / 战绩榜 / 玩法指南）：

```bash
npm run build
```

## 操作

- 拖动竞技场左下角的悬浮轮盘，360° 自由转向。
- `WASD` / 方向键移动。
- `Space` 或轮盘中心按钮暂停。
- `F` 或顶栏按钮切换全屏；点击「开始战斗 / 再来一局」会自动进入全屏。

## 玩法

- **玩家视角**：镜头以 2 倍缩放跟随蛇头并朝前进方向前探——只能看到周边战场；雷达（仅显示前三名）是唯一的全局情报。
- **食物**：能量块（+10 分）、漂移的金色星星（+35 分，漂移速度与道具一致）、击杀掉落的残骸（+4 分）。
- **道具**：
  - **护盾**（7 秒）：蛇对蛇相撞时任一方有护盾则无伤穿过；但撞墙必死，护盾无法幸免。
  - **磁力**（7 秒）：吸附半径内的食物、残骸和漂移星星；半径外的目标保持静止；护盾/磁铁道具不受磁场影响。
- **碰撞规则**：撞墙必死（护盾无效）；无护盾撞到其他蛇时，撞击方死亡。
- **AI 蛇**：拟人行为模型——有限视野（只看得到自己的"屏幕"）、反应延迟、目标锁定（盯上就追、追出视野不换）、贴脸威胁恐慌急转、个体熟练度与独立性格（贪食/谨慎/惯性/侵略），加上前瞻寻路与威胁预判；成长公式与玩家完全一致——会抢食、变长，冲刺时燃烧蛇身。
- **学习大脑**：全体 AI 共享在线强化学习大脑（TD(0) 时序差分 + ε-探索），对局中持续训练，学习记忆保存在浏览器 `localStorage` 中跨会话延续。
- **战绩与指南**：每局战绩自动保存（最近 50 条）至战绩榜页；玩法指南页收录全部机制说明。
