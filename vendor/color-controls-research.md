# Color controls: reuse assessment

Verified on 2026-10-29 using unauthenticated public GitHub REST API responses. Commit dates below are the latest commit on the default branch; release dates refer to GitHub Releases, not an independently verified npm release.

| Project | Stars | Latest default-branch commit (UTC) | Latest GitHub release | License | Integration cost |
| --- | ---: | --- | --- | --- | --- |
| [react-colorful](https://github.com/omgovich/react-colorful) | 3,561 | [2026-09-01 16:18:25](https://github.com/omgovich/react-colorful/commit/8506e8c4b777e0056ce3567dc3a06ced143034bc) | [v5.8.0, 2026-07-13](https://github.com/omgovich/react-colorful/releases/tag/v5.8.0) | [MIT](https://github.com/omgovich/react-colorful/blob/master/LICENSE) | Repository describes a 3.1 KB React/Preact picker. The current manifest has no runtime dependencies and React/React DOM peers >=16.8. A custom visual picker would still need labels, layout, and controlled state integration. |
| [react-color](https://github.com/casesandberg/react-color) | 12,331 | [2020-11-17 09:05:57](https://github.com/casesandberg/react-color/commit/bc9a0e1dc5d11b06c511a8e02a95bd85c7129f4b) | [v2.18.1, 2020-05-04](https://github.com/casesandberg/react-color/releases/tag/v2.18.1) | [MIT](https://github.com/casesandberg/react-color/blob/master/LICENSE) | Multiple styled picker components; seven direct runtime dependencies: @icons/material, lodash, lodash-es, material-colors, prop-types, reactcss, and tinycolor2. Much older default-branch maintenance than react-colorful. |

Both repositories report `archived: false`. The default-branch package versions were 5.8.1 and 2.19.3 respectively; those values differ from the latest GitHub Release tags. The advertised react-colorful size is an upstream claim, not a bundle measurement in this application.

## Decision

Reuse the editor's existing native `input[type=color]`, existing `PALETTE_LIBRARY`, safe six-digit HEX validation, and project undo mechanism. The requested four color fields and unified-color switch do not require a custom HSV/RGB editor, popover picker, or new package. Native controls add no application dependency; their popup appearance is browser/platform dependent. Provide visible field labels and retain keyboard focus feedback.

No source code or assets from either candidate are bundled by this change. If a richer custom picker is requested later, react-colorful is the lower-cost candidate from this comparison; retain its MIT notice if integrated. Do not add react-color merely because its star count is higher.

## Verification endpoints

- [react-colorful repository metadata](https://api.github.com/repos/omgovich/react-colorful), [latest default-branch commit](https://api.github.com/repos/omgovich/react-colorful/commits?per_page=1), [latest release](https://api.github.com/repos/omgovich/react-colorful/releases/latest), [license](https://api.github.com/repos/omgovich/react-colorful/license), [package manifest](https://raw.githubusercontent.com/omgovich/react-colorful/master/package.json).
- [react-color repository metadata](https://api.github.com/repos/casesandberg/react-color), [latest default-branch commit](https://api.github.com/repos/casesandberg/react-color/commits?per_page=1), [latest release](https://api.github.com/repos/casesandberg/react-color/releases/latest), [license](https://api.github.com/repos/casesandberg/react-color/license), [package manifest](https://raw.githubusercontent.com/casesandberg/react-color/master/package.json).
