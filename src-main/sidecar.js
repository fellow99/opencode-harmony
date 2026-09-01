'use strict'
/**
 * OpenCode Harmony — sidecar（utility 进程）
 * 加载 opencode 服务端 bundle（userData/opencode-dist/node.js），Server.listen 绑 0.0.0.0。
 */
const { parentPort } = process
const { join } = require('node:path')
const { mkdirSync } = require('node:fs')
const os = require('node:os')
const { pathToFileURL } = require('node:url')

parentPort.on('message', async (e) => {
  if (!e.data) return
  if (e.data.type === 'start') {
    try {
      // 数据目录 + 临时目录映射到应用沙箱
      if (e.data.userDataPath) {
        process.env.XDG_STATE_HOME = e.data.userDataPath
        process.env.XDG_DATA_HOME = e.data.userDataPath
        process.env.XDG_CONFIG_HOME = e.data.userDataPath
        process.env.XDG_CACHE_HOME = e.data.userDataPath
        const tmpDir = join(e.data.userDataPath, 'tmp')
        try { mkdirSync(tmpDir, { recursive: true }) } catch (_) {}
        process.env.TMPDIR = tmpDir
        process.env.TEMP = tmpDir
        process.env.TMP = tmpDir
        // 强制 monkey-patch os.tmpdir（Electron-on-HarmonyOS 的 Node 可能不读 TMPDIR）
        os.tmpdir = () => tmpDir
      }
      // MVP runs without Basic Auth even when the parent process has this variable.
      delete process.env.OPENCODE_SERVER_PASSWORD
      // 不设 OPENCODE_DISABLE_EMBEDDED_WEB_UI → 启用内嵌 Web UI

      // Embedded asset imports resolve to relative files at request time.
      process.chdir(e.data.opencodeRoot)
      const nodeJs = pathToFileURL(join(e.data.opencodeRoot, 'node.js')).href
      const { Server } = await import(nodeJs)
      const listener = await Server.listen({ port: 0, hostname: '0.0.0.0' })
      globalThis.__listener = listener
      parentPort.postMessage({ type: 'ready', port: listener.port, url: listener.url.toString() })
    } catch (err) {
      const msg = String((err && err.message) || err)
      parentPort.postMessage({ type: 'error', message: msg })
      console.error('[sidecar] start failed:', err)
    }
  } else if (e.data.type === 'stop') {
    try { await globalThis.__listener?.stop() } catch (_) {}
    parentPort.postMessage({ type: 'stopped' })
    process.exit(0)
  }
})
