#!/usr/bin/env node
/**
 * 收集应用产物：把 src-main/（Electron 主进程源码）copy 到 web_engine 的 app/ 目录。
 *
 * 基础框架阶段仅 copy main.js + package.json（占位页）；后续「对接 opencode」阶段扩展为
 * collect-opencode.mjs，把 opencode 服务端 bundle + 渲染层 dist 一并收集进 app/。
 *
 * 用法：node scripts/collect-app.mjs（需先运行 collect-runtime.mjs）
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const appDir = resolve(root, 'web_engine/src/main/resources/resfile/resources/app');

if (!existsSync(appDir)) {
  console.error('[collect-app] web_engine 未就绪，请先运行 collect-runtime.mjs');
  process.exit(1);
}
mkdirSync(appDir, { recursive: true });

// 清理 app/（移除 collect-runtime 带入的 demo 残留 + 旧产物）
for (const f of readdirSync(appDir)) {
  rmSync(resolve(appDir, f), { recursive: true, force: true });
}

// copy src-main/ 下所有文件到 app/
for (const f of readdirSync(resolve(root, 'src-main'))) {
  cpSync(resolve(root, 'src-main', f), resolve(appDir, f), { recursive: true, force: true });
  console.log(`[collect-app] src-main/${f} -> app/${f}`);
}
console.log('[collect-app] 完成');
