# Landly Platform Guidelines & Design Standards

## Mandatory Workflow Rules (3-Phase Execution)
- Phase 1: Comprehensive architectural plan & wait for approval. No code edits.
- Phase 2: Execution only after explicit approval.
- Phase 3: Automated verification & typechecks.
- Strict Git Rule: Keep all changes uncommitted in the working tree. Never commit or push without explicit instruction.
- Visual Verification: Every visual change must be checked with headless Chrome screenshots against `localhost:3000`, at mobile (`440x956`) and desktop viewports, in English and Hebrew. Inspect each capture and fix any defect before finishing. Keep captures out of the repository.
- Parity: Strict parity between DEV (`landly-dev`) and PROD (`landly-be752`).
- Cross-Platform: Full cross-browser support (Desktop Chrome, Safari, Firefox, Edge; Mobile iOS Safari, Android Chrome, and iOS In-App WebViews) and Native Mobile (`landly-mobile/`). Complete Hebrew RTL support using logical CSS properties.

## Elite Luxury Bento & Landing Page Design Standards (Zero Generic Blocks)
- Visual Depth & Surfaces: NEVER use harsh solid-color rectangles or stark dark blocks. Use soft layered surfaces: `backdrop-blur-md bg-white/80 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl`.
- Card Aesthetics (Bento Style): Target audience cards must use modern Bento layouts: generous radiuses (`rounded-3xl`), subtle pastel accent tints (`bg-gradient-to-br from-blue-50/40 to-indigo-50/20`), inner hairline borders, and 1.75px vector icons inside soft circular 40px badges.
- Hero: A clean, single-column centered layout: headline, value proposition, the "100% free" badge, the primary "Join free" action with "Sign in" beside it, and both store badges. No perk cards or photo collage in the Hero; the category photo rail sits directly below it, above the perks.
- Micro-Interactions: Subtle hover lifts (`hover:-translate-y-1 transition-all duration-300`), interactive pills with glowing rings on focus, and smooth responsive flow.
- Typography & Rhythm: Modern typography scales (`tracking-tight`, gradient text accents `bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600`), and zero dead white expanses.
- Apple Wallet Pass: Keep the existing Apple Wallet pass animations, timing, and physics in `PassShowcase.tsx` 100% intact.

## Security Testing & Strix Pentest Rules
- NEVER run `strix` against production (`golandly.com` or `landly-be752`). Only target `http://localhost:3000` connected to `landly-dev`.
- ALWAYS enforce `--max-budget` (default `5`) and `--scan-mode standard` (or `quick`) when invoking `strix`.
- Never commit or stage anything inside `strix_runs/`.
- When auditing Strix findings, read the generated reports and PoCs inside `strix_runs/` and follow the mandatory 3-Phase Execution Standard to remediate vulnerabilities.

## Security Testing & Strix Pentest Rules
- NEVER run `strix` against production (`golandly.com` or `landly-be752`). Only target `http://localhost:3000` connected to `landly-dev`.
- ALWAYS enforce `--max-budget` (default `5`) and `--scan-mode standard` (or `quick`) when invoking `strix`.
- Never commit or stage anything inside `strix_runs/`.
- When auditing Strix findings, read the generated reports and PoCs inside `strix_runs/` and follow the mandatory 3-Phase Execution Standard to remediate vulnerabilities.
