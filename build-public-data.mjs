import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const INPUT = join(HERE, 'public', 'data', 'chemtree-1y.json');

function paperKey(p) {
  const doi = String(p?.doi ?? '').trim().toLowerCase();
  if (doi) return `doi:${doi}`;
  const url = String(p?.url ?? '').trim().toLowerCase();
  if (url) return `url:${url}`;
  const title = String(p?.title ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `t:${title}|${p?.published ?? ''}`;
}

const rawText = await readFile(INPUT, 'utf8');
const raw = JSON.parse(rawText);

const membership = new Map();
for (const [nodeId, list] of Object.entries(raw.nodePapers ?? {})) {
  for (const p of list ?? []) {
    const k = paperKey(p);
    if (!membership.has(k)) membership.set(k, new Set());
    membership.get(k).add(nodeId);
  }
}

const parent = new Map((raw.treeDefinition ?? []).map(n => [n.id, n.parent ?? null]));
function ancestors(id) {
  const result = [];
  const seen = new Set();
  while (id && !seen.has(id)) {
    seen.add(id);
    result.push(id);
    id = parent.get(id) ?? null;
  }
  return result;
}

const papers = [];
for (const p of raw.papers ?? []) {
  const title = String(p.title ?? '').trim();
  if (!title) continue;

  const nodes = new Set(membership.get(paperKey(p)) ?? []);
  const cl = p.classification ?? {};
  if (cl.branch) for (const id of ancestors(cl.branch)) nodes.add(id);
  for (const t of cl.topics ?? []) {
    if (t?.id) for (const id of ancestors(t.id)) nodes.add(id);
  }
  nodes.add('chemistry');

  const doi = String(p.doi ?? '').trim();
  let url = String(p.url ?? '').trim();
  if (!url && doi) url = `https://doi.org/${doi}`;

  const countries = [];
  for (const c of p.openAlex?.countries ?? []) {
    const name = String(c?.name ?? c?.code ?? '').trim();
    if (name && !countries.includes(name)) countries.push(name);
  }

  papers.push({
    t: title,
    j: p.journal ?? p.fullJournal ?? '',
    jid: p.journalId ?? '',
    d: p.published ?? '',
    u: url,
    doi,
    n: [...nodes].sort(),
    c: countries,
    x: p.openAlex?.citations ?? p.citations ?? 0,
  });
}

papers.sort((a, b) => (b.d || '').localeCompare(a.d || '') || (b.t || '').localeCompare(a.t || ''));

const mobile = {
  generatedAt: raw.generatedAt ?? new Date().toISOString(),
  tree: (raw.treeDefinition ?? []).map(n => ({id:n.id,label:n.label,parent:n.parent ?? null})),
  papers,
  journals: ['all','jacs','nature','science','chem'],
};

await writeFile(
  join(REPO, 'chemtree-mobile-data.js'),
  `window.CHEMTREE_MOBILE_DATA=${JSON.stringify(mobile)};\n`,
  'utf8'
);

await writeFile(
  join(REPO, 'chemtree-1y.json.gz'),
  gzipSync(Buffer.from(rawText, 'utf8'), {level: 9})
);

const status = {
  status: 'success',
  updatedAt: new Date().toISOString(),
  generatedAt: mobile.generatedAt,
  papers: papers.length,
  journals: ['JACS','Nature','Science','Chem'],
  period: raw.period ?? null,
};

await writeFile(
  join(REPO, 'chemtree-update-status.json'),
  JSON.stringify(status, null, 2),
  'utf8'
);

console.log(`Public ChemTree data generated: ${papers.length} papers`);
