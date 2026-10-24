import { readFile } from 'node:fs/promises'
import ts from 'typescript'
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') return {url:'data:text/javascript,export {}',shortCircuit:true}
  if (specifier.startsWith('@/')) return nextResolve(new URL('../src/'+specifier.slice(2),import.meta.url).href+'.ts',context)
  try { return await nextResolve(specifier,context) }
  catch (error) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(specifier + '.ts',context)
    throw error
  }
}
export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts') || url.endsWith('.tsx')) {
    const source = await readFile(new URL(url),'utf8')
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText }
  }
  return nextLoad(url,context)
}
