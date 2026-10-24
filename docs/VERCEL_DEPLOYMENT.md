# Deploying CFMS Study Hub to Vercel

The Vercel target builds the Next.js + Firebase study app independently of Figma's managed Payload backend. `vercel.json` selects `pnpm run build:vercel` and `.next-vercel`. The Make/Payload files and lifecycle scripts remain available for Make; no Firebase records are migrated or reseeded by this build.

## Vercel settings

- Import the existing Git repository with the **Next.js** framework preset and the repository root as Root Directory.
- Use Node.js **24.x**. The repository pins pnpm **10.34.3** through `packageManager`.
- Use the checked-in `vercel.json` build/output settings. Do not use `payload build` for this target.
- Configure the environment variables below in Vercel Project Settings before redeploying. Local `.env` is Git-ignored and is not automatically uploaded by a Git deployment.

### Public Firebase configuration

Copy the Firebase web app configuration into these intentionally browser-visible variables:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_DATABASE_URL
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID (optional)
NEXT_PUBLIC_SITE_URL (optional; the Vercel URL is used by default)
```

Use a separate Firebase project for a preview environment when isolation is required. Add the deployed hostname to Firebase Authentication's authorized domains. Public configuration is embedded at build time; changing it requires a new deployment.

### Trusted server identity

The browser configuration does not authorize session saves or administrator operations. The production APIs require Firebase Admin credentials for the same project.

On Vercel, the app supports **`FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`** as a private environment variable containing the complete service-account JSON. Provision it directly through Vercel's secure environment settings, scoped to the intended environment. Never prefix it with `NEXT_PUBLIC_`, paste it into chat, commit it, or place it in a public file. The app rejects a credential whose project differs from `NEXT_PUBLIC_FIREBASE_PROJECT_ID` and returns sanitized configuration errors.

Existing Application Default Credentials remain supported, including an externally configured workload identity. `CFMS_USE_FIREBASE_CLI` is a development-only web-server fallback and is not a Vercel production credential. Do not add dummy `FIGMA_EID`, Payload secrets, or Make backend variables to resolve the old build failure.

Missing server credentials can allow the UI/login to render while authenticated saves fail. Configure the identity before considering the deployed system usable.

## Build and check locally

```powershell
pnpm install
pnpm run build:vercel
$env:PORT = '3100'
pnpm run start:vercel
```

The standalone build uses webpack, checks TypeScript, writes `.next-vercel`, and verifies that every file in the production server traces actually exists. Missing files fail the build before Vercel packaging. The local Make development cache remains separate. Stop the temporary production server with Ctrl+C after checking it.

`scripts/prepare-vercel.mjs` creates a Git-ignored root `app/` directory containing conventional `page.tsx`, `layout.tsx`, and `route.ts` entry points that re-export the real frontend and four `/api/study/*` implementations from `src/`. Next prioritizes this root app directory for Vercel. Custom page extensions are not used: they caused API traces to reference absent `route_client-reference-manifest.js` files during Vercel packaging.

The generated directory has an ownership marker and file allowlist. Ordinary Make development/build commands remove only that generated directory and use the original `src/app/` tree; an unowned directory, edited entry point, unexpected file or symlink is preserved and causes a clear error. Legacy generated suffix entry points are removed only when their content matches the previous generator. No Payload-managed source is edited or moved.

UI and API implementations remain shared, so there is no second copy of the study app to maintain. `/study-admin` is included; Figma's `/admin` and Payload APIs are not part of the standalone deployment. Use the repository's build/start/dev scripts so each target selects the correct entry points.

After pushing the changes and deploying, check login, password reset, custom question selection, a saved/resumed/submitted session, results, and administrator authorization. A passing local production build does not prove that the remote environment has credentials or that a deployment succeeded.

## Existing shared database rules

This deployment change does not modify the shared Firebase database or its rules. The previously observed permissive root rules remain a separate issue: API checks cannot block direct database access under broad root grants. Follow the reviewed merge process in [Firebase operations](../FIREBASE.md) before treating the live database as protected.
