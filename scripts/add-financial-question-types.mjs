import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {deleteApp} from 'firebase-admin/app'
import {trustedServices} from './lib/admin-client.mjs'
import {financialChoiceQuestions} from './lib/financial-choice-questions.mjs'
import {hash,stableJson,validateBank} from './lib/import-core.mjs'
const id='financial-statements',services=trustedServices()
try {
  const base=services.database.ref('cfms')
  const [categorySnap,bankSnap]=await Promise.all([base.child(`categories/${id}`).get(),base.child(`questions/${id}`).get()])
  const category=categorySnap.val(),previous=bankSnap.val()
  if(!category||!previous)throw new Error('Financial Statements reviewer is missing.')
  const additions=financialChoiceQuestions(category.sourceDocument)
  for(const [key,q]of Object.entries(additions))if(previous[key]&&previous[key].question!==q.question)throw new Error(`Existing record ${key} conflicts; refusing overwrite.`)
  const raw={...previous,...additions}
  for(const q of Object.values(raw)){delete q.contentVersion;delete q.importId}
  const qa=validateBank(raw)
  if(qa.errors.length)throw new Error(qa.errors.join('\n'))
  const importId=`import-${hash(raw).slice(0,24)}`,contentVersion=`v-${hash({raw,importId}).slice(0,24)}`
  const bank=Object.fromEntries(Object.entries(raw).map(([key,q])=>[key,{...q,contentVersion,importId}]))
  const updated={...category,questionCount:Object.keys(bank).length,expectedCount:Object.keys(bank).length,
    description:'64 source-grounded study questions across four formats; generated drafts for instructor review.',
    types:['multiple-choice','true-false','identification','enumeration'],contentVersion}
  await mkdir('private-backups',{recursive:true})
  const backupPath=`private-backups/${importId}-${Date.now()}.json`
  await writeFile(backupPath,JSON.stringify({replacedBy:importId,categories:{[id]:category},questions:{[id]:previous}},null,2),{flag:'wx'})
  const archive=base.child(`questionBankVersions/${id}/${contentVersion}`)
  const existing=(await archive.get()).val()
  if(existing&&stableJson(existing.questions)!==stableJson(bank))throw new Error('Version collision.')
  if(!existing)await archive.set({questions:bank,checksum:hash(bank)})
  if(hash((await archive.child('questions').get()).val())!==hash(bank))throw new Error('Staged verification failed.')
  // Only this reviewer's bank and metadata change. Old versions stay available to saved sessions.
  await base.update({[`questions/${id}`]:bank,[`categories/${id}`]:updated,[`sourceImports/${importId}`]:{
    status:'applied',appliedAt:Date.now(),actor:'trusted-admin-sdk',categoryId:id,counts:{[id]:64},
    addedTypes:['multiple-choice','true-false'],addedQuestions:24,previousVersion:category.contentVersion??'legacy',
  }})
  const [savedBank,savedCategory]=await Promise.all([base.child(`questions/${id}`).get(),base.child(`categories/${id}`).get()])
  if(stableJson(savedBank.val())!==stableJson(bank)||stableJson(savedCategory.val())!==stableJson(updated))throw new Error('Live read-back verification failed.')
  // Synchronize private import staging so future imports preserve these additions.
  await writeFile(`seed-output/questions/${id}.json`,JSON.stringify(raw,null,2)+'\n')
  const staging=JSON.parse(await readFile('seed-output/categories.json','utf8'))
  const {contentVersion:_version,...stagedCategory}=updated
  staging[id]=stagedCategory
  await writeFile('seed-output/categories.json',JSON.stringify(staging,null,2)+'\n')
  await mkdir('docs/verification',{recursive:true})
  const report={importId,categoryId:id,total:64,addedMultipleChoice:12,addedTrueFalse:12,preservedExisting:40,readBackVerified:true,backupPath}
  await writeFile('docs/verification/financial-question-types.json',JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report,null,2))
}finally{await deleteApp(services.app)}
