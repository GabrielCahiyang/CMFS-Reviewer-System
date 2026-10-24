import { readFile, mkdir, writeFile } from 'node:fs/promises'
const source = await readFile('src/app/(frontend)/[...slug]/page.tsx','utf8')
const routes = ['/',...Array.from(source.match(/const pages = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g),(m) => '/'+m[1])]
const origin = process.env.CFMS_PREVIEW_ORIGIN || `http://localhost:${process.env.PORT || '3000'}`
const results = []
for (let i=0;i<routes.length;i+=4) {
  results.push(...await Promise.all(routes.slice(i,i+4).map(async (route) => {
    try { const response=await fetch(origin+route,{signal:AbortSignal.timeout(60000)}); const html=await response.text(); return {route,status:response.status,ok:response.ok && !html.includes('NEXT_REDIRECT;') && !html.includes('Internal Server Error')} }
    catch { return {route,status:0,ok:false} }
  })))
}
await mkdir('docs/verification',{recursive:true})
await writeFile('docs/verification/preview-routes.json',JSON.stringify({origin,checkedAt:new Date().toISOString(),scope:'Development HTTP rendering. Authenticated browser workflows tested separately; this is not production delivery verification.',results},null,2))
results.forEach((r) => console.log(`${r.status} ${r.route}`))
if(results.some((r) => !r.ok)) process.exitCode=1
