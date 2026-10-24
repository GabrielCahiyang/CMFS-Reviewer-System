import {initializeApp,deleteApp} from 'firebase-admin/app'
import {getDatabase} from 'firebase-admin/database'
import {validatedFiles} from './lib/seed-files.mjs'
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9000')throw new Error('This loader is local-emulator-only.')
const app=initializeApp({projectId:'demo-cfms',databaseURL:'https://demo-cfms-default-rtdb.firebaseio.com'},'actual-bank-test-load')
try{
 const files=await validatedFiles(),updates={}
 for(const [id,bank] of Object.entries(files.banks)){
  updates[`questions/${id}`]=bank;updates[`categories/${id}`]=files.categories[id]
  updates[`questionBankVersions/${id}/${files.categories[id].contentVersion}/questions`]=bank
 }
 await getDatabase(app).ref('cfms').update(updates)
 console.log(`All ${Object.values(files.banks).reduce((n,bank)=>n+Object.keys(bank).length,0)} imported questions loaded into the isolated demo-cfms emulator for end-to-end testing.`)
}finally{await deleteApp(app)}
