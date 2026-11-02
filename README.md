<div align="center">

# AI Metadata Remover

**A free, fast, and 100% private client-side tool to remove AI generation tags, C2PA Content Credentials, and camera EXIF data from images in bulk.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646cff.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline%20Ready-success.svg)](https://web.dev/progressive-web-apps/)
[![Zero Uploads](https://img.shields.io/badge/Privacy-100%25%20Client--Side-green.svg)](#privacy-guarantee)
[![cPanel Compatible](https://img.shields.io/badge/Hosting-cPanel%20%2F%20Static-orange.svg)](CPANEL-DEPLOYMENT.md)

[Live Demo](https://github.com/DevWonderBD/ai-metadata-remover) · [Report Bug](https://github.com/DevWonderBD/ai-metadata-remover/issues) · [Request Feature](https://github.com/DevWonderBD/ai-metadata-remover/issues)

</div>

---

## 🌟 Why AI Metadata Remover?

Generative AI platforms (ChatGPT, DALL-E, Midjourney, Adobe Firefly, Stable Diffusion, ComfyUI, Google Gemini) automatically embed provenance tags, prompt history, and C2PA Content Credentials into exported images. Modern social networks, stock platforms, and detection crawlers scan these hidden blocks to flag or downrank content.

**AI Metadata Remover** strips all AI traces, EXIF metadata, GPS coordinates, and embedded prompts at the binary level — **with zero quality loss** and **zero server uploads**.

---

## ✨ Features

- 🔒 **100% Client-Side Privacy:** All processing occurs inside your web browser via `ArrayBuffer` and modern Canvas APIs. No images are ever sent across the network.
- ⚡ **Lossless Cleaning for JPG, PNG, WebP:** Binary headers and application markers are stripped without recompressing pixel streams, preserving 100% original image fidelity.
- 📐 **Smart EXIF Orientation Preservation:** Unlike naive strippers that inadvertently flip portrait photos, our engine extracts the orientation tag (`0x0112`) and writes a minimal 34-byte sterile EXIF header so your photos remain upright.
- 🛡️ **C2PA & AI Trace Eraser:** Automatically detects and removes:
  - C2PA / JUMBF Content Credentials
  - IPTC "Made with AI" (`trainedAlgorithmicMedia`) tags
  - Stable Diffusion, Automatic1111, and ComfyUI prompts and workflows
  - Midjourney, OpenAI / ChatGPT / DALL-E, Adobe Firefly, and Google AI markers
- 🎲 **Unique Anti-Duplicate Mode (Optional):** Injects imperceptible cryptographic noise ($\pm 1$ on one color channel across ~25% of pixels) to alter the file hash (SHA-256 / MD5), preventing duplicate detection while remaining invisible to the human eye.
- 📦 **Zero-Dependency Bulk ZIP:** Download hundreds of cleaned images in a single click with our custom, in-browser ZIP generator (no heavy dependencies like JSZip).
- 📱 **PWA & Offline Queue Sync:** Works fully offline as an installable desktop/mobile Progressive Web App. Telemetry is queued locally and synced automatically when your connection is restored.
- 🌐 **cPanel & Static Hosting Ready:** Ships with a pre-configured lightweight PHP REST API and MySQL schema for effortless shared hosting deployment without Node.js servers.

---

## 🛠️ Tech Stack & Architecture

```
[ User Browser (Client-Side) ]
       │
       ├──► HTML5 Drag-and-Drop & Clipboard (Ctrl+V / ⌘V)
       │
       ├──► Binary Stream Stripping (JPEG markers, PNG chunks, WebP RIFF)
       │       └── Lossless byte filtering (EXIF, XMP, C2PA, Prompts)
       │
       ├──► In-Memory Zero-Dependency ZIP Archive Builder (CRC32)
       │
       └──► Offline Queue & Telemetry Sync (LocalStorage -> window 'online')
                 │
                 ▼ (Optional Minimal Metrics Ping)
       [ cPanel Apache/PHP REST API ] ──► [ MySQL Database (Counts only) ]
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js (v18+ recommended)
- npm or pnpm

### Installation
```bash
# 1. Clone the repository
git clone https://github.com/DevWonderBD/ai-metadata-remover.git
cd ai-metadata-remover

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Visit `http://localhost:5173` to test the application locally.

### Production Build
```bash
npm run build
```
The optimized, production-ready static assets are output to the `dist/` directory.

---

## 🌐 cPanel & Production Deployment

Because the React app compiles into static HTML, CSS, and JS, **no Node.js server is required on your hosting provider**.

1. Run `npm run build` locally.
2. Upload the contents of `dist/` to your cPanel `public_html/`.
3. Import `api/schema.sql` into phpMyAdmin.
4. Copy `api/config.example.php` to `api/config.php` and configure database credentials.

👉 For complete step-by-step instructions, see our [cPanel Deployment Guide](CPANEL-DEPLOYMENT.md).

---

## 🤝 Contributing

We welcome contributions! Please review our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting pull requests.

We strictly follow [Conventional Commits](https://www.conventionalcommits.org/):
```
feat(scope): add new feature
fix(scope): fix bug
docs(scope): update documentation
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) © 2026 [DevWonder](https://github.com/DevWonderBD).
