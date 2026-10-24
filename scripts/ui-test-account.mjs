import {readFile,writeFile,unlink} from 'node:fs/promises'
import {randomUUID,randomBytes} from 'node:crypto'
import {deleteApp} from 'firebase-admin/app'
import {trustedServices} from './lib/admin-client.mjs'
const services=trustedServices(),file='seed-output/ui-test-account.json'
try {
 if(process.argv.includes('--cleanup')){
  const {uid}=JSON.parse(await readFile(file,'utf8'))
  if(!uid.startsWith('cfms-ui-test-'))throw new Error('Invalid disposable account.')
  await services.database.ref(`cfms/users/${uid}`).remove()
  await services.database.ref(`cfms/admin/userDirectory/${uid}`).remove()
  await services.auth.deleteUser(uid);await unlink(file)
  console.log('Disposable UI account and its private session records removed.')
 }else{
  const uid=`cfms-ui-test-${randomUUID()}`,email=`${uid}@example.test`,password=randomBytes(24).toString('base64url')+'Aa1!'
  await services.auth.createUser({uid,email,password,displayName:'UI Test Learner'})
  await services.auth.setCustomUserClaims(uid,{cfmsTest:true})
  await writeFile(file,JSON.stringify({uid,email,password}),{flag:'wx'})
  console.log('Disposable UI test account ready; credentials are private and not printed.')
 }
}finally{await deleteApp(services.app)}
