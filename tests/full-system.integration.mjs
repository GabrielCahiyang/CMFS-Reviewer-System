import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {getApps,deleteApp} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import {POST as save} from '../src/app/api/study/sessions/route.ts'
import {POST as log} from '../src/app/api/study/events/route.ts'
import {GET as report} from '../src/app/api/study/admin/route.ts'
import {GET as accountExport} from '../src/app/api/study/account/route.ts'
import {adminServices} from '../src/lib/server/firebase-admin.ts'
import {validatedFiles} from '../scripts/lib/seed-files.mjs'
import {questionsForSession} from '../src/lib/question-presentation.ts'
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9000'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099'||process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!=='demo-cfms')throw new Error('Full-system testing is isolated to local demo-cfms emulators.')
const files=await validatedFiles(),runId=String(Date.now())
const request=(path,token,body)=>new Request('http://localhost'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
async function login(email){const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'EmulatorOnly123!',returnSecureToken:true})});const j=await r.json();assert.ok(j.idToken);return j.idToken}
async function json(response){assert.equal(response.status,200,await response.clone().text());return response.json()}
after(async()=>{await Promise.all(getApps().map(deleteApp))})
for(const [categoryId,bank]of Object.entries(files.banks)){
 test(`${categoryId}: all ${Object.keys(bank).length} actual questions complete practice, exam, mixed and flashcard workflows`,async()=>{
  const {auth,database}=adminServices(),uid=`test-${categoryId}-${runId}`,email=`${uid}@example.test`
  await auth.createUser({uid,email,password:'EmulatorOnly123!'})
  const token=await login(email)
  await json(await log(request('/api/study/events',token,{eventId:`login-${uid}`,type:'auth_login'})))
  for(const mode of ['practice','exam','mixed','flashcard']){
   const ids=Object.keys(bank),sessionId=`system-${mode}-${runId}`
   const s={id:sessionId,categoryId,mode,contentVersion:files.categories[categoryId].contentVersion,
    settings:{mode,types:files.categories[categoryId].types,count:ids.length,randomize:false,shuffleChoices:false,instantFeedback:mode!=='exam',showExplanations:true,timer:false,durationMinutes:20,filter:'all'},
    questionIds:ids,currentQuestionIndex:0,answers:{},status:'in-progress',startedAt:1,updatedAt:1,revision:1}
   let current=(await json(await save(request('/api/study/sessions',token,s)))).session
   await json(await log(request('/api/study/events',token,{eventId:`start-${sessionId}`,type:'session_started',categoryId,sessionId})))
   await json(await log(request('/api/study/events',token,{eventId:`view-${sessionId}`,type:'question_viewed',categoryId,sessionId,questionId:ids[0]})))
   const answers=Object.fromEntries(ids.map(id=>[id,{value:bank[id].correctAnswer,status:mode==='flashcard'?'correct':'pending',credit:mode==='flashcard'?1:0,graded:mode==='flashcard'}]))
   current=(await json(await save(request('/api/study/sessions',token,{...current,revision:2,answers})))).session
   assert.equal(Object.keys(current.answers).length,ids.length)
   current=(await json(await save(request('/api/study/sessions',token,{...current,currentQuestionIndex:ids.length-1,revision:3})))).session
   await json(await log(request('/api/study/events',token,{eventId:`resume-${sessionId}`,type:'session_resumed',categoryId,sessionId})))
   const completed=(await json(await save(request('/api/study/sessions',token,{...current,revision:4,status:'completed'})))).session
   const expected=mode==='flashcard'?ids.length:Object.values(bank).filter(q=>q.verificationStatus==='verified').length
   assert.equal(completed.score,expected)
   const event={eventId:`finish-${sessionId}`,type:'session_completed',categoryId,sessionId}
   await json(await log(request('/api/study/events',token,event)));await json(await log(request('/api/study/events',token,event)))
   const score=(await database.ref(`cfms/analytics/scores/${uid}/${sessionId}`).get()).val()
   assert.equal(score.score,mode==='flashcard'?0:expected);assert.equal(score.maxScore,mode==='flashcard'?0:expected)
   assert.equal((await save(request('/api/study/sessions',token,{...completed,revision:5}))).status,409)
  }
  for(const format of ['multiple-choice','true-false']){
   const allIds=Object.keys(bank),ids=[allIds[0],allIds[Math.floor(allIds.length/2)],allIds.at(-1)]
   const id=`custom-${format}-${runId}`,settings={mode:'exam',questionFormat:format,types:[format],count:3,randomize:false,shuffleChoices:false,instantFeedback:false,showExplanations:true,timer:false,durationMinutes:20,filter:'all'}
   const session={id,categoryId,mode:'exam',contentVersion:files.categories[categoryId].contentVersion,settings,questionIds:ids,currentQuestionIndex:0,answers:{},status:'in-progress',startedAt:1,updatedAt:1,revision:1}
   const sourceQuestions=Object.entries(bank).map(([id,q])=>({...q,id,categoryId}))
   const views=questionsForSession(sourceQuestions,session).filter(q=>ids.includes(q.id))
   session.choiceOrder=Object.fromEntries(views.map(q=>[q.id,q.choices]))
   const saved=(await json(await save(request('/api/study/sessions',token,session)))).session
   assert.deepEqual(saved.questionIds,ids)
   const complete=(await json(await save(request('/api/study/sessions',token,{...saved,revision:2,status:'completed',answers:Object.fromEntries(views.map(q=>[q.id,{value:q.correctAnswer,status:'pending',credit:0,graded:false}]))})))).session
   assert.equal(complete.score,views.filter(q=>q.verificationStatus==='verified').length)
  }
  const exported=await json(await accountExport(request('/api/study/account',token)))
  assert.equal(exported.uid,uid);assert.equal(Object.keys(exported.data.sessions).length,6)
  assert.equal((await report(request('/api/study/admin?kind=overview',token))).status,403)
 })
}
