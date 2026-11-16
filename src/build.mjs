/**
 * Build the served browser bundle.
 *
 * DSH loads `lib/client.js` as a lazy module-body bundle. This script wraps
 * the authored body (`src/client.js`) in `window.__ModuleLoader__.load` and
 * inlines the stylesheet and locale dictionaries. No bundler is needed for a
 * React-only body.
 *
 * Usage:
 *   node src/build.mjs            write lib/client.js
 *   node src/build.mjs --check    fail when lib/client.js is stale
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
const body = readFileSync(join(root, 'src/client.js'), 'utf8')
const outPath = join(root, 'lib/client.js')

/** Client dictionaries drop `meta`, which belongs to the Plugin Manager. */
function dictionary(language) {
  const parsed = JSON.parse(readFileSync(join(root, 'locale', `${language}.json`), 'utf8'))
  delete parsed.meta
  return parsed
}

const locales = { en: dictionary('en'), zh: dictionary('zh') }
const bodyWithAssets = body
  .replace('__NM_CSS__', () => JSON.stringify(css))
  .replace('__NM_LOCALES__', () => JSON.stringify(locales))

const bundle = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(pkg.name)},
\tfactory: (require) => {
${bodyWithAssets}
\t\treturn create(require)
\t}
});
`

const current = (() => {
  try {
    return readFileSync(outPath, 'utf8')
  } catch {
    return ''
  }
})()

if (process.argv.includes('--check')) {
  if (current !== bundle) {
    console.error('dsh-next-message: lib/client.js is stale — run `node src/build.mjs`')
    process.exit(1)
  }
  console.log('dsh-next-message: lib/client.js is up to date')
} else {
  writeFileSync(outPath, bundle)
  console.log(`dsh-next-message: wrote lib/client.js (${(Buffer.byteLength(bundle) / 1024).toFixed(1)} KiB)`)
}
