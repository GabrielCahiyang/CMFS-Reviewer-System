import { reportValidation } from './lib/seed-files.mjs'
try { await reportValidation() } catch (error) { console.error(error.message); process.exitCode = 1 }
