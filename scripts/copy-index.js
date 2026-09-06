import fs from 'fs'
import path from 'path'

const dist = path.resolve('dist')

fs.copyFileSync(
  path.join(dist, 'index.html'),
  path.join(dist, '404.html')
)

console.log('Created dist/404.html for GitHub Pages SPA fallback.')