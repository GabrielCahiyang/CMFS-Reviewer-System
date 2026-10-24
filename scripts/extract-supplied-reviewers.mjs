import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
import path from 'node:path'
import {hash} from './lib/import-core.mjs'
const args=process.argv.slice(2).filter(a=>a!=='--'),index=args.indexOf('--source-dir')
if(index<0||!args[index+1])throw new Error('Usage: pnpm seed:extract -- --source-dir <private source folder>')
const sourceDir=path.resolve(args[index+1])
const python=process.env.CFMS_PYTHON||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
const manifest=JSON.parse(await readFile('scripts/source-manifest.json','utf8'))
await mkdir('seed-output/questions',{recursive:true})
const sources=[]
for(const source of manifest.sources)sources.push({...source,checksum:hash(await readFile(path.join(sourceDir,source.filename))),extractionReviewed:false})
await writeFile('seed-output/manifest.json',JSON.stringify({importId:`import-${hash(sources).slice(0,24)}`,sources,reports:[]},null,2))
function run(binary,args){const result=spawnSync(binary,args,{stdio:'inherit'});if(result.status!==0)throw new Error('Source extraction/validation failed; no database changes were made.')}
run(python,['scripts/inspect-source-files.py',sourceDir])
run(python,['scripts/read-highlight-keys.py',sourceDir])
run(python,['scripts/normalize-reviewer-sources.py'])
run(process.execPath,['scripts/finalize-source-import.mjs'])
run(process.execPath,['scripts/validate-question-banks.mjs'])
