# Deployment (Docker + Nginx + Django Channels)

This repo ships a production-friendly Docker Compose setup that runs:
- React/Vite frontend (built into the `web` image)
- Django + DRF + MongoEngine backend (ASGI via Uvicorn)
- WebSockets via Django Channels (`/ws/live/`)
- Redis (Channels layer)
- MongoDB (local container; swap to Atlas in production)

## 0) Free hosting option: Oracle Cloud Always Free (recommended)

If you want **always-on** hosting for $0/month, Oracle Cloud’s **Always Free** tier is the closest to a free VPS.

High-level flow:
- Create an Ubuntu VM (Always Free)
- Open ports `80` and `443`
- Install Docker + Git
- Clone this repo
- Run Docker Compose

Important notes:
- HTTPS (Let’s Encrypt) requires a **domain name** (an IP address alone won’t get a public TLS cert).
- You can deploy first using **HTTP on the VM IP**, then add a domain later.

Oracle Cloud signup/console:
- https://www.oracle.com/cloud/free/

## Alternative: AWS Free Tier (12 months) + MongoDB Atlas (managed)

If you’re okay with **free for 12 months**, AWS Free Tier is a good beginner path.
Recommended approach:
- Host the app on an **EC2 Ubuntu** VM (t3.micro/t2.micro)
- Use **MongoDB Atlas** free M0 as your database (managed)
- Keep Redis in Docker (simple) or replace later with a managed Redis

AWS Free Tier:
- https://aws.amazon.com/free/

MongoDB Atlas free tier:
- https://www.mongodb.com/atlas/database

## 1) Prerequisites (server)

- Linux VPS (Ubuntu 22.04+ recommended)
- Docker + Docker Compose plugin installed
- A domain pointing to your server IP

If you don’t have a domain yet:
- You can deploy over `http://<server-ip>` first (works, including WebSockets via `ws://`).
- Add a domain later to enable HTTPS/WSS.

If you deploy on AWS:
- Prefer allocating an **Elastic IP** so your server IP doesn’t change.

## 2) Configure backend environment

Copy and edit the backend env file:

- Copy: `backend/.env.example` → `backend/.env`
- Set at minimum:
  - `SECRET_KEY`
  - `DEBUG=False`
  - `ALLOWED_HOSTS=yourdomain.com`
  - `FRONTEND_BASE_URL=https://yourdomain.com`
  - `MONGODB_URI` (use Atlas in production if possible)
  - SMTP vars (`EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`, etc.)

Notes:
- If you run multiple backend instances, Redis must be enabled (`REDIS_URL`).
- WebSockets endpoint is `/ws/live/?token=...`.
- The backend container runs `migrate` and `collectstatic` on startup.

## 3) Start production stack

From repo root:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

If you don’t have a domain yet, this is the simplest first deploy.
Visit:
- `http://<server-ip>/`

If you use the bundled Mongo container, Compose already sets:
- `MONGODB_URI=mongodb://mongo:27017/splitwise`
- `MONGODB_DB_NAME=splitwise`

To create an admin user:

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

Check logs:

```bash
docker compose -f docker-compose.prod.yml logs -f --tail=200
```

## 4) Frontend env (Vite)

Frontend build in `deploy/nginx/Dockerfile` uses `frontend/.env.*` at build time.
For production you typically want:

- `VITE_API_BASE_URL=https://yourdomain.com`
- Optionally `VITE_WS_BASE_URL=wss://yourdomain.com`

If you need build-time env, create `frontend/.env.production` before building.

## 5) HTTPS

The provided Nginx container (`web`) listens on port 80 inside Docker.

### Option A: Cloudflare proxy (easy)

Cloudflare can serve HTTPS publicly while your stack runs on port 80.

### Option B: Host-level HTTPS (Caddy + Let’s Encrypt)

This repo includes a Caddy Compose override that:
- binds ports `80` and `443` on the server
- provisions/renews Let’s Encrypt certificates automatically
- reverse-proxies to the existing `web` (Nginx) container

Setup:

1) Copy [deploy/caddy/.env.example](deploy/caddy/.env.example) to `deploy/caddy/.env` and set:
  - `DOMAIN=yourdomain.com, www.yourdomain.com` (or only `yourdomain.com`)
  - `ACME_EMAIL=you@example.com` (recommended)

2) Start with both compose files:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.https.yml --env-file deploy/caddy/.env up -d --build
```

This will serve the site at `https://yourdomain.com` and WebSockets will work as `wss://yourdomain.com/ws/live/?token=...`.

## 8) No-domain → domain (recommended: DuckDNS)

If you don’t want to buy a domain immediately but still want HTTPS, you can use a free dynamic DNS domain.
One beginner-friendly option is DuckDNS:

- https://www.duckdns.org/

Steps:
- Create a subdomain (example: `yourapp.duckdns.org`)
- Set its IP to your server’s public IP
- Use that as:
  - `DOMAIN=yourapp.duckdns.org` in `deploy/caddy/.env`
  - `ALLOWED_HOSTS=yourapp.duckdns.org` in `backend/.env`
  - `FRONTEND_BASE_URL=https://yourapp.duckdns.org` in `backend/.env`
  - `VITE_API_BASE_URL=https://yourapp.duckdns.org` in `frontend/.env.production`
  - `VITE_WS_BASE_URL=wss://yourapp.duckdns.org` in `frontend/.env.production`

Then redeploy with HTTPS:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.https.yml --env-file deploy/caddy/.env up -d --build
```

## 9) Using managed MongoDB (MongoDB Atlas)

This repo can run MongoDB either:
- as a local Docker container (`mongo` service in Compose), or
- as a managed MongoDB (recommended for small VPS and beginners).

### 9.1 Create an Atlas cluster (free)

1) Create Atlas account and project
2) Create a free **M0** cluster
3) Create a database user (username/password)
4) Network Access:
  - Recommended: add your server’s public IP
  - Quick test only: `0.0.0.0/0` (not recommended long-term)
5) Get the connection string (SRV) like:
  - `mongodb+srv://<user>:<pass>@<cluster-host>/splitwise?retryWrites=true&w=majority`

### 9.2 Configure backend env

In `backend/.env` set:
- `MONGODB_URI=mongodb+srv://...`
- `MONGODB_DB_NAME=splitwise`

### 9.3 Run Compose without the local mongo container

Use the managed-mongo override:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.managed-mongo.yml up -d --build
```

If you also use Caddy HTTPS:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.managed-mongo.yml -f docker-compose.https.yml --env-file deploy/caddy/.env up -d --build
```

## 6) MongoDB in production

For production, prefer MongoDB Atlas:
- Set `MONGODB_URI=mongodb+srv://...`
- Remove/disable the `mongo` service in `docker-compose.prod.yml` (or keep it only for local).

## 7) WebSockets

Nginx proxies `/ws/` with Upgrade headers.
If you use TLS, WebSockets automatically become `wss://`.
