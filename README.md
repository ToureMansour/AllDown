# AllDown

AllDown is a self-hostable media downloader: paste a public link and the extraction starts automatically. The result offers the exact source file, the best available quality, and the source audio when present. It is a real Next.js + Express application backed by `yt-dlp` and FFmpeg, not a UI mock.

- Single-page French interface with an orange/anthracite identity
- No account, no payment, no newsletter
- Paste-to-extract flow, with no separate analyze button
- Exact source format, best quality and audio choices only
- No watermark added by AllDown; a watermark already present in the source is left untouched
- Real server-side analysis and download flow
- Short-lived signed download links, temporary files deleted after sending
- Conservative platform claims: unsupported or restricted cases fail explicitly

## Platform support

| Platform | Status | What that means |
| --- | --- | --- |
| YouTube | Supported | Analyze and merged video+audio download verified against a public video |
| Generic sites | Supported | Uses yt-dlp's generic extractor; only public media it can actually parse |
| TikTok | Experimental | Public content only; depends on frequent platform changes |
| Instagram | Experimental | Public content only; private or logged-in posts are refused |
| Facebook | Experimental | Public content only; logged-in videos are refused |
| LinkedIn | Experimental | Some posts require authentication and cannot be processed |

AllDown does not bypass DRM, logins, paywalls, age gates, geo-restrictions, or private content. Playlists and live streams are not supported. A format is only offered after a fresh metadata analysis.

## Architecture

```
apps/
  api/                 Express 5 + TypeScript, yt-dlp/FFmpeg engine
    src/                HTTP, validation, security, media services
    scripts/            Pinned engine installer and real-engine check
    bin/                Downloaded yt-dlp binary (gitignored)
    tests/              Vitest + Supertest
  web/                 Next.js 16 App Router, Tailwind CSS 4
    app/                Home, legal pages, metadata routes
    components/         UI and client-side download flow
    lib/                API client, validation, formatting
    tests/              Vitest + Testing Library
render.yaml            Render Docker blueprint for the API
```

Requirements:

- Node.js 20.9 or newer
- Network access to GitHub for the pinned yt-dlp release
- FFmpeg, or the optional `ffmpeg-static` package installed with npm

## Quick start

```bash
npm install
npm run setup:engine
```

The engine script downloads the pinned `yt-dlp` release for your OS/architecture, verifies its SHA-256 checksum against the release manifest, and prints the installed version. The binary lands in `apps/api/bin/` and is not committed.

Create local environment files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

On PowerShell, use `Copy-Item` instead of `cp`. The API defaults work locally even without a `.env`, but an explicit file is recommended.

Start both applications:

```bash
npm run dev
```

- Web: <http://localhost:3000>
- API: <http://localhost:4000>
- Health: <http://localhost:4000/health>

### FFmpeg

YouTube commonly exposes separate video-only and audio-only streams. Merging them into one MP4/WebM requires FFmpeg.

- `npm install` may install the optional `ffmpeg-static` binary automatically.
- If install scripts are blocked or the binary is missing, install FFmpeg system-wide so `ffmpeg` is on `PATH`, or set `FFMPEG_PATH` in `apps/api/.env`.
- Without FFmpeg, already-combined formats and audio remain available, but merged video options are omitted and the UI shows a warning.

## Environment

### API (`apps/api/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | HTTP port |
| `NODE_ENV` | `development` | `development`, `production`, or `test` |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | Comma-separated exact CORS origins |
| `TRUST_PROXY` | `0` | Reverse proxy hops; use `1` behind Render/Vercel-style proxies |
| `LOG_LEVEL` | `info` | Pino log level |
| `MAX_DOWNLOAD_SIZE_MB` | `200` | Maximum generated file size |
| `DOWNLOAD_TIMEOUT_SECONDS` | `300` | yt-dlp download timeout |
| `ANALYZE_TIMEOUT_SECONDS` | `45` | yt-dlp metadata timeout |
| `MAX_CONCURRENT_DOWNLOADS` | `2` | Simultaneous download processes |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window |
| `RATE_LIMIT_MAX_REQUESTS` | `30` | Requests per IP and window |
| `TEMP_DIR` | OS temp dir | Writable local directory for transient files |
| `YTDLP_PATH` | auto-detect | Override the yt-dlp executable |
| `FFMPEG_PATH` | auto-detect | Override the FFmpeg executable |
| `ALLOWED_DOWNLOAD_HOSTS` | empty | Optional comma-separated host allowlist |
| `DOWNLOAD_SIGNING_SECRET` | random in dev | Required in production, minimum 32 characters |
| `YTDLP_VERSION` | `2026.10.26` | Pinned version used by the install script |

Generate a production secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Production startup is refused when `DOWNLOAD_SIGNING_SECRET` is missing/weak or `FRONTEND_ORIGIN` still points only at localhost.

### Web (`apps/web/.env.local`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000` | Public API origin, no trailing slash |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical site URL for sitemap/robots |
| `NEXT_PUBLIC_CONTACT_EMAIL` | empty | Optional contact address shown in the footer and legal pages |

Never point `NEXT_PUBLIC_API_BASE_URL` at localhost in production.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run API and web with watch mode |
| `npm run build` | Build API (`tsup`) then web (`next build`) |
| `npm run start` | Start both production builds |
| `npm run lint` | ESLint for both workspaces |
| `npm run typecheck` | TypeScript for both workspaces |
| `npm test` | API and web test suites |
| `npm run verify` | Lint, typecheck, tests, then both builds |
| `npm run setup:engine` | Download/verify pinned yt-dlp |
| `npm run verify:engine` | Analyze and download a real public video |

Force a fresh binary download or verify another URL:

```bash
node apps/api/scripts/install-ytdlp.mjs --force
npm run verify:engine -w @alldown/api -- --analyze-only
npm run verify:engine -w @alldown/api -- "https://www.youtube.com/watch?v=aqz-KE-bpKQ"
```

The real-engine command downloads a small real file by default and deletes it afterwards. It is intentionally separate from `npm test`, which uses fakes and never needs the network.

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Engine and process health (`503` when yt-dlp is missing) |
| `GET` | `/api/v1/platforms` | Platform registry plus real engine status |
| `POST` | `/api/v1/media/analyze` | Validate URL, analyze source, return allowed formats |
| `POST` | `/api/v1/media/download` | Re-validate the selected format and issue a signed URL |
| `GET` | `/api/v1/media/file/:token` | Re-analyze, download to a temp dir, stream, clean up |

The download endpoint does not stream immediately. It returns a short-lived HMAC-signed URL (`5` minutes). Opening that URL re-analyzes the media and downloads the exact previously validated format, so a client cannot forge arbitrary yt-dlp selectors.

Successful JSON responses use `{ "ok": true, "data": ... }`; failures use `{ "ok": false, "error": { "code", "message" }, "requestId" }`.

Health check:

```bash
curl http://localhost:4000/health
```

## Tests and verification

```bash
npm run verify
```

The suite covers URL safety (private IPv4/IPv6, metadata hosts, ports, allowlists), format construction and validation, signed tickets, API integration with a fake runner, temporary-file cleanup, the frontend API client flow, validation, formatting, and retry states.

## Deployment

This project keeps the frontend and media API separate. Deploy the Next.js frontend to Vercel and the persistent Express/yt-dlp API to Render; do not run the API or yt-dlp in Vercel serverless functions. No production deployment has been performed by this repository setup. Replace every `<...>` value below with the real provider URL after creating the service.

### 1. Connect the Git repository

1. Make sure the project and deployment configuration are committed and pushed to the GitHub repository `ToureMansour/AllDown`. Vercel and Render can only deploy commits that have been pushed.
2. Sign in to the Vercel account that should own the site. Choose **Add New → Project**, connect GitHub if prompted, and import `ToureMansour/AllDown`. Set its root directory to `apps/web` and note the Vercel project domain for the CORS setting.
3. In Render, choose **New → Blueprint**, connect the same GitHub repository, and select its `render.yaml`.
4. Configure both providers to deploy the intended production branch. Review changes before merging or pushing to that branch; both configurations enable automatic deploys.

### 2. Deploy the API on Render

The root `render.yaml` defines a Docker web service, builds with `apps/api/Dockerfile` from the repository root, checks `/health`, and asks Render to generate `DOWNLOAD_SIGNING_SECRET`. Do not add a fixed `PORT`: Render supplies the port, and the API reads it from the environment.

1. Create the Blueprint and review its `alldown-api` service.
2. Set `FRONTEND_ORIGIN` to the exact Vercel origin once it is known, for example `https://<VERCEL_PROJECT_DOMAIN>` (scheme included; no path or trailing slash). It is required and is used by CORS.
3. Keep `NODE_ENV=production`, `TRUST_PROXY=1`, and the generated signing secret. Render's managed HTTPS endpoint is used; `/tmp/alldown` remains temporary local disk.
4. Deploy the API. The Docker build needs outbound access to GitHub to download the pinned yt-dlp binary and its checksum. FFmpeg is installed in the image.
5. Copy the actual public API origin from the Render service dashboard; it will be used as `NEXT_PUBLIC_API_BASE_URL` in Vercel.

The Blueprint selects Render's `starter` instance; check its current resource limits and upgrade the instance if it cannot support the workload. For production traffic, target at least 2 GB RAM and enough CPU for yt-dlp/FFmpeg. Start with `MAX_CONCURRENT_DOWNLOADS=1` and `MAX_DOWNLOAD_SIZE_MB=200`; lower concurrency/size if memory, temporary disk, bandwidth, or timeouts are constrained. Increase them only after monitoring real usage. Downloads use temporary local disk and are removed after the response, so allow free space for concurrent files and do not use a network share. A free instance may sleep or cold-start and is not recommended for dependable downloads. Render manages service restarts; `/health` is the configured readiness check.

### 3. Deploy the frontend on Vercel

The Vercel project configuration is in `apps/web/vercel.json`; it installs the monorepo lockfile from the repository root and builds only the web workspace.

1. Set **Root Directory** to `apps/web`; `apps/web/vercel.json` selects the Next.js framework. Enable **Include source files outside of the Root Directory** so the root package manifest and lockfile are available to the build commands.
2. In **Build & Development Settings**, use the configured install/build commands from `vercel.json` (or these exact commands):
   - Install: `cd ../.. && npm ci`
   - Build: `cd ../.. && npm run build -w @alldown/web`
3. Add these Production environment variables before deploying:
   - `NEXT_PUBLIC_API_BASE_URL=https://<RENDER_API_DOMAIN>` — the real Render API origin, with no trailing slash.
   - `NEXT_PUBLIC_SITE_URL=https://<VERCEL_PROJECT_DOMAIN>` — the real Vercel site origin.
   - `NEXT_PUBLIC_CONTACT_EMAIL=<OPTIONAL_CONTACT_EMAIL>` — optional; omit to hide contact information.
4. Deploy the project and note its actual Vercel domain. Do not leave placeholder values in environment settings.
5. Set the Render service's `FRONTEND_ORIGIN` to that exact Vercel origin and redeploy the API if needed.
6. If a `NEXT_PUBLIC_*` value changes, trigger a new Vercel build; these variables are embedded at build time.

### Docker API (local verification or VPS image)

Build from the repository root so the monorepo lockfile and workspaces are available:

```bash
docker build -f apps/api/Dockerfile -t alldown-api .
docker run --rm -p 4000:4000 \
  -e PORT=4000 \
  -e NODE_ENV=production \
  -e FRONTEND_ORIGIN=https://<VERCEL_PROJECT_DOMAIN> \
  -e DOWNLOAD_SIGNING_SECRET="<GENERATE_A_SECRET_OF_AT_LEAST_32_CHARACTERS>" \
  alldown-api
```

The image uses Debian slim, installs FFmpeg, downloads the pinned yt-dlp Linux binary during the build (with SHA-256 verification), runs as the non-root `node` user, and has a Docker health check that follows `PORT`. Override the engine version at build time with `--build-arg YTDLP_VERSION=<YYYY.MM.DD>`. The application health endpoint is `http://localhost:4000/health`.

### VPS alternative

Use the same Docker image and required production environment variables above, but publish it only on a private/local interface behind a reverse proxy. Terminate HTTPS at Caddy, Nginx, or an equivalent proxy; forward the original `Host` and `X-Forwarded-For` headers, set `TRUST_PROXY=1` for one trusted proxy, and restrict direct access to the API port. Persist neither media nor `/tmp/alldown`; ensure its local disk has space for active downloads. Configure the container manager (for example Docker restart policy `unless-stopped` or a systemd unit) to restart the service after failure/reboot, and monitor `/health`. Install Docker Engine and its Compose plugin from the official instructions for the chosen VPS OS; the image supplies Node.js 22, yt-dlp, and FFmpeg.

### Post-deployment checks

Use the actual URLs assigned by the providers in place of placeholders:

```text
GET  https://<RENDER_API_DOMAIN>/health
GET  https://<RENDER_API_DOMAIN>/api/v1/platforms
GET  https://<VERCEL_PROJECT_DOMAIN>/
```

- `/health` returns HTTP 200 and reports yt-dlp available; confirm FFmpeg is available if merged video formats are expected.
- The Vercel page loads over HTTPS. In browser developer tools, analyze a public URL and confirm API requests go to the Render origin, not `localhost`.
- Confirm there are no CORS errors. `FRONTEND_ORIGIN` must exactly match the browser's site origin, including `https://` and excluding any path.
- Complete one small authorized public-media download and confirm the browser receives a file. Then inspect Render logs for errors and confirm temporary files are cleaned up.
- Test an unavailable or restricted source and confirm the UI shows an explicit error rather than a false success.
- Verify automatic deploys are tied to the intended Git branch, and monitor health checks, memory, CPU, temporary disk, timeouts, and rate limits after launch.

## Production checklist

- HTTPS is terminated by your platform or reverse proxy.
- `DOWNLOAD_SIGNING_SECRET` is at least 32 random characters and is not committed.
- `FRONTEND_ORIGIN` contains only real deployed web origins, with no trailing slash.
- `TRUST_PROXY=1` behind a single proxy; `0` when clients connect directly.
- `MAX_DOWNLOAD_SIZE_MB` and timeouts fit your instance disk, bandwidth, and plan.
- `TEMP_DIR` points to writable local storage with enough free space.
- Outbound network access to media platforms and GitHub (at image build) is available.
- `/health` is monitored, including the `ffmpeg` check.
- You review the source platform's terms and applicable copyright law.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `ENGINE_UNAVAILABLE` / health `503` | Run `npm run setup:engine`; in Docker rebuild the image with network access |
| Merged video formats missing | Install FFmpeg or set `FFMPEG_PATH`; restart the API |
| `MEDIA_RESTRICTED` (`403`) | Public/login-free content only; AllDown will not bypass access controls |
| `ENGINE_TIMEOUT` | The source is slow; retry later or raise `ANALYZE_TIMEOUT_SECONDS` |
| `DOWNLOAD_BUSY` | Lower traffic or raise `MAX_CONCURRENT_DOWNLOADS` on a larger instance |
| Download URL expires | The signed link lasts 5 minutes; run the download action again |
| CORS error in the browser | Use the exact web origin in `FRONTEND_ORIGIN`, with no path or trailing slash |

## Legal

Use AllDown only for content you own, content in the public domain, content explicitly licensed for download, or content you are otherwise authorized to copy. You are responsible for complying with source-platform terms and copyright law. AllDown does not host media, does not keep a durable copy, and does not bypass technical protection measures. AllDown does not add a watermark to downloaded files, but it cannot remove a watermark that is already encoded in the source media.
