# `@deepseek-ai/dsh-engram-pq` — Engram engine as a Cordis service

Runs the 8b-is/Engram sovereign benchmark (zero-float p/q kernels,
Omni BFP-64, MEM|8 adaptive, Quantum 64-trit) inside the plugin tree
and reports parsed rows over the `engram/bench-done` event.

```ts
import { apply } from '@deepseek-ai/dsh-engram-pq'
await ctx.plugin(apply)
const reports = await ctx.engram.bench({ cwd: '/path/to/Engram' })
```

- `ENGRAM_PQ_BIN` overrides the runner binary; otherwise `cargo run
  --manifest-path rust/Cargo.toml --release --bin bench` is spawned.
- The runner is injectable, so tests stay hermetic and remote executors
  can replace the local cargo call later.
- Parser keeps every recognized row; unknown lines are never dropped,
  they surface as note-only rows.
