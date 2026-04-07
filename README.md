<p align="center">
  <img src="reduce-readme-banner.png" alt="reduce" width="700">
</p>

<p align="center">
  <a href="https://github.com/jx4e/reduce/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license"></a>
  <a href="https://github.com/jx4e/reduce/stargazers"><img src="https://img.shields.io/github/stars/jx4e/reduce" alt="stars"></a>
</p>

---

**reduce** is an open-source AI study guide generator for CS and math students. Upload your lecture notes, slides, or PDFs — get a structured, interactive study guide back. Then ask questions about the material in a built-in chat interface, grounded in your own content.

Create an account to save and access your guides from anywhere.

## Features

- **Upload anything** — PDFs, slides, notes (multiple files per guide)
- **AI-generated study guides** — structured for CS & math: formulas, intuition, worked examples, common pitfalls
- **Interactive Q&A** — ask questions about the whole guide or click any element to ask about that specific part
- **Modes** — Math/CS mode (LaTeX, code blocks) and Humanities mode (arguments, key thinkers, essay structure)
- **User accounts** — sign up to save guides and access them from any device
- **Free & open source** — fork it, self-host it, customize the prompts

## Getting Started

```bash
git clone https://github.com/jx4e/reduce
cd reduce
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
