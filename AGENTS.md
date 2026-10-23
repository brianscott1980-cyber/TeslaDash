<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## User workflow requirements
- Make all development changes and run development previews on this workstation.
- This PC has static IPv4 192.168.0.102; its own development instance must be served directly at 192.168.0.102:3000. Never forward that address to the NAS.
- The NAS has IPv4 192.168.0.101 and has its own independent TeslaDash instance on port 3000 after the next explicitly requested deployment.
- Test against Prometheus running on the Synology NAS.
- Do not deploy, replace, or restart NAS containers unless the user explicitly requests deployment.
- When the user requests deployment, TeslaDash runs on the NAS and is served on NAS port 3000.
- Keep credentials in ignored .env.local files. Do not replace the NAS's rotating tokens with workstation tokens.

