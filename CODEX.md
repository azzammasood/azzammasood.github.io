# Codex Handoff Notes

This repo is Ahmad Uzzam Masood's portfolio site, based on Hugoplate but heavily customized.

## Project Shape

- Stack: Hugo Extended + Tailwind CSS v4 + Hugo modules.
- Main branch/remote: `main` pushed to `origin` (`https://github.com/azzammasood/azzammasood.github.io.git`).
- Primary content:
  - Pages/layouts: `layouts/`
  - Markdown content: `content/english/`
  - Static images: `static/images/`
  - Custom source CSS: `assets/css/custom.css`
  - Theme JS: `themes/hugoplate/assets/js/main.js`
  - Generated Tailwind output: `themes/hugoplate/assets/css/tailwind.css`
- Do not hand-edit `public/`; it is build output.

## Local Build

Hugo is not assumed to be globally installed on the original machine. The working build method was:

```powershell
$env:PATH = (Join-Path $env:TEMP 'hugo-0.151.0') + ';' + $env:PATH
npm run build
```

On a new machine, install Hugo Extended `0.151.0` or newer, or adapt PATH similarly. Then run:

```powershell
npm install
npm run build
```

Useful direct Hugo verification:

```powershell
hugo --gc --minify --templateMetrics --templateMetricsHints --forceSyncStatic
```

## Current Custom UX

- Theme picker uses `data-code-theme`; style picker uses `data-ui-style`.
- Theme/style switcher partial: `layouts/partials/components/theme-switcher.html`.
- Site-wide custom styles are in `assets/css/custom.css`; rebuild after changes so `themes/hugoplate/assets/css/tailwind.css` updates.
- Custom cursor is generated in `themes/hugoplate/assets/js/main.js` from CSS variables.
- Footer/bottom panel is in `layouts/partials/essentials/footer.html` and visually arranged by `.landing-links*` rules in `assets/css/custom.css`.
- Right-side nav loading spinner is controlled by `static/js/nav-loading.js` and `.site-side-nav .nav-link.is-loading::before` CSS.
- Neobrutalism shadow distance is currently tightened to `5.32px`; hover image shadow is `6.08px`.

## Recent Content Notes

- Hackathon feature images were replaced with:
  - `static/images/hackathons/vyrothon-2026-award.jpg`
  - `static/images/hackathons/reddit-mod-tools-hackathon.png`
  - `static/images/hackathons/ai-seekho-hackathon.png`
- Removed old Lakehouse project posts:
  - `content/english/blog/post-1.md`
  - `content/english/blog/post-4.md`
- Added project:
  - `content/english/blog/aws-crm-apis.md`

## Agent Expectations

- Before editing, inspect `git status --short --branch`.
- Prefer editing source files, then rebuild generated CSS with `npm run build`.
- After frontend changes, verify with `npm run build`; if Hugo is unavailable, document that clearly.
- Do not revert unrelated user changes.
- If committing, include generated Tailwind CSS when `assets/css/custom.css` changes.
