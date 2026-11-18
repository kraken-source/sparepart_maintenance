#!/usr/bin/env node
/**
 * Jalankan backend (Laravel) + frontend (Vite) sekaligus dalam satu terminal.
 *
 *   npm run dev                  → backend :8000 + frontend :5173
 *   npm run dev -- --schedule    → + scheduler pengingat jatuh tempo (php artisan schedule:work)
 *
 * PHP: pakai PHP_BIN bila diset; jika tidak, PHP terbaru di C:\laragon\bin\php; terakhir `php` di PATH.
 * Ctrl+C sekali menghentikan semuanya (termasuk proses anak, agar port tidak tertinggal terpakai).
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BACKEND = path.join(ROOT, 'backend')
const FRONTEND = path.join(ROOT, 'frontend')
const isWin = process.platform === 'win32'
const withSchedule = process.argv.includes('--schedule')

const color = { api: '\x1b[35m', web: '\x1b[36m', job: '\x1b[33m', err: '\x1b[31m', dim: '\x1b[2m', reset: '\x1b[0m' }
const say = (msg, c = 'dim') => console.log(`${color[c]}${msg}${color.reset}`)
const fail = (msg) => { say(`✖ ${msg}`, 'err'); process.exit(1) }

// ---------- PHP ----------
function findPhp() {
  if (process.env.PHP_BIN) return process.env.PHP_BIN
  const laragon = 'C:/laragon/bin/php'
  if (isWin && fs.existsSync(laragon)) {
    const versions = fs.readdirSync(laragon)
      .filter((d) => /^php-\d+\.\d+\.\d+/.test(d) && fs.existsSync(path.join(laragon, d, 'php.exe')))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    if (versions.length) return path.join(laragon, versions[0], 'php.exe')
  }
  return 'php'
}
const php = findPhp()
const phpVersion = spawnSync(php, ['-r', 'echo PHP_VERSION;'], { encoding: 'utf8' })
if (phpVersion.error || phpVersion.status !== 0) fail(`PHP tidak ditemukan (${php}). Set PHP_BIN ke path php.exe.`)
const [major, minor] = phpVersion.stdout.split('.').map(Number)
if (major < 8 || (major === 8 && minor < 2)) fail(`Butuh PHP 8.2+, yang ditemukan ${phpVersion.stdout} (${php}). Set PHP_BIN ke PHP Laragon.`)

// ---------- Cek persiapan ----------
if (!fs.existsSync(path.join(BACKEND, 'vendor'))) fail('backend/vendor belum ada → jalankan `composer install` di folder backend.')
if (!fs.existsSync(path.join(BACKEND, '.env'))) fail('backend/.env belum ada → salin dari .env.example lalu `php artisan key:generate`.')
const viteBin = path.join(FRONTEND, 'node_modules', 'vite', 'bin', 'vite.js')
if (!fs.existsSync(viteBin)) fail('frontend/node_modules belum ada → jalankan `npm install` di folder frontend.')

const portFree = (port) => new Promise((resolve) => {
  const srv = net.createServer().once('error', () => resolve(false)).once('listening', () => srv.close(() => resolve(true)))
  srv.listen(port, '127.0.0.1')
})
for (const [port, what] of [[8000, 'backend'], [5173, 'frontend']]) {
  if (!(await portFree(port))) fail(`Port ${port} (${what}) sudah dipakai. Tutup server lama dulu (terminal lain / proses node/php yang tertinggal).`)
}

// ---------- Jalankan ----------
const procs = []
let stopping = false

function run(tag, cmd, args, cwd) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, FORCE_COLOR: '1' } })
  const prefix = `${color[tag]}[${tag}]${color.reset} `
  for (const stream of [child.stdout, child.stderr]) {
    let buf = ''
    stream.on('data', (chunk) => {
      buf += chunk
      const lines = buf.split(/\r?\n/)
      buf = lines.pop()
      for (const line of lines) if (line.trim()) process.stdout.write(prefix + line + '\n')
    })
  }
  child.on('exit', (code) => {
    if (stopping) return
    const reason = code === null || code > 255 ? 'dihentikan paksa' : `kode ${code}`
    say(`\n✖ ${tag} berhenti (${reason}), menghentikan yang lain…`, 'err')
    stopAll(1)
  })
  procs.push(child)
}

function killTree(child) {
  if (child.exitCode !== null || !child.pid) return
  // `php artisan serve` & Vite membuat proses anak; di Windows harus dimatikan satu pohon.
  if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else child.kill('SIGTERM')
}

function stopAll(code = 0) {
  if (stopping) return
  stopping = true
  procs.forEach(killTree)
  say('Semua server dihentikan.')
  process.exit(code)
}
process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))

say(`PHP ${phpVersion.stdout} → ${php}`)
run('api', php, ['artisan', 'serve', '--host=127.0.0.1', '--port=8000'], BACKEND)
run('web', process.execPath, [viteBin, '--port', '5173', '--strictPort'], FRONTEND)
if (withSchedule) run('job', php, ['artisan', 'schedule:work'], BACKEND)

console.log(`\n  Aplikasi: \x1b[1mhttp://localhost:5173\x1b[0m   ${color.dim}(API: http://127.0.0.1:8000 · Ctrl+C untuk berhenti)${color.reset}\n`)
