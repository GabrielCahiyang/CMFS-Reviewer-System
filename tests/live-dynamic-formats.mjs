import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {deleteApp} from 'firebase-admin/app'
import {trustedServices} from '../scripts/lib/admin-client.mjs'
import {parseQuestions} from '../src/lib/question-schema.ts'
import {questionsForSession} from '../src/lib/question-presentation.ts'
const account=JSON.parse(await readFile('seed-output/ui-test-account.json','utf8'))
if(!account.uid.startsWith('cfms-ui-test-'))throw new Error('Only a disposable test account can run this verification.')
const s=trustedServices(),results=[]
try{
 const login=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password,returnSecureToken:true})})
 const {idToken}=await login.json();assert.ok(idToken)
 const categories=(await s.database.ref('cfms/categories').get()).val()
 const banks=(await s.database.ref('cfms/questions').get()).val()
 async function save(session){const response=await fetch('http://localhost:3000/api/study/sessions',{method:'POST',headers:{Authorization:`Bearer ${idToken}`,'Content-Type':'application/json'},body:JSON.stringify(session),signal:AbortSignal.timeout(90000)});const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data.session}
 for(const [categoryId,raw]of Object.entries(banks))for(const questionFormat of ['multiple-choice','true-false']){
  const bank=parseQuestions(raw,categoryId),ids=['q-001','q-003']
  const session={id:`dynamic-${categoryId}-${questionFormat}`,categoryId,mode:'exam',contentVersion:categories[categoryId].contentVersion,
   settings:{mode:'exam',questionFormat,types:[questionFormat],count:2,randomize:false,shuffleChoices:false,instantFeedback:false,showExplanations:true,timer:false,durationMinutes:20,filter:'all'},
   questionIds:ids,currentQuestionIndex:0,answers:{},startedAt:0,updatedAt:0,status:'in-progress',revision:1}
  const views=questionsForSession(bank,session).filter(q=>ids.includes(q.id))
  session.choiceOrder=Object.fromEntries(views.map(q=>[q.id,q.choices]))
  const created=await save(session)
  assert.deepEqual(created.questionIds,ids)
  const completed=await save({...created,revision:2,status:'completed',answers:Object.fromEntries(views.map(q=>[q.id,{value:q.correctAnswer,status:'pending',credit:0,graded:false}]))})
  assert.equal(completed.score,views.filter(q=>q.verificationStatus==='verified').length)
  results.push({categoryId,questionFormat,selectedOriginalNumbers:views.map(q=>q.originalNumber),saved:true,submitted:true,score:completed.score})
 }
 await writeFile('docs/verification/dynamic-format-flow.json',JSON.stringify({testedAt:new Date().toISOString(),results},null,2)+'\n')
 console.log(`All ${results.length} live dynamic-format/custom-selection workflows passed across all six categories.`)
}finally{await deleteApp(s.app)}
