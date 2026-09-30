# Thunder Buddies Studios

A separate studio website inspired by the dark palette, brass accents, typography, and emblem in [spdash](https://github.com/the-guy-from-arma/spdash). The Pacific Fleet project and its backend are not part of this application.

## Included

- Four selectable entrances with individual profiles: Roblox, OSAL, Thunderlink, and Faultline.
- Nine-developer studio introduction and services for Unreal Engine, Unity, Godot, Enfusion, Roblox, and the web.
- Three-step request form with validation, review, consent, submission receipt, retry protection, and a private inbox at `/admin`.
- Installable PWA with 192/512 PNG icons and offline public content. Private requests and the admin inbox never enter the service-worker cache.
- Dependency-free Node 24 server, Dockerfile, Railway config, health endpoint, and integration tests.

## Local development

Run `node server.mjs`, then visit `http://localhost:8080`. Choose another `PORT` if that port is in use. No package installation or build step is needed.

To test the inbox, copy `.env.example` to `.env`, set an absolute `REQUEST_DATA_DIR` and a randomly generated `ADMIN_TOKEN` of at least 32 characters, and run `node --env-file=.env server.mjs`. A token can be generated with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep it in your password manager. Never commit it.

Run tests with `node --test test/*.test.mjs` (or `npm test`). Tests use temporary directories and do not contact customers or external services.

## Railway deployment

1. Create a Railway service from this GitHub repository; use the repository root. Railway builds the root Dockerfile.
2. Add a persistent volume mounted at `/data`. Use one service replica; this application uses a local durable inbox.
3. Add `REQUEST_DATA_DIR=/data`, `ADMIN_TOKEN=<random secret of 32+ characters>`, and `PUBLIC_ORIGIN=https://your-public-domain` in Railway Variables. Do not include a trailing slash in the origin. `NODE_ENV=production` is already set by Docker. Railway provides `PORT`.
4. Generate a public domain and set `PUBLIC_ORIGIN` to that exact HTTPS origin. If using a custom domain, update the origin accordingly.
5. Deploy and open `/health`, the four profiles, and `/admin`. Use the admin token to read requests. The token stays in memory during the request and is not saved to browser storage.
6. Configure Railway volume backups and a retention process appropriate to the studio. Avoid multiple writers/replicas against the local inbox. For a larger service, move requests and rate limits to a shared database.

The public site works without inbox configuration, but submissions return an explicit unavailable message until durable storage, admin access, and the production origin are configured. It never displays a false success. Requests currently go to the private inbox, **not email**; email delivery is not configured.

Railway references: [Dockerfiles](https://docs.railway.com/builds/dockerfiles), [Volumes](https://docs.railway.com/volumes).

## Content editing

Edit `public/content.json` for profile copy, tags, links, and detail sections. The OSAL address and Thunderlink address are connected. The Discord address and emblem come from spdash.

Roblox project names/play links and Faultline gameplay details/media have not yet been supplied. Their profiles deliberately avoid invented releases, player numbers, testimonials, or screenshots. The panel visuals are abstract CSS artwork, not gameplay captures. Replace or extend these profiles with approved material before promoting specific titles.

The site has no advertising analytics, external fonts, third-party scripts, or automatic email notifications. The public privacy page describes what the request flow actually stores. Revisit it if integrations change.

## Structure

```text
server.mjs              Static server, submission API, authenticated inbox API
public/index.html       Studio, project shell, request wizard, privacy
public/styles.css       Responsive layout and abstract panel artwork
public/app.js           Profile navigation, request flow, install support
public/content.json     Editable project information
public/admin.html       Private inbox interface
public/admin.js         In-memory token authentication
public/sw.js            Public-only offline cache
test/server.test.mjs    Storage, validation, security boundaries, PWA resources
```

Increase the service-worker cache version when changing the offline asset list. Server content uses revalidation and the worker fetches fresh public content when online.

## Attribution

Studio identity and `public/assets/emblem.svg` originate in the user-supplied spdash project. This repository does not grant a new license to that identity, to project IP, or to third-party game brands.
