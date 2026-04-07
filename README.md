<p align="center">
  <img src="reduce-readme-banner.png" alt="reduce" width="700">
</p>

<p align="center">
  <a href="https://github.com/jakegaunt/reduce/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license"></a>
  <a href="https://github.com/jakegaunt/reduce/stargazers"><img src="https://img.shields.io/github/stars/jakegaunt/reduce" alt="stars"></a>
  <img src="https://img.shields.io/badge/BYOK-bring%20your%20own%20key-green" alt="byok">
</p>

---

**reduce** is an open-source AI study guide generator for CS and math students. Upload your lecture notes, slides, or PDFs — get a structured, interactive study guide back. Then ask questions about the material in a built-in chat interface, grounded in your own content.

Bring your own Claude API key. No backend, no subscriptions, no data stored on our servers.

## Features

- **Upload anything** — PDFs, slides, notes
- **AI-generated study guides** — structured for CS & math: formulas, intuition, worked examples, common pitfalls
- **Interactive Q&A** — chat with an AI tutor scoped to your uploaded material
- **Modes** — Math/CS mode (LaTeX, code blocks) and Humanities mode (arguments, key thinkers, essay structure)
- **BYOK** — your Claude API key stays in your browser, calls go directly to Anthropic
- **Free & open source** — fork it, self-host it, customize the prompts

## Getting Started

```bash
git clone https://github.com/jx4e/reduce
cd reduce
npm install
npm run dev
```

Then open `localhost:3000`, enter your [Claude API key](https://console.anthropic.com/), and upload your first document.

## Stack

- **Next.js** — frontend + routing
- **Tailwind CSS** — styling
- **KaTeX** — math rendering
- **Anthropic JS SDK** — AI calls (client-side, BYOK)
- **IndexedDB** — local storage for your guides

## Contributing

PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

<p align="center">Built by <a href="https://github.com/jx4e">Jake Gaunt</a> · UBC Computer Science</p>
