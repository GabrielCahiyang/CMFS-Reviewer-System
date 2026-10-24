import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { getApps,deleteApp } from 'firebase-admin/app'
import { POST as save } from '../src/app/api/study/sessions/route.ts'
import { POST as log } from '../src/app/api/study/events/route.ts'
import { GET as report } from '../src/app/api/study/admin/route.ts'

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'demo-cfms') throw new Error('This test requires the local demo-cfms emulators.')
async function login(email) {
  const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'EmulatorOnly123!',returnSecureToken:true})})
  const result=await response.json(); assert.ok(result.idToken); return result.idToken
}
const student=await login('student@example.test'),admin=await login('admin@example.test')
after(async () => { await Promise.all(getApps().map(deleteApp)) })
const request=(path,token,body) => new Request(`http://localhost${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
test('server workflow saves/regrades, logs once, verifies admin access and rejects stale edits',async () => {
  const s={id:`integration-${Date.now()}`,categoryId:'new-reviewer',mode:'practice',contentVersion:'test-v1',settings:{mode:'practice',types:['multiple-choice'],count:1,randomize:false,shuffleChoices:false,instantFeedback:true,showExplanations:true,timer:false,durationMinutes:20,filter:'all'},questionIds:['q-001'],currentQuestionIndex:0,answers:{},status:'in-progress',startedAt:1,updatedAt:1,revision:1}
  const created=await save(request('/api/study/sessions',student,s)); assert.equal(created.status,200,await created.clone().text())
  const stored=(await created.json()).session
  assert.ok(stored.startedAt>1)
  const start={eventId:`start-${s.id}`,type:'session_started',categoryId:s.categoryId,sessionId:s.id}
  for(let i=0;i<2;i++) { const response=await log(request('/api/study/events',student,start)); assert.equal(response.status,200,await response.clone().text()) }
  const completed=await save(request('/api/study/sessions',student,{...stored,revision:2,status:'completed',answers:{'q-001':{value:'Long-term debt',status:'correct',credit:1,graded:true}}}))
  assert.equal(completed.status,200,await completed.clone().text()); assert.equal((await completed.json()).session.score,0)
  const event={eventId:`complete-${s.id}`,type:'session_completed',categoryId:s.categoryId,sessionId:s.id}
  for(let i=0;i<2;i++) { const response=await log(request('/api/study/events',student,event)); assert.equal(response.status,200,await response.clone().text()) }
  assert.equal((await save(request('/api/study/sessions',student,{...stored,answers:{},revision:3}))).status,409)
  assert.equal((await report(request('/api/study/admin?kind=overview',student))).status,403)
  const overview=await report(request('/api/study/admin?kind=overview',admin)); assert.equal(overview.status,200)
  const activity=await report(request('/api/study/admin?kind=activity&uid=test-student',admin)); assert.equal(activity.status,200)
  const events=(await activity.json()).events.filter((e) => e.sessionId===s.id)
  assert.equal(events.filter((e) => e.type==='session_completed').length,1)
  assert.equal(events.filter((e) => e.type==='session_started').length,1)
})
