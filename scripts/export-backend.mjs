import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

// Wrangler already ships esbuild; use its compiler without adding a build dependency.
const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('wrangler'))('esbuild')
const backend = resolve(process.argv[2] || '../rail-announcements-backend')
const directory = await mkdtemp(join(tmpdir(), 'backend-parity-'))
try {
  const output = join(directory, 'generate.cjs')
  await build({
    entryPoints: ['tests/backend-parity/generate.ts'],
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    loader: { '.png': 'dataurl', '.svg': 'dataurl' },
    target: 'node20',
    logLevel: 'error',
  })
  const result = spawnSync(process.execPath, [output, backend], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  await rm(directory, { recursive: true, force: true })
}
