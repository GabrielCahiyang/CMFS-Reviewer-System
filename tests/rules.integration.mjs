import { readFile } from 'node:fs/promises'
import { before, after, beforeEach, test } from 'node:test'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { ref, set, get, update } from 'firebase/database'
let env
before(async () => {
  if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST) throw new Error('Run this suite through pnpm test:rules. Never run against production.')
  const rules = await readFile(process.env.CFMS_TEST_RULES_FILE || 'firebase.database.rules.json','utf8')
  env = await initializeTestEnvironment({ projectId:'demo-cfms',database:{rules} })
})
after(async () => { await env?.cleanup() })
beforeEach(async () => {
  await env.clearDatabase()
  await env.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(),'cfms'),{ categories:{'new-reviewer':{title:'NEW REVIEWER'}},questions:{'new-reviewer':{'q-001':{question:'Question'}}},activityEvents:{event1:{uid:'student-a',occurredAt:1}},analytics:{daily:{'2026-10-24':{total:1}}} })
  })
})
const database = (uid,claims = {}) => env.authenticatedContext(uid,{email:`${uid}@example.test`,...claims}).database()
test('anonymous visitors cannot read questions, private data or analytics',async () => {
  const db = env.unauthenticatedContext().database()
  for (const path of ['questions','users/student-a','activityEvents','analytics']) await assertFails(get(ref(db,`cfms/${path}`)))
})
test('students cannot read or write others, analytics, event logs or official content',async () => {
  const db = database('student-a')
  await assertSucceeds(get(ref(db,'cfms/questions/new-reviewer')))
  for (const path of ['users/student-b/profile','activityEvents','analytics','admin']) { await assertFails(get(ref(db,`cfms/${path}`))); await assertFails(set(ref(db,`cfms/${path}`),{x:true})) }
  for (const path of ['cfms','cfms/users/student-a','cfms/questions/new-reviewer/q-001','cfms/categories/new-reviewer']) await assertFails(set(ref(db,path),{x:true}))
})
test('student profile cannot grant privileges or change creation time',async () => {
  const db = database('student-a'), path = 'cfms/users/student-a/profile'
  await assertSucceeds(set(ref(db,path),{displayName:'Student',email:'student-a@example.test',createdAt:1,updatedAt:1}))
  await assertFails(update(ref(db,path),{role:'admin'}))
  await assertFails(update(ref(db,path),{createdAt:2}))
  await assertSucceeds(update(ref(db,path),{displayName:'Updated',updatedAt:2}))
})
const session = () => ({id:'s1',categoryId:'new-reviewer',mode:'practice',settings:{mode:'practice',types:['multiple-choice'],count:1,randomize:false,shuffleChoices:false,instantFeedback:true,showExplanations:true,timer:false,durationMinutes:20,filter:'all'},questionIds:['q-001'],currentQuestionIndex:0,status:'in-progress',startedAt:1,updatedAt:1,revision:1,contentVersion:'v1'})
test('session records are owner-readable and only trusted server code can create or change them',async () => {
  const db=database('student-a'), path='cfms/users/student-a/sessions/s1', s=session()
  await assertFails(set(ref(db,path),s))
  await env.withSecurityRulesDisabled(async (context) => set(ref(context.database(),path),s))
  await assertSucceeds(get(ref(db,path)))
  await assertFails(set(ref(db,path),{...s,revision:1,updatedAt:2}))
  await assertFails(set(ref(db,path),{...s,revision:2,mode:'exam'}))
  await assertFails(set(ref(db,path),{...s,revision:2,questionIds:['q-002']}))
  await assertFails(set(ref(db,path),{...s,revision:2,contentVersion:'v2'}))
  await assertFails(set(ref(db,path),null))
  await assertFails(set(ref(db,path),{...s,revision:2,status:'completed',completedAt:2,updatedAt:2}))
  await assertFails(set(ref(db,path),{...s,revision:3,status:'completed',updatedAt:3}))
})
test('only custom-claim administrators can read operational records, and clients cannot write them',async () => {
  const db=database('admin',{cfmsAdmin:true})
  for(const path of ['activityEvents','analytics','admin']) { await assertSucceeds(get(ref(db,`cfms/${path}`))); await assertFails(set(ref(db,`cfms/${path}`),{x:true})) }
  await assertFails(get(ref(database('student-a',{role:'admin'}),'cfms/activityEvents')))
})
