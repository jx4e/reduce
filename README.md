<p align="center">
  <img src="tldr-readme-banner.png" alt="tldr" width="700">
</p>

<p align="center">
  <a href="https://github.com/jx4e/tldr/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license"></a>
  <a href="https://github.com/jx4e/tldr/stargazers"><img src="https://img.shields.io/github/stars/jx4e/tldr" alt="stars"></a>
</p>

---

Your lecture notes are too long. You didn't read them. **tldr** fixes that.

Drop in your PDFs, slides, or notes and get back a structured, interactive study guide — the kind that actually makes sense of the material. Then ask questions about anything in it, grounded in your own content.

Sign up to save guides and pick up where you left off from any device.

## Features

- **Upload anything** — PDFs, slides, notes (multiple files per guide)
- **Instant study guides** — structured for CS & math: formulas, intuition, worked examples, common pitfalls
- **Interactive Q&A** — ask questions about the whole guide, or click any element to dig into that specific part
- **Two modes** — Math/CS (LaTeX, code blocks) and Humanities (arguments, key thinkers, essay structure)
- **Saves your work** — guides live in your account, accessible from anywhere
- **Free & open source** — fork it, self-host it, make the prompts yours

## Getting Started

```bash
git clone https://github.com/jx4e/tldr
cd tldr
npm install
```

Set up environment variables:

```bash
cp .env.example .env.local
```

```env
DATABASE_URL=postgresql://...
AUTH_SECRET=...
ANTHROPIC_API_KEY=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
```

Then:

```bash
npm run dev
```

Open `localhost:3000`, create an account, and upload your first document.

## Stack

- **Next.js** (App Router) — frontend + API routes
- **TypeScript** — end to end
- **Tailwind CSS** — styling
- **KaTeX** — math rendering
- **Anthropic JS SDK** — AI calls (server-side)
- **Auth.js** — user authentication
- **Postgres** — guide + user storage
- **Cloudflare R2** — uploaded file storage

## Deployment

Designed to run on [Railway](https://railway.app):

- **Web service** — Next.js app
- **Postgres** — managed Railway database
- **R2** — Cloudflare R2 for file uploads (external)

## Contributing

PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

<p align="center">Built by <a href="https://github.com/jx4e">Jake Gaunt</a> · UBC Computer Science</p>
