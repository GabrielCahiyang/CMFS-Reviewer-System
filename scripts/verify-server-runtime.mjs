import { createRequire } from 'node:module'
import { generateKeyPairSync, sign, verify } from 'node:crypto'
import assert from 'node:assert/strict'

// Run with --no-experimental-require-module to model the failing Vercel loader.
// No Firebase credentials, network calls, or real users are involved.
const require = createRequire(import.meta.url)
require('firebase-admin/auth')
const fromAdmin = createRequire(require.resolve('firebase-admin/auth'))
const jwksClient = fromAdmin('jwks-rsa')
const fromJwks = createRequire(fromAdmin.resolve('jwks-rsa'))
const { retrieveSigningKeys } = fromJwks('./utils')
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'runtime-test', alg: 'RS256', use: 'sig' }
const keys = await retrieveSigningKeys([jwk])
assert.equal(keys.length, 1)
const payload = Buffer.from('CFMS server-runtime verification')
const signature = sign('RSA-SHA256', payload, privateKey)
assert.equal(verify('RSA-SHA256', payload, keys[0].getPublicKey(), signature), true)
assert.equal(verify('RSA-SHA256', Buffer.from('tampered'), keys[0].getPublicKey(), signature), false)
// The package eagerly exports its Passport integration, which had the same
// synchronous ESM import. Exercise its callback contract as well as cold start.
const jwtInput = [
  Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'runtime-test' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: 'runtime-test' })).toString('base64url'),
].join('.')
const jwtSignature = sign('RSA-SHA256', Buffer.from(jwtInput), privateKey)
const secretProvider = jwksClient.passportJwtSecret({
  jwksUri: 'https://unused.example.test/jwks', cache: false,
  getKeysInterceptor: async () => [jwk],
})
const passportKey = await new Promise((resolve, reject) => secretProvider(null,
  `${jwtInput}.${jwtSignature.toString('base64url')}`, (error, key) => error ? reject(error) : resolve(key)))
assert.equal(verify('RSA-SHA256', Buffer.from(jwtInput), passportKey, jwtSignature), true)
console.log('Firebase Admin cold start and RSA signing-key conversion passed without require(esm).')
