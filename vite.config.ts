import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const PORTFOLIO_DIR = resolve(__dirname, 'public/portfolio')
const VIRTUAL_ID = 'virtual:portfolio-pages'
const RESOLVED_ID = '\0' + VIRTUAL_ID

// Serves the portfolio page list straight from the contents of public/portfolio,
// so renaming or adding spreads needs no code change. Only the top level is read,
// which keeps archived sets in public/portfolio/old out of the book.
function portfolioPages(): Plugin {
  // Files under public/ are served at stable URLs with no build hash, so a
  // re-export that reuses a filename would keep serving the stale cached image.
  // Tagging each URL with a hash of its bytes makes the URL change with content.
  const contentTag = (name: string) =>
    createHash('sha1').update(readFileSync(join(PORTFOLIO_DIR, name))).digest('hex').slice(0, 8)

  const readPages = () =>
    readdirSync(PORTFOLIO_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(webp|avif|png|jpe?g)$/i.test(entry.name))
      .map((entry) => entry.name)
      // Numeric-aware collation so "_2" sorts before "_10"
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }))
      .map((name) => `/portfolio/${encodeURIComponent(name)}?v=${contentTag(name)}`)

  return {
    name: 'portfolio-pages',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined
    },
    load(id) {
      return id === RESOLVED_ID ? `export default ${JSON.stringify(readPages())}` : undefined
    },
    configureServer(server) {
      const refresh = (file: string) => {
        if (!resolve(file).startsWith(PORTFOLIO_DIR)) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', refresh)
      server.watcher.on('unlink', refresh)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), portfolioPages()],
})
