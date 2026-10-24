export type AiProviderId = 'custom' | 'bailian' | 'deepseek';
export type AiTokenParameter = 'max_tokens' | 'max_completion_tokens';

export type AiProvider = {
  id: Exclude<AiProviderId, 'custom'>;
  label: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
};

// Optional shortcuts. Custom OpenAI-compatible HTTPS endpoints are validated server-side.
export const AI_PROVIDERS: AiProvider[] = [
  {
    id: 'bailian', label: '阿里云百炼',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus', models: ['qwen-plus', 'qwen-flash'],
  },
  {
    id: 'deepseek', label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-flash', models: ['deepseek-flash', 'deepseek-v4-pro'],
  },
];

export const AI_SKILLS = ['ui-ux-pro-max', 'design-taste-frontend'] as const;
export const AI_MAX_PROMPT_CHARACTERS = 6000;
export const AI_MAX_HTML_BYTES = 300000;
export const AI_TIMEOUT_MS = 90000;

export type AiGenerationInput = {
  provider: AiProviderId;
  baseUrl?: string;
  tokenParameter?: AiTokenParameter;
  apiKey: string;
  model: string;
  prompt: string;
  requestId?: string;
};

export type AiGenerationResult = {
  html: string;
  provider: AiProviderId;
  model: string;
  skills: typeof AI_SKILLS;
};
