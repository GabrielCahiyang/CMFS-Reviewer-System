import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
const command = process.argv[2]
const payloadPackage = JSON.parse(readFileSync('node_modules/payload/package.json','utf8'))
const cli = command === 'build' ? `node_modules/payload/${payloadPackage.bin.payload}` : 'node_modules/next/dist/bin/next'
// Turbopack repeatedly invalidates its generated files in this local Windows
// checkout. Use Next's supported webpack development mode for stable HMR.
const args = command === 'dev' ? ['dev','--webpack','--port',process.env.PORT || '3000','--hostname','0.0.0.0'] : [command]
const child = spawn(process.execPath, ['--no-deprecation',cli,...args], { stdio: 'inherit', env: process.env })
child.on('exit',(code) => { process.exitCode = code ?? 1 })
child.on('error', () => { console.error('Could not start the framework CLI.'); process.exitCode = 1 })
