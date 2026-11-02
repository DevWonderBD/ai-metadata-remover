# Changelog

All notable changes to the **AI Metadata Remover** project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-11-02

### Added
- **100% Client-Side Metadata Stripper:** Binary-level extraction and removal of EXIF, XMP, IPTC, and C2PA Content Credentials directly in the user's browser.
- **AI Provenance Detection:** Deep scanning for generation markers from Midjourney, ChatGPT / DALL-E, Adobe Firefly, Google Imagen, Stable Diffusion (Automatic1111), and ComfyUI workflows.
- **Lossless Cleaning:** Zero compression or pixel degradation for JPG, PNG, and WebP images.
- **Smart Orientation Preservation:** Extracts EXIF tag `0x0112` and writes a minimal sterile header to prevent accidental image flipping.
- **Anti-Duplicate Mode:** Cryptographic pixel jitter ($\pm 1$ across ~25% of pixels) to generate unique file hashes while remaining imperceptible to the human eye.
- **Zero-Dependency Bulk ZIP:** Custom in-browser ZIP generator with CRC32 calculation for one-click bulk downloads.
- **PWA & Offline Support:** Installable on Desktop, iOS, and Android with complete offline functionality.
- **Persistent Local Telemetry & Queue Sync:** Telemetry counts persist across page refreshes and auto-sync when network connectivity is restored.
- **Dev Wonder Official Branding:** Syne font typography, custom responsive 85% width layout, and dual-theme (Light & Dark) styling with subtle dot matrix backgrounds.
- **Lottie-style Vector Micro-Interactions:** Smooth GPU-accelerated SVG animations for upload, security checks, sparkles, and downloads.
- **Smooth FAQ Accordion:** 60fps CSS Grid height transitions with question index markers.
