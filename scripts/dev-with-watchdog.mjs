#!/usr/bin/env node
// Run `next dev` under a watchdog that kills the whole process tree if the node
// process count runs away.
//
// Next 16.2.4's dev server has been spawning ~1,650 child node processes in a
// burst (6,400 open fds on the parent, 3,400-4,200 on each child). That is 64 GB
// of demand on a 16 GB machine, 9.2 GB of it wired and therefore unreclaimable,
// which ends in either "system has run out of application memory" or a
// `watchdog timeout: no checkins from watchdogd` kernel panic.
//
// This does not fix the underlying spawn bug — it caps the blast radius.

import { spawn, execSync } from 'node:child_process'

// With the Turbopack root pinned correctly, a healthy `next dev` here runs a handful
// of node processes. A runaway climbs at roughly 30/second and does not plateau, so
// the check has to be frequent and the ceiling low: 1,650 workers at ~38 MB each is
// what took the machine down. 60 leaves generous headroom over healthy while still
// tripping about two seconds into a runaway.
const THRESHOLD = Number(process.env.DEV_WATCHDOG_MAX ?? 60)
const INTERVAL_MS = 2_000

const child = spawn('npx', ['next', 'dev'], {
  stdio: 'inherit',
  detached: true, // own process group, so the whole tree is killable
})

function nodeProcessCount() {
  try {
    const out = execSync(`pgrep -U ${process.getuid()} -x node`, { encoding: 'utf8' })
    return out.trim().split('\n').filter(Boolean).length
  } catch {
    return 0 // pgrep exits 1 when nothing matches
  }
}

function killTree(signal) {
  try {
    process.kill(-child.pid, signal)
  } catch {
    // group already gone
  }
}

const timer = setInterval(() => {
  const count = nodeProcessCount()
  if (count <= THRESHOLD) return

  clearInterval(timer)
  console.error(
    `\n[dev-watchdog] ${count} node processes (threshold ${THRESHOLD}) — runaway detected, killing dev server tree`,
  )
  killTree('SIGKILL')
  process.exit(1)
}, INTERVAL_MS)

function shutdown(signal) {
  clearInterval(timer)
  killTree('SIGTERM')
  process.exit(signal === 'SIGINT' ? 130 : 0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

child.on('exit', (code) => {
  clearInterval(timer)
  process.exit(code ?? 0)
})
