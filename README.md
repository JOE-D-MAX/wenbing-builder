# Wenbing Builder

A modular website builder with one-click website creation.

## New: One-click website creation

Create 1–10 editable pages in one click.

## Blocks

Background surfaces, navigation, hero, text, image cards, accordion lists, action sections, and large signature text. Drop one on the canvas and click to edit it. Drag to reorder within a page, undo when you change your mind.

## Effects that stay on their block

Cursor glow, scroll reveal, image zoom, star drift, video backgrounds. Each one attaches to a block instead of the whole page, so adding a second effect doesn't overwrite the first. All of them back off when the system asks for reduced motion.

## Chinese and English

The interface switches language; the content you wrote stays as you wrote it.

## Deploy where you want

A Docker Compose file with Caddy handling TLS, or the Render blueprint if you just want to see it running.

## Running it locally

Node 24.19 or newer, within the 24.x line.

```sh
git clone https://github.com/JOE-D-MAX/wenbing-builder.git
cd wenbing-builder
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open <http://127.0.0.1:3000>.

| Path | Purpose |
| --- | --- |
| `/` | landing page |
| `/studio` | pick a workflow |
| `/studio/blocks` | block editor |
| `/studio/api` | API workspace |
| `/studio/manual` | template-guided |

## Deploying

The Render button gives you a free preview in a couple of clicks. The instance sleeps when idle and its disk is wiped on restart, so treat it as a demo.

For a real deployment you need a Linux machine with Docker, a domain pointing at it, and ports 80 and 443 open:

```sh
cp deploy/env.example deploy/.env
# set DOMAIN and TLS_EMAIL
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
```

[deploy/README.md](deploy/README.md) covers health checks, backups and the Caddy configuration. There is no checkout or account system: you download the HTML and host it wherever you like.

## Checks

```sh
npm run typecheck
npm test
npm run test:i18n
npm run build
```

The build produces `dist/standalone`, which is what the Docker image runs.

## Layout

```text
app/                 routes and API handlers
components/studio/   the editors
lib/                 block model, renderer, generation, storage, i18n
deploy/              Docker, Caddy, backup configuration
scripts/             build helpers and tests
vendor/              third-party sources, notices and licenses
```

## Credits

Built on React, Next, Vite (through vinext), dnd-kit, Radix, i18next and Drizzle. Third-party notices and license texts are kept under [vendor](vendor/).

Portfolio blocks ship as generic placeholders. No personal site content or archived media is bundled with this repository.

## License

GNU AGPL-3.0. Copyright (C) 2026 JOE-D-MAX.

Use it, modify it, self-host it. If you run a modified version as a network service, the AGPL requires you to publish your changes under the same license.
