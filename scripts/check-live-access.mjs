import { trustedServices } from './lib/admin-client.mjs'
import { deleteApp } from 'firebase-admin/app'
const s=trustedServices()
try {
  const categories=await s.database.ref('cfms/categories').get()
  const questions=await s.database.ref('cfms/questions').get()
  console.log(JSON.stringify({trustedAccess:true,existingCategories:categories.numChildren(),existingQuestions:questions.numChildren()}))
} catch { console.error('Trusted database access failed.'); process.exitCode=1 }
finally {await deleteApp(s.app)}
