import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Next's custom page extensions select these entry points only for Vercel.
// They reuse the real app; no Payload-managed source is moved or changed.
const entries = [
  ['src/app/(frontend)/layout.vercel.tsx', "export { default, metadata } from './layout'\n"],
  ['src/app/(frontend)/page.vercel.tsx', "export { default } from './page'\n"],
  ['src/app/(frontend)/not-found.vercel.tsx', "export { default } from './not-found'\n"],
  ['src/app/(frontend)/error.vercel.tsx', "'use client'\nexport { default } from './error'\n"],
  ['src/app/(frontend)/[...slug]/page.vercel.tsx', "export { default, generateStaticParams } from './page'\nexport const dynamicParams = false\n"],
  ...['sessions', 'events', 'admin', 'account'].map(name => [
    `src/app/api/study/${name}/route.vercel.ts`,
    `export { ${['sessions', 'events'].includes(name) ? 'POST' : 'GET'} } from './route'\nexport const runtime = 'nodejs'\nexport const dynamic = 'force-dynamic'\n`,
  ]),
]

export async function prepareVercel() {
  const root = new URL('../', import.meta.url)
  for (const [name, content] of entries) {
    const target = new URL(name, root)
    const previous = await readFile(target, 'utf8').catch(error => {
      if (error.code !== 'ENOENT') throw error
      return ''
    })
    if (previous !== content) await writeFile(target, content)
  }
  return entries.map(([name]) => name)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = await prepareVercel()
  console.log(`Prepared ${files.length} Vercel entry points; Make/Payload source preserved.`)
}
