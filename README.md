# Snake Arena · 蛇域竞技场

**English** | **中文**

A neon-style 360° snake arena with smart AI opponents, a shared reinforcement-learning brain, power-ups, and an immersive player-follow camera. Fully playable on desktop and mobile (Android): touch joystick steering, haptic feedback, landscape layout, and install-to-home-screen.

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

## Native App Packages (Android APK)

The game is wrapped as a native app with [Capacitor](https://capacitorjs.com) (WebView shell): touch joystick, haptics (Android back button & vibration handled natively), landscape-locked, branded icons & splash screens.

```bash
npm run apk   # Android: signed release APK + debug APK
```

- **Android output**: `android/app/build/outputs/apk/release/app-release.apk` (also `debug/app-debug.apk`). Install directly on any Android 7.0+ phone (enable "install unknown apps").
- **Release signing**: self-signed keystore at `android/snake-arena-release.keystore` (alias `snakearena`, password in `android/keystore.properties`). Generate your own keystore before publishing to Google Play.
- **Prerequisites (once)**: JDK 21 (`brew install openjdk@21`) and Android SDK (`brew install --cask android-commandlinetools`, packages `platforms;android-36 build-tools;36.0.0 platform-tools`, `android/local.properties`).
- Gradle distribution is fetched from the Tencent mirror (`android/gradle/wrapper/gradle-wrapper.properties`) — swap back to `services.gradle.org` if you prefer.
- Rebuild flow after code changes: `npm run build` → `npx cap sync android` → package again.

## Controls

- Drag the floating wheel (bottom-left of the arena) for 360° steering.
- `WASD` / arrow keys for directional movement.
- `Space` or the topbar pause button (top-right) to pause.
- The home button (top-right) abandons the current round and returns to the start screen.
- `F` or the topbar button to toggle fullscreen. Starting a round enters fullscreen automatically.

## Mobile (Android)

- **Touch joystick**: press and drag anywhere on the battlefield — a virtual joystick appears right under your finger for 360° steering. Release to keep the current heading. The bottom-left wheel still works in parallel.
- **Haptics** (Android): short vibration on round start, power-up pickups, kills and death.
- **Landscape**: starting a round requests fullscreen and locks landscape; a rotate hint shows in portrait.
- **Auto-pause**: switching apps, incoming calls or locking the screen pauses the round automatically.
- **Safe areas & gestures**: notch insets respected, pinch/double-tap zoom disabled, long-press menus blocked on the canvas.
- **Install to home screen**: add the site to your home screen to launch it as a standalone fullscreen app (via Web App Manifest).
- To test on a real phone, expose the dev server on your LAN: `npm run dev -- --host`, then open the printed network URL on the device.

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

霓虹风格的 360° 蛇竞技场：智能 AI 对手、共享强化学习大脑、道具系统与沉浸式玩家跟随视角。桌面与手机（安卓）全平台可玩：触屏摇杆转向、震动反馈、横屏布局、可安装到主屏幕。

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

## 原生安装包打包（安卓 APK）

游戏通过 [Capacitor](https://capacitorjs.com) 封装为原生 App（WebView 壳）：触屏摇杆、震动反馈、安卓返回键原生处理、锁横屏、品牌图标与启动屏。

```bash
npm run apk   # 安卓：签名 release APK + debug APK
```

- **安卓产物**：`android/app/build/outputs/apk/release/app-release.apk`（另有 `debug/app-debug.apk`）。安卓 7.0+ 手机可直接安装（需开启「允许安装未知来源应用」）。
- **release 签名**：自签名证书位于 `android/snake-arena-release.keystore`（别名 `snakearena`，口令见 `android/keystore.properties`）。上架 Google Play 前请换成自己的正式证书。
- **环境准备（仅首次）**：JDK 21（`brew install openjdk@21`）、Android SDK（`brew install --cask android-commandlinetools` 后用 sdkmanager 安装 `platforms;android-36 build-tools;36.0.0 platform-tools`，路径已写入 `android/local.properties`）。
- Gradle 发行版已切换为腾讯镜像（`android/gradle/wrapper/gradle-wrapper.properties`），海外网络可改回官方源。
- 代码更新后重新打包：`npm run build` → `npx cap sync android` → 再次执行打包命令。

## 操作

- 拖动竞技场左下角的悬浮轮盘，360° 自由转向。
- `WASD` / 方向键移动。
- `Space` 或右上角暂停键暂停。
- 右上角返回主页面按钮：放弃当前对局，回到开始界面。
- `F` 或顶栏按钮切换全屏；点击「开始战斗 / 再来一局」会自动进入全屏。

## 移动端支持（安卓）

- **触屏摇杆**：按住战场任意位置拖动，虚拟摇杆即时出现在手指处，360° 自由转向；松手保持当前航向；左下角固定轮盘可并行使用。
- **震动反馈**（安卓）：开局、拾取道具、击杀、阵亡四类关键时刻短震动。
- **横屏**：开局自动请求全屏并锁定横屏；竖屏时显示「横屏体验更佳」提示。
- **自动暂停**：切后台、来电、锁屏时自动暂停，保护对局进度。
- **安全区与手势**：适配刘海屏；禁用双击/双指缩放、下拉刷新与画布长按菜单。
- **安装到主屏幕**：安卓通过「添加到主屏幕」可全屏横屏独立窗口运行（Web App Manifest）。
- 真机调试：`npm run dev -- --host` 暴露局域网地址后，手机连同一 Wi-Fi 访问即可。

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
