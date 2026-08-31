'use strict'
/**
 * OpenCode Harmony — better-sqlite3 预编译成品真机验证
 * 主进程 + utility 进程都 require('better-sqlite3') 跑 CRUD。
 */
const { app, BrowserWindow, utilityProcess } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const results = []
let win
function add(s) { results.push(s); try { win.setTitle('SQL|' + results.slice(-6).join(' | ')) } catch (_) {} }

app.whenReady().then(async () => {
  win = new BrowserWindow({ width: 1280, height: 900, title: 'SQL-start' })
  win.setWindowButtonVisibility(true)

  // ① 主进程测 better-sqlite3
  testSqlite('main')

  // ② utility 进程测 better-sqlite3
  try {
    const child = utilityProcess.fork(path.join(__dirname, 'worker.js'), [], { stdio: 'pipe' })
    child.on('spawn', () => add('util spawn OK'))
    child.on('message', (m) => { if (m && m.type === 'sqliteResult') add('util: ' + m.text) })
    child.on('error', (e) => add('util err: ' + e.message))
    setTimeout(() => child.postMessage('run'), 2000)
  } catch (e) { add('fork THROW: ' + e.message) }

  await new Promise((r) => setTimeout(r, 15000))
  add('END')
})

function testSqlite(tag) {
  try {
    const Database = require('better-sqlite3')
    // 内存库
    const db = new Database(':memory:')
    db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER)')
    const ins = db.prepare('INSERT INTO users (name, age) VALUES (?, ?)')
    ins.run('张三', 25); ins.run('李四', 30)
    const rows = db.prepare('SELECT * FROM users').all()
    db.close()
    // 文件库（沙箱 userData）
    const fp = path.join(app.getPath('userData'), 'sqlite-test.db')
    const fdb = new Database(fp)
    fdb.exec('CREATE TABLE IF NOT EXISTS t(a TEXT)')
    fdb.prepare('INSERT INTO t VALUES (?)').run('file-ok')
    const fv = fdb.prepare('SELECT a FROM t').all()
    fdb.close()
    fs.unlinkSync(fp)
    add(`${tag}: OK mem[${rows.length}] file[${JSON.stringify(fv)}]`)
  } catch (e) {
    add(`${tag}: FAIL ${e.message}`)
  }
}

app.on('window-all-closed', () => app.quit())
