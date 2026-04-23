# @rivals/web

The web app is the same Expo codebase as `apps/mobile`, compiled for the `web`
platform via `react-native-web`. This package is a thin wrapper with scripts
that delegate to the mobile workspace.

## Dev

```bash
pnpm --filter @rivals/web dev     # starts expo dev server, opens browser
```

## Build

```bash
pnpm --filter @rivals/web build   # exports static web bundle to apps/mobile/dist
```

The static output lives at `apps/mobile/dist/` and is what the
`deploy-web.yml` GitHub Action uploads to Cloudflare Pages.
