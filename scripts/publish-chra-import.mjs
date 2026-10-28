import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { deleteApp } from 'firebase-admin/app'
import { trustedServices } from './lib/admin-client.mjs'
import { validatedFiles } from './lib/seed-files.mjs'
import { hash } from './lib/import-core.mjs'

if (!process.argv.includes('--confirm-live-import')) throw new Error('Explicit --confirm-live-import is required.')
const options = { directory: 'seed-output/chra-2026-10-28', sourceManifest: 'scripts/chra-source-manifest.json' }
const files = await validatedFiles(options)
const services = trustedServices(), run = promisify(execFile)
async function accounts() {
  const users = [];let token
  do {
    const page=await services.auth.listUsers(1000,token)
    users.push(...page.users.map(u=>({ uid:u.uid, email:u.email??'', displayName:u.displayName??'',
      disabled:u.disabled, emailVerified:u.emailVerified, customClaims:u.customClaims??{},
      providerData:u.providerData, createdAt:u.metadata.creationTime })))
    token=page.pageToken
  } while (token)
  return {count:users.length,hash:hash(users.sort((a,b)=>a.uid.localeCompare(b.uid)))}
}
function preserved(value) {
  const copy=structuredClone(value)
  for (const branch of ['categories','questions','questionBankVersions']) {
    for (const id of Object.keys(files.banks)) if(copy[branch]) delete copy[branch][id]
    if(copy[branch] && !Object.keys(copy[branch]).length) delete copy[branch]
  }
  if(copy.sourceImports) {
    delete copy.sourceImports[files.importId]
    if(!Object.keys(copy.sourceImports).length) delete copy.sourceImports
  }
  if(copy.admin && !Object.keys(copy.admin).length) delete copy.admin
  return hash(copy)
}
try {
  const base=services.database.ref('cfms')
  const before=(await base.get()).val(), beforeAccounts=await accounts()
  // Fail closed if an ID is already in use for different content.
  for(const id of Object.keys(files.banks)) {
    assert.ok(!before.categories?.[id] || hash(before.categories[id])===hash(files.categories[id]),`Existing category ${id} differs.`)
    assert.ok(!before.questions?.[id] || hash(before.questions[id])===hash(files.banks[id]),`Existing bank ${id} differs.`)
  }
  await mkdir('private-backups',{recursive:true})
  const backup=`private-backups/chra-before-${Date.now()}.json`
  await writeFile(backup,JSON.stringify({cfms:before,accountFingerprint:beforeAccounts},null,2),{flag:'wx'})
  const args=['scripts/seed-realtime-database.mjs','apply','--input-directory',options.directory,
    '--source-manifest',options.sourceManifest,'--confirm-import-id',files.importId]
  const applied=await run(process.execPath,args,{env:process.env,maxBuffer:1024*1024})
  console.log(applied.stdout.trim())
  const verified=await run(process.execPath,['scripts/seed-realtime-database.mjs','verify',...args.slice(2,6)],{env:process.env,maxBuffer:1024*1024})
  console.log(verified.stdout.trim())
  const after=(await base.get()).val()
  assert.equal(preserved(after),preserved(before),'An unrelated CFMS record changed during publication; inspect the private backup before reporting preservation.')
  assert.deepEqual(await accounts(),beforeAccounts,'Existing Auth accounts changed during publication.')
  const report={testedAt:new Date().toISOString(),importId:files.importId,
    newCategories:Object.fromEntries(Object.entries(files.banks).map(([id,bank])=>[id,Object.keys(bank).length])),
    totalCategories:Object.keys(after.categories).length,
    totalQuestions:Object.values(after.questions).reduce((n,bank)=>n+Object.keys(bank).length,0),
    existingCategoryCount:Object.keys(before.categories).length,
    existingAccountsPreserved:beforeAccounts.count,existingCfmsRecordsUnchanged:true,
    exactLiveReadBack:true,backup,scope:'Live database publication only; application deployment is separate.'}
  await writeFile('docs/verification/chra-import.json',JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report,null,2))
} finally { await deleteApp(services.app) }
