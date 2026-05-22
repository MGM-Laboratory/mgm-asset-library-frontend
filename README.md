# MGM Asset Library — Frontend

The web client for [MGM Asset Library](https://asset.labmgm.org) — an internal,
Unity-Asset-Store–style library for the MGM research lab and partners. Stores
`.unitypackage`, `.uplugin`, full Unreal projects, 2D/3D models, VFX, audio,
animations, tools, scripts.

This repo is **one of four**:

| Repo | Role |
| ---- | ---- |
| [`mgm-asset-library-backend`](../mgm-asset-library-backend) | NestJS REST API + WebSocket gateway. |
| **`mgm-asset-library-frontend`** *(this repo)* | Next.js 15 web client. |
| `mgm-asset-library-unity` | Unity Editor plugin. |
| `mgm-asset-library-unreal` | Unreal Editor plugin. |

This is **Part 1 of 4** for the frontend. Part 1 ships the foundation:
design system, primitives, layout, auth, i18n, and the WebSocket plumbing.
Discover / Asset detail / Library / Search land in Part 2; Publish / Request /
Comments / Notifications inbox in Part 3; Admin / Community / Profile / E2E in
Part 4.

---

## 1. Overview

- **Domain:** `https://asset.labmgm.org`. API at `https://asset-api.labmgm.org`.
- **The `/about` route is the only publicly reachable page.** Everything else
  is gated behind Keycloak.
- **Roles:** Admin (bootstrapped via `admin@labmgm.org`) · Contributor (anyone
  who has published ≥ 1 asset) · User (default).
- **Internationalisation:** English + Bahasa Indonesia.

---

## 2. Prerequisites

| Tool | Version |
| ---- | ------- |
| Node | ≥ 20.x |
| pnpm | 9.x (via `corepack enable`) |
| Docker | optional — only for the build/run image |
| Backend | reachable on `NEXT_PUBLIC_API_URL`, *or* a copy of `openapi.json` next to this repo |

---

## 3. Local development

```bash
cp .env.example .env.local
pnpm install
pnpm openapi:gen   # generates src/lib/api/schema.ts
pnpm dev           # http://localhost:3000
```

If you don't have a running Keycloak instance, set
`NEXT_PUBLIC_AUTH_MOCK=true` in `.env.local` to bypass sign-in with a
synthetic admin user. **This flag is refused at boot when
`NODE_ENV=production`.** Do not ship it enabled.

The OpenAPI generator looks for the schema in this order:

1. `OPENAPI_SOURCE` env var (URL or path).
2. `../mgm-asset-library-backend/openapi.json` (sibling-repo default).
3. A copy of `openapi.json` at the repo root.

---

## 4. Auth

Authentication is delegated to Keycloak via Auth.js v5.

- Sign-in route → `/auth/signin` → Auth.js redirects to Keycloak's hosted
  login.
- The `middleware.ts` redirects every unauthenticated request to
  `/auth/signin?callbackUrl=<original>`, except the public allowlist:
  `/about`, `/auth/*`, `/api/auth/*`, `/_next/*`, `/brand/*`, `/patterns/*`,
  `/favicon*`, `/robots.txt`, `/sitemap.xml`, `/403`.
- Server helpers live in `src/lib/auth/server.ts`:
  - `getSession()` — returns the resolved session or `null`.
  - `requireSession(callbackUrl?)` — redirects to sign-in if missing.
  - `fetchMe(session)` — pulls `/auth/me` from the API.
  - `requireAdmin()` — requires session + `isAdmin`; redirects to `/403` otherwise.
- The Keycloak `access_token` is forwarded on every API call. Refresh happens
  in `callbacks.jwt` ≤ 60 s before expiry.

### Mock auth

Set `NEXT_PUBLIC_AUTH_MOCK=true` for offline development. The middleware
short-circuits, `getSession()` returns a synthetic admin user, and `fetchMe`
returns a baked-in `MeResponse` without hitting the API.

---

## Replacing the logo

The MGM mark lives at `public/brand/mgm-logo.svg`. The `<Logo>` component
references it by URL via `next/image`, so it's bundled at build time and
served from `/brand/mgm-logo.svg`. Per spec, the logo is a build-time
artifact changed by PR — there is no runtime swap and no admin upload.

To replace it:

1. Drop the new SVG at `public/brand/mgm-logo.svg`.
2. Replace `public/brand/favicon.svg` if the favicon should match.
3. Rebuild (`pnpm build` locally, or push to deploy).

The same flow applies to the 80 pattern tiles in `public/patterns/p-*.svg`
consumed by `<GeometricPattern>`.

---

## 5. Design system

All visual primitives derive from `DESIGN_SYSTEM.md`. The tokens flow as:

```
DESIGN_SYSTEM.md
    ↓ (mirrored verbatim into)
src/styles/globals.css      ← CSS custom properties (:root)
tailwind.config.ts          ← Tailwind theme.extend
    ↓ (consumed by)
src/components/ui/*         ← primitives
src/components/brand/*      ← Logo, GeometricPattern, FooterStrip
src/components/layout/*     ← Container, Navbar, Footer
```

The geometric pattern uses the 80 brand tiles in `public/patterns/`,
composed deterministically by `<GeometricPattern>` from a seed string.

Visit `/dev/components` in development to see every primitive at once.

---

## 6. i18n

Powered by [`next-intl`](https://next-intl.dev). Messages live in
`messages/{en,id}.json`. To add a locale:

1. Drop a `messages/<code>.json` file with the same key tree as `en.json`.
2. Add the code to `NEXT_PUBLIC_SUPPORTED_LOCALES`.
3. The `<LocaleSwitcher>` picks it up automatically.

Locale resolution order: `User.locale` (from `/auth/me`, set via the
switcher) → `NEXT_LOCALE` cookie → `accept-language` header →
`NEXT_PUBLIC_DEFAULT_LOCALE`.

Dates, numbers and bytes are formatted via locale-aware helpers in
`src/lib/format.ts` (`Intl.DateTimeFormat` etc.).

---

## 7. CI/CD

| Workflow | Triggers | Purpose |
| -------- | -------- | ------- |
| `.github/workflows/ci.yml` | PRs to `main` / `staging` / `production`, pushes to `main` | Lint → typecheck → test → build → OpenAPI sync check |
| `.github/workflows/deploy-staging.yml` | Push to `staging` | Build + push GHCR image (`:staging-<sha>`, `:staging-latest`), SSH deploy |
| `.github/workflows/deploy-prod.yml` | Push to `production` | Manual approval gate → build + push (`:prod-*`) → SSH deploy |
| `.github/workflows/e2e.yml` | `workflow_dispatch` (Part 4 fills it in) | Playwright suite |

`staging` and `production` should be protected branches with required PR
reviews.

---

## 8. Architecture sketch

```
app/
├── (marketing)/about               ← public, indexable
├── (app)/                          ← gated; AppLayout requires session
│   ├── page.tsx                    ← Discover placeholder (Part 2 fills it in)
│   ├── notifications/page.tsx
│   ├── library / publish / request / search / admin (Parts 2–4)
├── auth/
│   ├── signin/page.tsx             ← Server-side signIn('keycloak')
│   └── error/page.tsx
├── api/
│   ├── auth/[...nextauth]/route.ts ← Auth.js handler
│   └── me/locale/route.ts          ← Cookie + upstream PATCH
├── error.tsx · global-error.tsx · not-found.tsx · 403/page.tsx
└── dev/components/page.tsx         ← Primitive playground (non-prod)
```

Server components fetch via `apiFetch` server-side and pass primitives to
client islands. Client islands use TanStack Query for cache + revalidation.

The WebSocket connects from `WsBootstrap` inside the AppShell. The store in
`src/lib/ws/store.ts` fan-outs messages to typed handlers — Part 3 wires up
the live notification inbox on top of this.

---

## 9. Scripts

```bash
pnpm dev               # next dev
pnpm build             # next build (standalone output)
pnpm start             # serve the standalone build
pnpm lint              # next lint
pnpm typecheck         # tsc --noEmit
pnpm test              # vitest run
pnpm openapi:gen       # regenerate src/lib/api/schema.ts
pnpm openapi:check     # regenerate + git diff --exit-code
pnpm format            # prettier --write .
```

---

## 10. Docker

```bash
docker build -t mgm-asset-library-frontend:dev .
docker run --rm -p 3000:3000 --env-file .env.local mgm-asset-library-frontend:dev
```

`docker-compose.yml` expects the `mgm-asset-library` external network from
the backend's stack. Bring up the backend first, then this service.

---

## License

MIT — see `LICENSE`.
