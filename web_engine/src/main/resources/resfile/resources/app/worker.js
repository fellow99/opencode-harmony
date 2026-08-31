'use strict'
// utility 进程测 better-sqlite3
process.parentPort.on('message', (e) => {
  if (e.data !== 'run') return
  try {
    const Database = require('better-sqlite3')
    const db = new Database(':memory:')
    db.exec('CREATE TABLE t(a INTEGER, b TEXT)')
    db.prepare('INSERT INTO t VALUES (?, ?)').run(42, 'hello')
    const rows = db.prepare('SELECT * FROM t').all()
    db.close()
    process.parentPort.postMessage({ type: 'sqliteResult', text: `OK rows=${rows.length} first=${JSON.stringify(rows[0])}` })
  } catch (err) {
    process.parentPort.postMessage({ type: 'sqliteResult', text: 'FAIL ' + err.message })
  }
})
