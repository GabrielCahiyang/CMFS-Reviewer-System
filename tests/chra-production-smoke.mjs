import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { cert, initializeApp, deleteApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'
import { validatedFiles } from '../scripts/lib/seed-files.mjs'
import { hash } from '../scripts/lib/import-core.mjs'
import { parseCategories } from '../src/lib/question-schema.ts'

const args=process.argv.slice(2), index=args.indexOf('--credential-file')
assert.ok(index>=0 && args[index+1] && args.includes('--confirm-live-test'))
process.loadEnvFile('.env')
const privateJSON=await readFile(args[index+1],'utf8'), credential=JSON.parse(privateJSON)
assert.equal(credential.project_id,'attendit-350c6')
const app=initializeApp({credential:cert(credential), projectId:credential.project_id,
  databaseURL:process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL},'chra-production-smoke')
const auth=getAuth(app), db=getDatabase(app), origin='http://127.0.0.1:3100'
const uid=`cfms-chra-smoke-${randomUUID()}`, email=`${uid}@example.test`
const password=randomBytes(24).toString('base64url')+'Aa1!'
async function accounts() {
  const users=[];let token
  do {
    const page=await auth.listUsers(1000,token)
    users.push(...page.users.map(u=>({uid:u.uid,email:u.email??'',disabled:u.disabled,displayName:u.displayName??'',
      emailVerified:u.emailVerified,customClaims:u.customClaims??{},providerData:u.providerData,createdAt:u.metadata.creationTime})))
    token=page.pageToken
  } while(token)
  return {count:users.length,hash:hash(users.sort((a,b)=>a.uid.localeCompare(b.uid)))}
}
const beforeAccounts=await accounts(), beforeUsers=hash((await db.ref('cfms/users').get()).val())
let server, created=false
try {
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3100','--hostname','127.0.0.1'],{
    stdio:'ignore',env:{...process.env,NODE_ENV:'production',CFMS_BUILD_TARGET:'vercel',
      NODE_OPTIONS:'--no-experimental-require-module',FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON:privateJSON}})
  server.on('error',()=>{})
  let ready=false
  for(let i=0;i<60;i++) {
    assert.equal(server.exitCode,null,'Temporary production server failed to start.')
    try {if((await fetch(origin+'/api/study/account')).status===401){ready=true;break}}catch{}
    await delay(500)
  }
  assert.equal(ready,true)
  const prerender=JSON.parse(await readFile('.next-vercel/prerender-manifest.json','utf8'))
  const routes=Object.keys(prerender.routes).filter(r=>!r.startsWith('/_')),assets=new Set()
  for(const route of routes) {
    const response=await fetch(origin+route);assert.equal(response.status,200,route)
    const html=await response.text();assert.match(html,/CFMS/)
    for(const [,path] of html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))(?:\?[^"#]*)?"/g))
      if(path.startsWith('/_next/'))assets.add(path)
  }
  for(const asset of assets)assert.equal((await fetch(origin+asset)).status,200,asset)
  const files=await validatedFiles({directory:'seed-output/chra-2026-10-28',sourceManifest:'scripts/chra-source-manifest.json'})
  const catalog=parseCategories((await db.ref('cfms/categories').get()).val())
  assert.equal(catalog.length,10)
  for(const id of Object.keys(files.banks)) {
    assert.equal((await fetch(origin+`/categories/${id}`)).status,200,id)
    assert.equal(hash((await db.ref(`cfms/questions/${id}`).get()).val()),hash(files.banks[id]))
  }
  await auth.createUser({uid,email,password,displayName:'Disposable CHRA verification'})
  created=true
  await auth.setCustomUserClaims(uid,{cfmsTest:true})
  const login=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})})
  const {idToken}=await login.json();assert.ok(idToken)
  async function save(body) {
    const response=await fetch(origin+'/api/study/sessions',{method:'POST',headers:{Authorization:`Bearer ${idToken}`,'Content-Type':'application/json'},
      body:JSON.stringify(body),signal:AbortSignal.timeout(30000)})
    const result=await response.json();assert.equal(response.status,200,result.error||'Session operation failed.')
    return result.session
  }
  const results=[]
  for(const [categoryId,bank] of Object.entries(files.banks)) {
    const questionIds=Object.keys(bank),count=questionIds.length
    const started=await save({id:`chra-${randomUUID()}`,categoryId,mode:'exam',contentVersion:files.categories[categoryId].contentVersion,
      settings:{mode:'exam',types:['multiple-choice'],questionFormat:'original',count,randomize:false,shuffleChoices:false,
        instantFeedback:false,showExplanations:true,timer:false,durationMinutes:20,filter:'all'},
      questionIds,currentQuestionIndex:0,answers:{},status:'in-progress',startedAt:1,updatedAt:1,revision:1})
    const answers=Object.fromEntries(questionIds.map(id=>[id,{value:bank[id].correctAnswer,status:'pending',credit:0,graded:false}]))
    const saved=await save({...started,answers,currentQuestionIndex:count-1,revision:2})
    const resumed=(await db.ref(`cfms/users/${uid}/sessions/${started.id}`).get()).val()
    assert.equal(resumed.revision,2);assert.equal(Object.keys(resumed.answers).length,count)
    const done=await save({...saved,status:'completed',revision:3,score:999})
    assert.equal(done.score,count)
    assert.equal(Object.values(done.answers).filter(a=>a.status==='correct').length,count)
    results.push({categoryId,questions:count,score:done.score,startedSavedResumedCompleted:true})
  }
  const exported=await fetch(origin+'/api/study/account',{headers:{Authorization:`Bearer ${idToken}`}})
  assert.equal(exported.status,200)
  assert.equal(Object.keys((await exported.json()).data.sessions).length,3)
  await db.ref(`cfms/users/${uid}`).remove();await auth.deleteUser(uid);created=false
  assert.deepEqual(await accounts(),beforeAccounts)
  assert.equal(hash((await db.ref('cfms/users').get()).val()),beforeUsers)
  const report={testedAt:new Date().toISOString(),scope:'Live Firebase with a local production build; hosted deployment is separate.',
    importId:files.importId,catalogEntriesVisible:catalog.length,categories:results,totalNewQuestions:300,
    publicRoutesVerified:routes.length,clientAssetsVerified:assets.size,exportedSessions:3,
    existingAccountsPreserved:beforeAccounts.count,existingUserRecordsUnchanged:true,disposableAccountRemoved:true}
  await writeFile('docs/verification/chra-production.json',JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report,null,2))
} finally {
  if(created) {
    assert.ok(uid.startsWith('cfms-chra-smoke-'))
    await db.ref(`cfms/users/${uid}`).remove();await auth.deleteUser(uid)
  }
  await deleteApp(app);server?.kill()
}
