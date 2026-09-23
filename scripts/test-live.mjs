import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

// Wrangler already ships esbuild; use its compiler without adding a test framework.
const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('wrangler'))('esbuild')
const directory = await mkdtemp(join(tmpdir(), 'live-feed-tests-'))
try {
  const output = join(directory, 'tests.cjs')
  await build({
    entryPoints: ['tests/live.test.ts'],
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.pb': 'binary' },
    // esbuild's binary loader otherwise emits Uint8Array.fromBase64, which Node does not have yet.
    target: 'node20',
  })
  const result = spawnSync(process.execPath, ['--test', output], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  await rm(directory, { recursive: true, force: true })
}
