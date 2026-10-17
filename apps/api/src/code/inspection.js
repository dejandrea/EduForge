import { posix } from 'node:path';
import { codePathSchema } from '@eduforge/shared';
export async function inspectRevision(revision, storage) {
  const files = revision.manifest,
    paths = new Set(files.map((f) => f.path));
  const languages = [...new Set(files.map((f) => f.path.split('.').pop().toLowerCase()))].sort();
  const packages = [],
    warnings = [],
    references = [];
  for (const file of files.filter((f) => f.text)) {
    const text = (await storage.read(file.hash)).toString('utf8');
    if (/(^|\/)package\.json$/.test(file.path)) {
      try {
        const data = JSON.parse(text);
        packages.push({
          path: file.path,
          name: typeof data.name === 'string' ? data.name : '',
          dependencies: data.dependencies || {},
          devDependencies: data.devDependencies || {},
          scripts: data.scripts || {},
        });
      } catch {
        warnings.push(`${file.path}: JSON inválido.`);
      }
    }
    if (/\.(?:js|jsx|ts|tsx|mjs|cjs|css)$/.test(file.path)) {
      for (const match of text.matchAll(
        /(?:from\s*|import\s*\(?|require\s*\(|@import\s*)['"]([^'"]+)['"]/g,
      )) {
        const target = match[1];
        if (!target.startsWith('.')) continue;
        const normalized = posix.normalize(posix.join(posix.dirname(file.path), target));
        const safe = codePathSchema.safeParse(normalized).success;
        const found =
          safe &&
          [
            normalized,
            ...[
              '.js',
              '.jsx',
              '.ts',
              '.tsx',
              '.json',
              '.css',
              '/index.js',
              '/index.jsx',
              '/index.ts',
              '/index.tsx',
            ].map((ext) => normalized + ext),
          ].some((p) => paths.has(p));
        references.push({ file: file.path, target, safe, found });
        if (!found)
          warnings.push(`${file.path}: referência ${target} não resolvida pela inspeção simples.`);
        if (references.length >= 2000) {
          warnings.push('Referências limitadas a 2000 ocorrências.');
          break;
        }
      }
    }
  }
  return {
    revision_id: revision.id,
    digest: revision.digest,
    files: files.length,
    total_bytes: files.reduce((n, f) => n + f.size, 0),
    languages,
    packages,
    references: references.slice(0, 2000),
    warnings: warnings.slice(0, 200),
    expected_files: {
      'package.json': paths.has('package.json'),
      'index.html': paths.has('index.html'),
      'README.md': paths.has('README.md'),
    },
    notice:
      'Inspeção estática: dependências e scripts são apenas declarações. Nenhum teste, build, instalação ou código foi executado. Referências dinâmicas e aliases exigem revisão humana.',
  };
}
export function revisionDiff(base, next) {
  const left = new Map(base.manifest.map((f) => [f.path, f])),
    right = new Map(next.manifest.map((f) => [f.path, f]));
  return [...new Set([...left.keys(), ...right.keys()])].sort().flatMap((path) => {
    const before = left.get(path),
      after = right.get(path);
    return before?.hash === after?.hash
      ? []
      : [
          {
            path,
            change: !before ? 'created' : !after ? 'removed' : 'modified',
            before: before || null,
            after: after || null,
          },
        ];
  });
}
