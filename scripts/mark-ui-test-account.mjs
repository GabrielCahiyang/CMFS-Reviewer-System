import {readFile} from 'node:fs/promises'
import {trustedServices} from './lib/admin-client.mjs'
import {deleteApp} from 'firebase-admin/app'
const s=trustedServices()
try{const {uid}=JSON.parse(await readFile('seed-output/ui-test-account.json','utf8'));if(!uid.startsWith('cfms-ui-test-'))throw new Error('Invalid test account.');await s.auth.setCustomUserClaims(uid,{cfmsTest:true});console.log('Disposable account excluded from real learner telemetry.')}finally{await deleteApp(s.app)}
