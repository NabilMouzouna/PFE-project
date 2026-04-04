# Run AppBase locally with Docker (plug & play)

This image runs **two processes** in one container:

| Service   | Port (default) | URL                    |
| --------- | -------------- | ---------------------- |
| API       | `8000`         | http://localhost:8000  |
| Dashboard | `3001`         | http://localhost:3001  |

Data (SQLite + file storage) lives in a Docker volume at `/app/data` inside the container.

The runtime image is kept small: the API is shipped as a **production-only `pnpm deploy` bundle** under `/app/api-bundle`, and the dashboard is the **Next.js standalone** output only (not the full monorepo or dev tooling).

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed and running
- A clone of this monorepo (only needed **to build** the image; running the image does not require Node or pnpm)

---

## 1. Build the image

From the **monorepo root** (directory that contains `Dockerfile`):

```bash
docker build -t appbase:local .
```

Or, if you use pnpm from the repo:

```bash
pnpm docker:build
```

(`pnpm docker:build` tags `appbase:latest` — use that name in the run commands below if you prefer.)

---

## 2. Run the container (minimal)

**Required in production mode:** `AUTH_SECRET` must be at least **32 characters**.

```bash
docker run --rm \
  -p 8000:8000 \
  -p 3001:3001 \
  -e AUTH_SECRET='replace-with-your-own-secret-at-least-32-chars' \
  -v appbase-data:/app/data \
  appbase:local
```

Then open:

- Dashboard: http://localhost:3001  
- API: http://localhost:8000  

Stop with `Ctrl+C` (or `docker stop` from another terminal).

---

## 3. Run with an env file (recommended)

1. Copy the example env file (from the monorepo root):

   ```bash
   cp appbase.env.example my-appbase.env
   ```

2. Edit `my-appbase.env` — at minimum set a strong `AUTH_SECRET`.

3. Run:

   ```bash
   docker run --rm \
     -p 8000:8000 \
     -p 3001:3001 \
     --env-file my-appbase.env \
     -v appbase-data:/app/data \
     appbase:local
   ```

Defaults inside the image already set `API_BASE_URL=http://127.0.0.1:8000` so the dashboard can reach the API in the same container. Change `BASE_URL` / `CORS_ORIGINS` when you put a reverse proxy or a public hostname in front (see comments in `appbase.env.example`).

---

## 4. Optional: custom ports

```bash
docker run --rm \
  -p 8080:8000 \
  -p 3002:3001 \
  -e AUTH_SECRET='replace-with-your-own-secret-at-least-32-chars' \
  -e API_BASE_URL='http://127.0.0.1:8000' \
  -v appbase-data:/app/data \
  appbase:local
```

- Host: **8080** → API, **3002** → dashboard.  
- Keep `API_BASE_URL` as **`http://127.0.0.1:8000`** (inside the container the API still listens on `8000`).

---

## 5. Share the image without the monorepo

On the machine where you built:

```bash
docker save appbase:local -o appbase-local.tar
```

On another machine (Docker only):

```bash
docker load -i appbase-local.tar
docker run --rm -p 8000:8000 -p 3001:3001 \
  -e AUTH_SECRET='replace-with-your-own-secret-at-least-32-chars' \
  -v appbase-data:/app/data \
  appbase:local
```

---

## Troubleshooting

| Issue | What to check |
| ----- | ------------- |
| `AUTH_SECRET` error on start | Use a value **≥ 32 characters** in production (`NODE_ENV=production` in the image). |
| Port already in use | Change host ports, e.g. `-p 18000:8000 -p 13001:3001`. |
| Dashboard cannot reach API | In the default setup, do not change `API_BASE_URL` unless you know the in-container API URL/port. |
| Reset data | Use a new volume name instead of `appbase-data`, or remove the volume (this **deletes** DB and storage). |

---

## Related files

- `Dockerfile` — image definition  
- `docker/entrypoint.sh` — starts API then dashboard  
- `appbase.env.example` — env template for `--env-file`  
