# OpenCode Harmony

> OpenCode Desktop 的鸿蒙（HarmonyOS / OpenHarmony）桌面版——基于 Electron-on-HarmonyOS 运行时。

> **非官方声明**：本工程并非由 OpenCode 团队构建，与 [opencode](https://github.com/anomalyco/opencode) 无任何隶属关系。

## 现状

**基础框架已搭建**：`electron`(entry) + `web_engine`(HAR) 模块 + 最小主进程（建窗 + 占位页），验证 Electron-on-HarmonyOS 运行时可用。尚未对接 opencode 服务端/渲染层。

## 目录结构

```
opencode-harmony/
├── AppScope/          # 应用 scope（bundle com.huawei.ohos_electron，复用 ohos_electron 签名）
├── electron/          # 入口模块（copy 自 harmonypc-electron，含 Electron 37 SO）
├── web_engine/        # 桥接 HAR（ArkTS 桥接层 + resfile 承载 app 产物）
├── src-main/          # Electron 主进程源码（main.js + package.json）
├── scripts/           # 构建脚本
│   ├── collect-runtime.mjs  # copy ../harmonypc-electron 的 electron + web_engine + SO
│   └── collect-app.mjs      # copy src-main → web_engine/.../resfile/resources/app/
├── docs/              # 工程规划（docs/工程规划.md）
└── build-profile.json5
```

## 构建流程（真机验证通过）

```bash
# ① 收集运行时（解压 v37 zip → copy electron + web_engine + SO + 运行时资源）
node scripts/collect-runtime.mjs

# ② 收集应用产物（clean app/ + copy src-main）
node scripts/collect-app.mjs

# ③ 解析依赖（web_engine 依赖 inversify/reflect-metadata + electron 依赖 web_engine）
& "D:\oh-workspace\DevEco Studio\tools\ohpm\bin\ohpm.bat" install

# ④ 构建 + 签名（需 NODE_HOME + DEVECO_SDK_HOME）
$env:NODE_HOME = "D:\oh-workspace\DevEco Studio\tools\node"
$env:DEVECO_SDK_HOME = "D:\oh-workspace\DevEco Studio\sdk"
& "D:\oh-workspace\DevEco Studio\tools\hvigor\bin\hvigorw.bat" assembleHap --mode module -p product=default -p buildMode=debug --no-daemon

# ⑤ 安装 + 启动
hdc app install -r electron/build/default/outputs/default/electron-default-signed.hap
hdc shell aa start -a EntryAbility -b com.huawei.ohos_electron

# ⑥ 首次启动会弹「网络权限」授权框，点「允许」后窗口显示占位页
```

> 运行时：Electron 37 / Node 22.17.0（见 docs/工程规划.md §3.3 选型）。
> 关键坑：harmonypc-electron 仓库不含 Electron 37 完整运行时资源，必须从 v37 zip 解压（collect-runtime 已自动化）。

## 下一步

对接 opencode：自建 esbuild 打包 `@opencode-ai/server`+`core` 为 Node bundle（进程内 Host），复用 SolidJS 渲染层（`@opencode-ai/app`+`ui`，写 web shim），`loadURL(局域网 IP)` 加载。详见 docs/工程规划.md。
