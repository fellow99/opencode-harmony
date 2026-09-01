#!/usr/bin/env node
/**
 * 收集 opencode 产物到 app/：
 * ① src-main（main.js + sidecar.js + package.json）
 * ② dist/node + better-sqlite3 + stubs → 压缩为 opencode-dist.tar.gz（单文件，随运行时解压到 userData）
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const appDir = resolve(root, 'web_engine/src/main/resources/resfile/resources/app')
const opencodeDist = resolve(root, '../opencode/packages/opencode/dist/node')
const staging = resolve(root, '.opencode-staging')
const nodeBundle = resolve(opencodeDist, 'node.js')
const archiveVersion = `node-sha256:${createHash('sha256').update(readFileSync(nodeBundle)).digest('hex')}`

if (!existsSync(appDir)) {
  console.error('[collect-opencode] web_engine 未就绪，先跑 collect-runtime.mjs')
  process.exit(1)
}
mkdirSync(appDir, { recursive: true })

// ① clean app/（但保留 electron/libs 等 native 库，它们不在 app/ 里）
for (const f of readdirSync(appDir)) {
  rmSync(resolve(appDir, f), { recursive: true, force: true })
}

// ② copy src-main（main.js + sidecar.js + package.json，不含 node_modules）→ app/
for (const f of readdirSync(resolve(root, 'src-main'))) {
  if (f === 'node_modules') continue  // node_modules 打进 tar.gz
  cpSync(resolve(root, 'src-main', f), resolve(appDir, f), { recursive: true, force: true })
  console.log(`[collect-opencode] src-main/${f} -> app/${f}`)
}

// ③ 组装 staging：dist/node（排除 node_modules/test/package.json）+ src-main/node_modules（better-sqlite3 + stubs）
rmSync(staging, { recursive: true, force: true })
mkdirSync(staging, { recursive: true })
for (const f of readdirSync(opencodeDist)) {
  if (f === 'node_modules' || f === 'package.json' || f.startsWith('test-')) continue
  cpSync(resolve(opencodeDist, f), resolve(staging, f), { recursive: true, force: true })
}
cpSync(resolve(root, 'src-main/node_modules'), resolve(staging, 'node_modules'), { recursive: true, force: true })
await import('node:fs/promises').then(({ writeFile }) => writeFile(resolve(staging, '.opencode-harmony-version'), archiveVersion + '\n'))

// ④ 压缩 staging → app/opencode-dist.tar.gz
const tarGz = resolve(appDir, 'opencode-dist.tar.gz')
execSync(`tar -czf "${tarGz}" --format=ustar -C "${staging}" .`, { stdio: 'inherit' })
rmSync(staging, { recursive: true, force: true })
console.log('[collect-opencode] dist/node + node_modules -> app/opencode-dist.tar.gz')
await import('node:fs/promises').then(({ writeFile }) => writeFile(resolve(appDir, 'opencode-dist.version'), archiveVersion + '\n'))
console.log(`[collect-opencode] version -> app/opencode-dist.version (${archiveVersion})`)
console.log('[collect-opencode] 完成')
