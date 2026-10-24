import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { prepareVercel } from './prepare-vercel.mjs'
const command = process.argv[2]
const vercel = command.endsWith(':vercel') || process.env.VERCEL === '1'
const operation = command.replace(':vercel', '')
const env = { ...process.env, ...(vercel ? { CFMS_BUILD_TARGET: 'vercel' } : {}) }
if (vercel && operation === 'build') await prepareVercel()
let cli = 'node_modules/next/dist/bin/next'
if (operation === 'build' && !vercel) {
  const payloadPackage = JSON.parse(readFileSync('node_modules/payload/package.json','utf8'))
  cli = `node_modules/payload/${payloadPackage.bin.payload}`
}
// Turbopack repeatedly invalidates its generated files in this local Windows
// checkout. Use Next's supported webpack development mode for stable HMR.
const args = operation === 'dev'
  ? ['dev', '--webpack', '--port', process.env.PORT || '3000', '--hostname', '0.0.0.0']
  : operation === 'build' && vercel ? ['build', '--webpack']
  : operation === 'start' ? ['start', '--port', process.env.PORT || '3000', '--hostname', '0.0.0.0']
  : [operation]
const child = spawn(process.execPath, ['--no-deprecation',cli,...args], { stdio: 'inherit', env })
child.on('exit',(code) => { process.exitCode = code ?? 1 })
child.on('error', () => { console.error('Could not start the framework CLI.'); process.exitCode = 1 })
