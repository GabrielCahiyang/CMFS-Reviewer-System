import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {trustedServices} from '../scripts/lib/admin-client.mjs'
import {validatedFiles} from '../scripts/lib/seed-files.mjs'
import {deleteApp} from 'firebase-admin/app'
import {mkdir,writeFile} from 'node:fs/promises'
import {canAutoGrade} from '../src/lib/study-models.ts'

if(!process.argv.includes('--confirm-project')||process.argv[process.argv.indexOf('--confirm-project')+1]!=='attendit-350c6')throw new Error('Explicit project confirmation required for a disposable live smoke account.')
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('This command is for the confirmed live project, not an emulator.')
const services=trustedServices(),uid=`cfms-smoke-${randomUUID()}`,email=`${uid}@example.test`,password=randomBytes(24).toString('base64url')+'Aa1!'
const origin=process.env.CFMS_PREVIEW_ORIGIN||'http://localhost:3000',results=[]
let created=false
async function call(path,token,body){const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));return j}
try{
 await services.auth.createUser({uid,email,password,displayName:'Disposable CFMS smoke test'});created=true
 const signIn=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})})
 const login=await signIn.json();assert.ok(login.idToken,'Live email/password sign-in failed.');const token=login.idToken
 results.push({test:'Live Firebase email/password authentication',passed:true})
 // Exercise the active live versions, including category-scoped additive imports.
 const files={
  categories:(await services.database.ref('cfms/categories').get()).val(),
  banks:(await services.database.ref('cfms/questions').get()).val(),
 }
 for(const [categoryId,bank]of Object.entries(files.banks)){
  const ids=Object.keys(bank),mode='exam',id=`smoke-${categoryId}`
  const session={id,categoryId,mode,contentVersion:files.categories[categoryId].contentVersion,
   settings:{mode,types:files.categories[categoryId].types,count:ids.length,randomize:false,shuffleChoices:false,instantFeedback:false,showExplanations:true,timer:false,durationMinutes:20,filter:'all'},questionIds:ids,currentQuestionIndex:0,answers:{},status:'in-progress',startedAt:1,updatedAt:1,revision:1}
  let current=(await call('/api/study/sessions',token,session)).session
  current=(await call('/api/study/sessions',token,{...current,revision:2,answers:Object.fromEntries(ids.map(id=>[id,{value:bank[id].type==='enumeration'?bank[id].correctAnswer:Array.isArray(bank[id].correctAnswer)?bank[id].correctAnswer[0]:bank[id].correctAnswer,status:'pending',credit:0,graded:false}]))})).session
  const completed=(await call('/api/study/sessions',token,{...current,revision:3,status:'completed'})).session
  assert.equal(completed.score,Object.values(bank).filter(canAutoGrade).length)
  results.push({test:`${categoryId}: start, save all ${ids.length} answers, resume, submit and score`,passed:true,questions:ids.length,score:completed.score})
 }
 const exported=await call('/api/study/account',token)
 assert.equal(exported.uid,uid);assert.equal(Object.keys(exported.data.sessions).length,6)
 results.push({test:'Authenticated export and all six persisted sessions',passed:true})
 const denied=await fetch(origin+'/api/study/admin?kind=overview',{headers:{Authorization:`Bearer ${token}`}})
 assert.equal(denied.status,403);results.push({test:'Student blocked from admin API',passed:true})
 const anonymous=await fetch(origin+'/api/study/account');assert.equal(anonymous.status,401)
 results.push({test:'Anonymous account export rejected',passed:true})
}catch(error){results.push({test:'Live workflow',passed:false,error:error.message});process.exitCode=1}
finally{
 if(created){
  // Cleanup is restricted to the unique account created by this invocation.
  assert.ok(uid.startsWith('cfms-smoke-'))
  await services.database.ref(`cfms/users/${uid}`).remove()
  await services.auth.deleteUser(uid)
  results.push({test:'Disposable live account and its study sessions removed',passed:true})
 }
 await deleteApp(services.app)
 await mkdir('docs/verification',{recursive:true})
 await writeFile('docs/verification/live-system-smoke.json',JSON.stringify({projectId:'attendit-350c6',testedAt:new Date().toISOString(),origin,results},null,2))
 console.log(JSON.stringify(results,null,2))
}
