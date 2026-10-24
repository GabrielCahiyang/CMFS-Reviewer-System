import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export async function verifyBuildTraces(distDir = fileURLToPath(new URL('../.next-vercel/', import.meta.url))) {
  let traces = 0, checked = 0
  const missing = []
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.name.endsWith('.nft.json')) {
        traces++
        const trace = JSON.parse(await readFile(full, 'utf8'))
        for (const file of trace.files) {
          checked++
          try { await access(path.resolve(path.dirname(full), file)) }
          catch { missing.push(path.relative(distDir, path.resolve(path.dirname(full), file))) }
        }
      }
    }
  }
  await walk(path.join(distDir, 'server'))
  if (!traces) throw new Error('No production server traces were generated.')
  if (missing.length) throw new Error(`Production packaging has ${missing.length} missing traced files: ${missing.slice(0, 8).join(', ')}`)
  return { traces, checked }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await verifyBuildTraces()
  console.log(`Packaging check passed: ${result.checked} file references across ${result.traces} server traces.`)
}
