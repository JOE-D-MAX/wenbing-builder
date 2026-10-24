# Interface language support — 2026-10-23

The site uses bundled Chinese/English interface dictionaries with i18next and react-i18next. No translation service receives user content. Changing the interface language does not rewrite a brief, an API key, a saved project, an order or generated HTML. The local preference has its own storage key.

## GitHub research and choice

Verified repository metadata and latest default-branch commits on 2026-10-23:

| Project | Stars | License | Latest commit | Fit |
| --- | ---: | --- | --- | --- |
| [react-i18next](https://github.com/i18next/react-i18next) | 10,058 | MIT | 2026-10-22 | React hooks and context for live language switching |
| [i18next](https://github.com/i18next/i18next) | 8,647 | MIT | 2026-10-22 | Dictionaries, interpolation and deterministic fallback |
| [FormatJS](https://github.com/formatjs/formatjs) | 14,745 | Package-specific (react-intl: BSD-3-Clause) | 2026-10-23 | Mature alternative, with ICU extraction and formatting; unnecessary extra migration work for this site's existing short interface strings |

Integrated pinned npm packages i18next 26.5.6 and react-i18next 17.1.3 (three packages added, including their small transitive dependency). Existing React 19 stays unchanged. Both MIT license notices are retained alongside this document. No backend translation API, external language file fetch, routing rewrite or browser language detector was added.

## Official references

- [I18nextProvider](https://react.i18next.com/latest/i18nextprovider): isolated context instance for React and SSR.
- [useTranslation](https://react.i18next.com/latest/usetranslation-hook): reactive translations and language changes.
- [Configuration options](https://www.i18next.com/overview/configuration-options): bundled resources, supported languages, key separators and synchronous initialization.

The server and initial client render both start in Chinese; the provider restores the user's explicit preference after hydration. It updates the document language and page title without remounting the editor. Language buttons have explicit accessible names, pressed states and 44px minimum targets. Project data and generated output remain in their authored language.
