#!/usr/bin/env node
/**
 * 收集 Electron-on-鸿蒙 运行时（Electron 37）：
 * 从 ../harmonypc-electron 的 v37 产物 zip 解压出 libelectron/ohos_hap/，
 * copy electron + web_engine 模块（含原生 SO + 运行时资源 resfile）到本工程。
 *
 * 用法：node scripts/collect-runtime.mjs
 * 前置：../harmonypc-electron/ 下存在 v37.2.3-*.zip（Electron 37 产物，含
 *       libelectron_138.tar.gz → libelectron/ohos_hap/{electron,web_engine}）。
 * 后续：node scripts/collect-app.mjs → ohpm install → hvigor 构建。
 *
 * 说明：harmonypc-electron 的 ohos_hap 仓库不含完整 Electron 37 运行时资源
 * （v8_context_snapshot.bin / resources.pak / icudtl.dat / locales / vulkan 等
 *  及新版 electron 模块 ets），必须从 v37 zip 解压 copy，否则应用启动即崩。
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const hpRoot = resolve(root, '../harmonypc-electron');

// ① 定位 v37 产物 zip
const zip = readdirSync(hpRoot).find((f) => /^v37\.2\.3-.*\.zip$/.test(f));
if (!zip) {
  console.error(`[collect-runtime] 未找到 v37.2.3-*.zip 于 ${hpRoot}`);
  process.exit(1);
}
const zipPath = join(hpRoot, zip);

// ② 解压 zip → libelectron_138.tar.gz → libelectron/ohos_hap/
const tmp = resolve(root, '.runtime-tmp');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
console.log(`[collect-runtime] 解压 ${zip}`);
execSync(`tar -xf "${zipPath}" -C "${tmp}"`, { stdio: 'inherit' });
const tgz = readdirSync(tmp).find((f) => f.endsWith('.tar.gz'));
if (!tgz) {
  console.error('[collect-runtime] zip 内未找到 *.tar.gz');
  process.exit(1);
}
execSync(`tar -xzf "${join(tmp, tgz)}" -C "${tmp}"`, { stdio: 'inherit' });
const ohosHap = join(tmp, 'libelectron', 'ohos_hap');

// ③ 校验 SO
const soDir = join(ohosHap, 'electron/libs/arm64-v8a');
for (const so of ['libelectron.so', 'libadapter.so', 'libffmpeg.so']) {
  if (!existsSync(join(soDir, so))) {
    console.error(`[collect-runtime] 缺失 SO: ${so}`);
    process.exit(1);
  }
}

// ④ copy electron + web_engine 模块（含 SO + resfile 运行时资源）
for (const name of ['electron', 'web_engine']) {
  const src = join(ohosHap, name);
  const dest = resolve(root, name);
  if (!existsSync(join(src, 'oh-package.json5'))) {
    console.error(`[collect-runtime] 模块缺失: ${src}`);
    process.exit(1);
  }
  cpSync(src, dest, { recursive: true, force: true });
  console.log(`[collect-runtime] copy ${name} -> ${dest}`);
}

rmSync(tmp, { recursive: true, force: true });
console.log('[collect-runtime] 完成：electron + web_engine（含 SO + 运行时资源）已就绪');
