# Changelog

## 2026-10-29 — One-click website creation

Added the ability to create a website in one click.

### Added

- Generate exactly 1–10 pages from the block editor, with editable sections, navigation, backgrounds, and effects. No API key is required.
- View and edit all generated pages in the same continuous vertical canvas.
- Use shared base colors with varied effect accents by default, or enable **Unified colors** and adjust a site-wide palette with presets and color pickers.
- Keep the chosen color mode across saves and undo/redo, and inherit unified colors when adding blocks.

### Improved

- Preserve authored content and media on retained pages during regeneration; undo a whole-site generation in one step.
- Limit randomly generated cursor-glow effects to the first and last pages, with a lower selection probability.
- Keep the canvas continuous by removing the extra blank insertion panel, blue selection frames, and grid backgrounds.
- Extend Chinese and English interface coverage for the new controls.

### Fixed

- Prevent stale template-studio tabs from overwriting newer saved drafts; support retry and recovery after save failures.
- Apply the correct compatibility options for unchanged API quick-fill presets while preserving custom endpoint support.
- Respect unified page colors in previews of empty pages and pages beginning with imported HTML.
- Prevent stale video playback failures from blocking a newer playback attempt after rapid visibility changes.
- Improve automatic button-label contrast for custom accent colors.
- Avoid broken emoji when truncating long titles and generated navigation labels.

### Validation

Passed the 16 regression scripts, TypeScript checks, 799 interface-message checks, production build, and local HTTP smoke tests. API tests used offline mocks. Browser visual testing was unavailable; the existing ESLint configuration gap is documented in the [audit notes](docs/BUG-AUDIT-2026-10-29.md).
