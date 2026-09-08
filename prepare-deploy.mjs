import { mkdir, rm, copyFile, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = process.cwd()
const SRC_DATA = join(ROOT, 'public', 'data')
const DEPLOY = join(ROOT, 'deploy-public')
const DEPLOY_DATA = join(DEPLOY, 'data')

await rm(DEPLOY, { recursive: true, force: true })
await mkdir(DEPLOY_DATA, { recursive: true })

await copyFile(join(ROOT, 'static', 'favicon.svg'), join(DEPLOY, 'favicon.svg'))
await copyFile(join(ROOT, 'static', 'icons.svg'), join(DEPLOY, 'icons.svg'))
await copyFile(join(SRC_DATA, 'chemtree-1y.json'), join(DEPLOY_DATA, 'chemtree-1y.json'))
await copyFile(join(SRC_DATA, 'update-status.json'), join(DEPLOY_DATA, 'update-status.json'))

const raw = JSON.parse(await readFile(join(SRC_DATA, 'chemtree-1y.json'), 'utf8'))
const status = {
  generatedAt: raw.generatedAt ?? new Date().toISOString(),
  period: raw.period ?? null,
  papers: raw.source?.papers ?? (Array.isArray(raw.papers) ? raw.papers.length : null),
  journals: raw.source?.journals ?? ['JACS', 'Nature', 'Science', 'Chem'],
}
await writeFile(join(DEPLOY_DATA, 'public-status.json'), JSON.stringify(status, null, 2), 'utf8')
console.log('Deploy public prepared:', status)
