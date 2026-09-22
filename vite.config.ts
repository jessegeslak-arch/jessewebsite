import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const PORTFOLIO_DIR = resolve(__dirname, 'public/portfolio')
const VIRTUAL_ID = 'virtual:portfolio-pages'
const RESOLVED_ID = '\0' + VIRTUAL_ID

// Serves the portfolio page list straight from the contents of public/portfolio,
// so renaming or adding spreads needs no code change. Only the top level is read,
// which keeps archived sets in public/portfolio/old out of the book.
function portfolioPages(): Plugin {
  const readPages = () =>
    readdirSync(PORTFOLIO_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(webp|avif|png|jpe?g)$/i.test(entry.name))
      .map((entry) => entry.name)
      // Numeric-aware collation so "_2_left" sorts before "_10_left"
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }))
      .map((name) => `/portfolio/${encodeURIComponent(name)}`)

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
