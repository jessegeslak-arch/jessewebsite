// Re-encodes public/portfolio to web-sized lossy WebP, in place.
// Exports straight from design tools are often lossless WebP at print
// resolution (tens of MB per page), which is far too heavy to deploy.
// Run: npm run compress:images [maxWidth] [quality]
import { readdirSync, statSync, renameSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const DIR = 'public/portfolio'
const MAX_WIDTH = Number(process.argv[2] ?? 3400)
const QUALITY = Number(process.argv[3] ?? 82)
// Anything already at or below display resolution and this size is assumed
// web-ready; re-encoding it would only throw away quality.
const SKIP_UNDER_BYTES = 2 * 1024 * 1024

const files = readdirSync(DIR)
  .filter((f) => f.toLowerCase().endsWith('.webp'))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))

let before = 0
let after = 0

for (const name of files) {
  const src = join(DIR, name)
  const size = statSync(src).size
  const { width } = await sharp(src).metadata()
  before += size

  if (width <= MAX_WIDTH && size < SKIP_UNDER_BYTES) {
    after += size
    console.log(name.padEnd(40), `${(size / 1024).toFixed(0)} KB`.padStart(9), 'skipped')
    continue
  }

  const tmp = `${src}.tmp`
  await sharp(src).resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY, effort: 6 }).toFile(tmp)
  unlinkSync(src)
  renameSync(tmp, src)

  const out = statSync(src).size
  after += out
  console.log(name.padEnd(40), `${(size / 1024 / 1024).toFixed(2)} MB`.padStart(9), '->', `${(out / 1024).toFixed(0)} KB`.padStart(8))
}

console.log(`\nTotal: ${(before / 1024 / 1024).toFixed(1)} MB -> ${(after / 1024 / 1024).toFixed(1)} MB`)
console.log(`Settings: max width ${MAX_WIDTH}px, quality ${QUALITY}`)
