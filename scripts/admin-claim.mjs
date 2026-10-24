import { trustedServices } from './lib/admin-client.mjs'
import { deleteApp } from 'firebase-admin/app'
const args = process.argv.slice(2).filter((v) => v !== '--')
const [action,uid] = args
if (!['grant','revoke'].includes(action) || !uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid) || !args.includes('--confirm-uid') || args[args.indexOf('--confirm-uid')+1] !== uid)
  throw new Error('Usage: pnpm admin:claim -- grant|revoke <uid> --confirm-uid <uid>')
const services = trustedServices()
try {
  const user = await services.auth.getUser(uid)
  const claims = { ...user.customClaims }
  if (action === 'grant') claims.cfmsAdmin = true
  else delete claims.cfmsAdmin
  await services.auth.setCustomUserClaims(uid,claims)
  if (action === 'revoke') await services.auth.revokeRefreshTokens(uid)
  console.log(`CFMS administrator claim ${action === 'grant' ? 'granted' : 'revoked'}. Sign in again to refresh access.`)
} finally { await deleteApp(services.app) }
