# 自定义 API 接口调研

核验日期：2026-10-19（Asia/Hong_Kong）。用户需求：API 创作页由访客填写自己的接口地址、API Key 和模型名称，不限定服务商。

## GitHub 方案比较

| 项目 | 实际功能与近期维护 | 许可证 | 本项目集成成本 |
| --- | --- | --- | --- |
| [openai/openai-node](https://github.com/openai/openai-node) | GitHub API 查询为 11,226 stars；[客户端源码](https://github.com/openai/openai-node/blob/main/src/client.ts)接受自定义 `baseURL`；Chat Completions 接口接受模型名。最近核验发行版 [v7.39.0](https://github.com/openai/openai-node/releases/tag/v7.39.0) 发布于 2026-10-18 23:53 UTC。 | [Apache-2.0](https://github.com/openai/openai-node/blob/main/LICENSE) | 需要新增 SDK，替换现有请求/错误处理并校准重试、超时；SDK 本身不能代替应用对用户输入地址的访问限制。 |
| [vercel/ai](https://github.com/vercel/ai) | GitHub API 查询为 27,395 stars；[`@ai-sdk/openai-compatible`](https://github.com/vercel/ai/blob/main/packages/openai-compatible/README.md)支持 `baseURL`、`apiKey`、自定义模型名与请求头；[实现](https://github.com/vercel/ai/blob/main/packages/openai-compatible/src/openai-compatible-provider.ts)按配置地址拼接兼容接口。最近核验发行版 [ai@7.0.143](https://github.com/vercel/ai/releases/tag/ai%407.0.143) 发布于 2026-10-16 20:10 UTC，仓库最近推送于 2026-10-18。 | [Apache-2.0](https://github.com/vercel/ai/blob/main/LICENSE)，包 [package.json](https://github.com/vercel/ai/blob/main/packages/openai-compatible/package.json)同样声明 Apache-2.0。GitHub 元数据的 `NOASSERTION` 不覆盖许可证正文。 | 需要新增 `ai`、兼容 provider 及其依赖，迁移返回结构；更适合后续统一流式响应、工具调用和多种协议。 |
| 当前项目服务端请求路径 | `lib/ai-generation.ts` 已实现兼容 `/chat/completions` 请求，以及超时、重复请求控制、长度约束和生成 HTML 检查；缺口是地址与模型目前被预设列表固定。 | 项目现有代码 | 改动范围最小；可保留原有请求及预览行为，无新增运行时依赖。 |

## 选择

复用当前服务端请求路径，增加可编辑的 API 地址及模型名，不为这一项配置能力额外引入 SDK。与上述成熟实现采用同一组通用配置概念：接口基础地址、模型名、访客自己的密钥。

兼容范围明确为 OpenAI Chat Completions 格式；不能将“自定义服务商”解释为任意专有协议自动兼容。自定义接口请求只发送通用字段，服务商特有的 `enable_thinking` / `thinking` 参数不得无条件发送。

地址可以是基础路径，也可在应用中规范化已包含 `/chat/completions` 的完整路径。由服务端访问用户提供的地址时，仍需校验 HTTPS、公有目标地址，拒绝内网、回环及元数据地址，并禁止请求重定向；这些属于应用层责任，不能仅因更换 SDK 而省略。

本调研不创建或读取任何真实 API Key，不发起收费模型调用，不复制第三方源代码。实现阶段可使用本地模拟请求验证。若后续实际引入上述 SDK，应保留包许可证及必要来源说明。

## 核验方式

2026-10-20 补充核验：[OpenAI Chat Completions 官方参数说明](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)将 `max_tokens` 标记为旧参数，部分推理模型要求 `max_completion_tokens`。界面提供折叠兼容设置供用户明确选择，避免按服务商品牌猜测协议，且不对失败的付费请求自动重试。两种参数均设置 8192 上限，请求不会同时携带两者。

- GitHub 仓库、源码、发行页和 LICENSE 正文。
- GitHub REST API `repos/openai/openai-node`、`repos/vercel/ai` 及各仓库 `releases?per_page=1`：核实 stars、推送及发行时间。星数只作筛选参考，会随时间变化。
- 本项目 `package.json`、`lib/ai-config.ts`、`lib/ai-generation.ts`、`components/studio/api-studio.tsx`：确认既有依赖、调用形式与固定选项来源。
