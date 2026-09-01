'use strict'
/**
 * OpenCode Harmony — Electron 主进程
 * 流式解压 opencode-dist.tar.gz → userData/opencode-dist，然后 utilityProcess.fork 拉 sidecar，
 * 就绪后 loadURL(局域网 IP) 加载内嵌 Web UI。
 */
const { app, BrowserWindow, utilityProcess } = require('electron')
const { createReadStream, existsSync, mkdirSync, openSync, writeSync, closeSync, readFileSync, rmSync } = require('node:fs')
const { createGunzip } = require('node:zlib')
const { join, dirname } = require('node:path')
const os = require('node:os')

let win
let sidecar

function pickReachableHost() {
  try {
    const ifaces = os.networkInterfaces()
    for (const name of Object.keys(ifaces)) {
      for (const info of ifaces[name] || []) {
        if (info.family === 'IPv4' && !info.internal && info.address) return info.address
      }
    }
  } catch (_) {}
  return '127.0.0.1'
}

function showText(html) {
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
    '<!doctype html><html><body style="font-family:monospace;font-size:13px;white-space:pre-wrap;padding:12px">' +
    html.replace(/&/g, '&amp;').replace(/</g, '&lt;') +
    '</body></html>'
  ))
}

function extractTarGz(archivePath, destBase) {
  return new Promise((resolve, reject) => {
    const gunzip = createGunzip()
    const input = createReadStream(archivePath)
    let buf = Buffer.alloc(0)
    let offset = 0
    let count = 0
    let ended = false
    const process = () => {
      while (!ended && buf.length - offset >= 512) {
        const header = buf.subarray(offset, offset + 512)
        if (header[0] === 0) { ended = true; break }
        const name = header.subarray(0, 100).toString('utf8').replace(/\0[\s\S]*$/, '')
        const prefix = header.subarray(345, 500).toString('utf8').replace(/\0[\s\S]*$/, '')
        const sizeStr = header.subarray(124, 136).toString('utf8').replace(/\0[\s\S]*$/, '').trim()
        const size = parseInt(sizeStr, 8) || 0
        const typeflag = String.fromCharCode(header[156])
        let fullName = prefix ? prefix + '/' + name : name
        fullName = fullName.replace(/^\.\//, '')
        const dataStart = offset + 512
        const paddedEnd = dataStart + Math.ceil(size / 512) * 512
        if (buf.length < paddedEnd) break
        if (fullName && !fullName.endsWith('/')) {
          const destPath = join(destBase, fullName)
          if (typeflag === '5') {
            mkdirSync(destPath, { recursive: true })
          } else if (typeflag === '0' || typeflag === '\u0000' || typeflag === '') {
            mkdirSync(dirname(destPath), { recursive: true })
            const fd = openSync(destPath, 'w')
            writeSync(fd, buf, dataStart, size)
            closeSync(fd)
            count++
          }
        }
        offset = paddedEnd
      }
      if (offset > 0) { buf = Buffer.from(buf.subarray(offset)); offset = 0 }
    }
    gunzip.on('data', (chunk) => { buf = buf.length === 0 ? chunk : Buffer.concat([buf, chunk]); process() })
    gunzip.on('end', () => resolve(count))
    gunzip.on('error', reject)
    input.on('error', reject)
    input.pipe(gunzip)
  })
}

app.whenReady().then(async () => {
  win = new BrowserWindow({ width: 1280, height: 860, title: 'OpenCode Harmony' })
  win.setWindowButtonVisibility(true)
  showText('正在解压 opencode 产物...')

  const userData = app.getPath('userData')
  const opencodeRoot = join(userData, 'opencode-dist')
  const archive = join(__dirname, 'opencode-dist.tar.gz')
  const archiveVersionPath = join(__dirname, 'opencode-dist.version')
  const marker = join(opencodeRoot, '.opencode-harmony-version')

  try {
    const expectedVersion = existsSync(archiveVersionPath)
      ? readFileSync(archiveVersionPath, 'utf8').trim()
      : ''
    const extractedVersion = existsSync(marker) ? readFileSync(marker, 'utf8').trim() : ''
    if (!expectedVersion || extractedVersion !== expectedVersion) {
      if (!existsSync(archive)) { showText('opencode-dist.tar.gz 缺失'); return }
      rmSync(opencodeRoot, { recursive: true, force: true })
      mkdirSync(opencodeRoot, { recursive: true })
      win.setTitle('OpenCode Harmony (extracting)')
      const n = await extractTarGz(archive, opencodeRoot)
      win.setTitle(`OpenCode Harmony (extracted ${n})`)
    }
  } catch (e) {
    showText('解压失败:\n' + (e && e.message))
    return
  }

  showText('正在启动 opencode 服务端...')
  const sidecarPath = join(__dirname, 'sidecar.js')
  sidecar = utilityProcess.fork(sidecarPath, [], { stdio: 'pipe' })

  sidecar.on('spawn', () => win.setTitle('OpenCode Harmony (sidecar spawn)'))
  sidecar.on('message', (m) => {
    if (!m) return
    if (m.type === 'ready') {
      const host = pickReachableHost()
      win.setTitle('OpenCode Harmony')
      win.loadURL(`http://${host}:${m.port}/`)
    } else if (m.type === 'error') {
      win.setTitle('OpenCode Harmony (ERROR)')
      showText('sidecar error:\n' + m.message)
    }
  })
  sidecar.on('exit', (code) => win.setTitle(`OpenCode Harmony (sidecar exit ${code})`))
  sidecar.stdout?.on('data', (d) => console.log('[sidecar]', d.toString()))
  sidecar.stderr?.on('data', (d) => console.log('[sidecar:err]', d.toString()))

  sidecar.postMessage({ type: 'start', userDataPath: userData, opencodeRoot })
})

app.on('before-quit', () => { try { sidecar?.postMessage({ type: 'stop' }) } catch (_) {} })
app.on('window-all-closed', () => app.quit())
