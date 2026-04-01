# Publishing `@appbase-pfe/types` and `@appbase-pfe/sdk` to npm

This document matches [ADR-007](./adr/ADR-007-sdk-package-distribution.md) and [TICKET-012](../tasks/TICKET-012-sdk-npm-publish-readiness.md).

## Scope and org

- **Published scope:** **`@appbase-pfe`** — packages **`@appbase-pfe/types`** and **`@appbase-pfe/sdk`** (`@appbase` was unavailable on npm).
- Confirm the **`appbase-pfe`** organization exists on [npmjs.com](https://www.npmjs.com/) and your account has **publish** rights before releasing.

**This repo’s metadata** currently points at  
`https://github.com/NabilMouzouna/NubleCloud-PFE`  
with package `directory` fields `packages/types` and `packages/sdk`.

## What a user installs

Tarballs ship **compiled `dist/`** only (no `src/`, no tests). Entry points are defined in `package.json` **`exports`**.  
Built output uses **NodeNext**-style **`.js` extensions** on relative imports so **`node`** can load the package as ESM without a bundler (bundlers still work as usual).  
In the monorepo, the SDK depends on **`@appbase-pfe/types`** via **`workspace:^0.1.0`** so installs work before types is on npm. **`pnpm publish`** rewrites that to a plain semver range (e.g. **`^0.1.0`**) in the tarball—verify with `pnpm pack` / `pnpm publish --dry-run`.

## Local monorepo

- After `pnpm install`, **root `postinstall`** runs `turbo run build --filter=@appbase-pfe/sdk`, which builds **`@appbase-pfe/types`** then **`@appbase-pfe/sdk`** (`^build` order).
- Apps still use **`workspace:*`** for local linking; only **published** tarballs use semver.

## Verify with pack (recommended before first publish)

From the monorepo root:

```bash
pnpm --filter @appbase-pfe/types run build
pnpm --filter @appbase-pfe/types pack --pack-destination /tmp/appbase-pack
tar -tf /tmp/appbase-pack/appbase-types-*.tgz | head -50
```

Confirm the archive contains `package.json`, `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md` — **no** `src/`, **no** `.env`.

Repeat for the SDK:

```bash
pnpm --filter @appbase-pfe/sdk run build
pnpm --filter @appbase-pfe/sdk pack --pack-destination /tmp/appbase-pack
tar -tf /tmp/appbase-pack/appbase-sdk-*.tgz | head -50
```

Dry-run publish:

```bash
pnpm --filter @appbase-pfe/types publish --dry-run --no-git-checks
pnpm --filter @appbase-pfe/sdk publish --dry-run --no-git-checks
```

## Manual first publish (order matters)

1. Bump versions in `packages/types/package.json` and `packages/sdk/package.json` (and align `@appbase-pfe/types` range in the SDK if you major/minor bump types).
2. Update changelogs.
3. Log in: `npm login` (2FA / automation token per org policy).
4. Publish types, then SDK:

```bash
pnpm --filter @appbase-pfe/types publish --access public --no-git-checks
pnpm --filter @appbase-pfe/sdk publish --access public --no-git-checks
```

`prepublishOnly` runs **`check-types` + `build`** for types and **`test` + `build`** for the SDK.

**Do not publish the SDK before `@appbase-pfe/types`** — the published tarball lists `@appbase-pfe/types` as a normal dependency; npm clients will 404 until that package exists on the registry.

## Troubleshooting

### `E403` — “Two-factor authentication or granular access token with bypass 2fa enabled is required”

npm blocks **`npm publish`** unless publishing is allowed under your account security settings.

**Option A — Interactive publish (browser login)**  
1. On [npmjs.com](https://www.npmjs.com/) go to **Account → Profile → Two-Factor Authentication**.  
2. Enable **2FA** (recommended: **Authorization and publishing**).  
3. Run **`npm login`** again if needed, complete the OTP when publishing.

**Option B — Automation token (CI / CLI without OTP each time)**  
1. **Account → Access Tokens → Generate New Token → Granular Access Token** (or **Classic** → type **Automation** if your plan still offers it).  
2. Grant **read and write** for the packages (or org) you publish.  
3. For granular tokens, enable the option that allows **publishing** under your org’s 2FA policy (npm may label this as bypassing 2FA for that token — treat the token like a password).  
4. Publish with:  
   `NPM_TOKEN=npm_xxxxx pnpm --filter @appbase-pfe/types publish --access public --no-git-checks`  
   (same for `@appbase-pfe/sdk`), or add the token to **`~/.npmrc`** as `//registry.npmjs.org/:_authToken=...` only on a secure machine.

After 2FA is enabled, a plain **`npm login`** session is often enough for local **`npm publish`**.

## CI: tag-driven publish

Workflow: [`.github/workflows/publish-sdk.yml`](../.github/workflows/publish-sdk.yml) runs on tags `sdk-v*` (example: `sdk-v0.1.0`).

Configure a repository secret **`NPM_TOKEN`** (automation access token or OIDC setup per [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)).

Maintainer checklist:

1. Commit version bumps on `main`.
2. `git tag sdk-v0.1.0 && git push origin sdk-v0.1.0`
3. Confirm both packages appear on the registry.

## Smoke test outside the monorepo

```bash
mkdir /tmp/appbase-sdk-smoke && cd /tmp/appbase-sdk-smoke
npm init -y
npm install /path/to/appbase-sdk-0.1.0.tgz
```

Then TypeScript or Node + a bundler: `import { AppBase } from "@appbase-pfe/sdk"`.
