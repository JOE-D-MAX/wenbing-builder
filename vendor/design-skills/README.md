# Design Skill integration

These MIT-licensed upstream documents are vendored with their unmodified licenses and pinned provenance. They are documentation assets, not executable server plugins.

| Skill | Upstream | Pinned revision |
| --- | --- | --- |
| UI/UX Pro Max | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | `7246805992a42b7bba37d4cac83b01416f0c6c44` |
| Taste Skill (`design-taste-frontend`) | https://github.com/Leonxlnx/taste-skill | `f624f37a8c650b9cc550253104925efe4c8de246` |

`lib/ai-design-skills.ts` contains a Chinese adaptation of both skills and is sent as the system message on **every** API generation request. UI/UX Pro Max contributes accessibility, mobile layout, typography, color, touch targets and efficient motion. Taste Skill contributes subject-specific art direction, varied composition, concise headings and factual copy. Both headings are also asserted in the mock provider test.

The website owner's explicit design brief wins over stylistic defaults: their requested antigravity, stars, glow and pointer effects are allowed. A single completion API does not have the local skill scripts, browser inspector, downloaded photo library or agent tool loop. We do not claim those tools ran for a generated page. The prompt is adapted for self-contained HTML, no external scripts/fonts, and a script-disabled preview. The complete upstream SKILL documents here let a developer review the source; runtime code does not read or execute them.

## Custom endpoint update (2026-10-19)

The current API studio accepts the visitor's public HTTPS OpenAI-compatible Chat Completions URL and free-form model ID. Providers below are optional presets, not an allowlist. Both adapted skill prompts still run on every generation. The server pins a verified public DNS address for each custom request, rejects redirects and private destinations, and retains cancellation, timeouts and response bounds. Keys are sent only as the Authorization header, never in prompts or persistent storage. Changing the endpoint clears the previous key in the form. No live paid model request was performed. See [custom-api-research.md](../custom-api-research.md) for the current reuse decision.

## Original backend integration research (2026-10-14, historical fixed-provider design)

- **Vercel AI SDK** — https://github.com/vercel/ai — 27,315 stars at inspection, recent commit `6ac1ee115c4e287be43ebb0e86d884033d85b0cd` dated 2026-10-14. Root LICENSE at that revision is **Apache-2.0** (GitHub API reported `NOASSERTION`, so the actual LICENSE was read). Mature shared provider abstractions, typed generation, streaming, tools and agent workflows. Integration would require the SDK plus compatible-provider adapter; valuable for future streaming and multi-step agents, larger than this one completion endpoint needs.
- **OpenAI Node SDK** — https://github.com/openai/openai-node — 11,223 stars, **Apache-2.0**, recent commit `dd51b11156f920c57dc2e4ad4162cf28a42fe8a1` dated 2026-10-14. Mature typed HTTP client; compatible base URLs support both vendors. Defaults and extra vendor fields would still need adaptation for no retries, regional keys and strict bounds.
- **Decision:** reuse the providers' documented OpenAI-compatible HTTP protocol through the existing Node 24 `fetch`. No additional runtime packages or copied SDK code. Only two fixed official endpoints, one nonstreaming call, no tools and no automatic retries are needed; this keeps the 2 GiB deployment small. SDKs can be reconsidered if the scope expands.

Primary provider references checked:

- Aliyun compatible endpoint, regional keys and existing `dashscope.aliyuncs.com` endpoint support: https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope
- Aliyun qwen-plus/qwen-flash and `enable_thinking`: https://help.aliyun.com/zh/model-studio/deep-thinking/
- DeepSeek current models and endpoint: https://api-docs.deepseek.com/
- DeepSeek completion fields, non-thinking mode and finish reasons: https://api-docs.deepseek.com/api/create-chat-completion/

The configured Aliyun endpoint requires a **Beijing-region** API Key. DeepSeek uses the currently documented `deepseek-flash` and `deepseek-v4-pro` model IDs. The visitor supplies their own existing key; no site-owned key is used. Keys transit the website server and are forwarded only to the selected official service over HTTPS. They are never written to files or databases, included in prompts, or logged by this feature. Concurrent request guards temporarily hold a SHA-256 digest and remove it when the request finishes. Raw upstream errors are not returned. External proxy/access-log settings must likewise avoid logging request bodies.

Validation is offline with deterministic mock provider responses. No real visitor key, live provider charge, credential acceptance, model quality or provider availability has been tested.
