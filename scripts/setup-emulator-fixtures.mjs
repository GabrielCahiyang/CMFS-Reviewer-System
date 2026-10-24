import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'
import { readFile } from 'node:fs/promises'
if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('This fixture script runs only against the local emulators.')
const app=initializeApp({projectId:'demo-cfms',databaseURL:'https://demo-cfms-default-rtdb.firebaseio.com'})
const auth=getAuth(app), database=getDatabase(app)
const rulesResponse = await fetch('http://127.0.0.1:9000/.settings/rules.json?ns=demo-cfms-default-rtdb',{
  method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:await readFile('firebase.database.rules.json','utf8'),
})
if (!rulesResponse.ok) throw new Error('Could not apply rules to the local test namespace.')
const manifest=JSON.parse(await readFile('scripts/source-manifest.json','utf8'))
const categories={},questions={},versions={}
for(const source of manifest.sources) {
  const bank={
    'q-001':{originalNumber:'1',question:'Emulator test: Which option represents current assets?',type:'multiple-choice',choices:['Cash','Long-term debt'],correctAnswer:'Cash',topic:'Test fixture',sourceDocument:'emulator-test-fixture',verificationStatus:'verified',contentVersion:'test-v1'},
    'q-002':{originalNumber:'2',question:'Emulator test: Cash is a current asset.',type:'true-false',choices:['True','False'],correctAnswer:'True',topic:'Test fixture',sourceDocument:'emulator-test-fixture',verificationStatus:'verified',contentVersion:'test-v1'},
    'q-003':{originalNumber:'3',question:'Emulator test: Name the most liquid current asset.',type:'identification',correctAnswer:'Cash',acceptedAnswers:['cash equivalents'],topic:'Test fixture',sourceDocument:'emulator-test-fixture',verificationStatus:'verified',contentVersion:'test-v1'},
    'q-004':{originalNumber:'4',question:'Emulator test: Name two current assets.',type:'enumeration',correctAnswer:['Cash','Inventory'],topic:'Test fixture',sourceDocument:'emulator-test-fixture',verificationStatus:'verified',contentVersion:'test-v1'},
  }
  categories[source.categoryId]={title:source.title,description:'Local emulator fixtures',sourceDocument:'emulator-test-fixture',icon:source.icon,color:source.color,questionCount:4,types:['multiple-choice','true-false','identification','enumeration'],enabledModes:['practice','exam','flashcard','mixed'],contentVersion:'test-v1'}
  questions[source.categoryId]=bank; versions[source.categoryId]={'test-v1':{questions:bank}}
}
for(const [uid,email,admin] of [['test-student','student@example.test',false],['test-admin','admin@example.test',true]]) {
  let account
  try { account=await auth.getUser(uid) } catch { account=await auth.createUser({uid,email,password:'EmulatorOnly123!',displayName:admin?'Test Administrator':'Test Student'}) }
  if(admin) await auth.setCustomUserClaims(account.uid,{cfmsAdmin:true})
}
await database.ref('cfms').update({categories,questions,questionBankVersions:versions})
console.log('Local demo-cfms fixtures prepared. Accounts: student@example.test and admin@example.test; password: EmulatorOnly123!')
process.exit(0)
