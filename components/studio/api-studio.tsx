'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Download, Eye, EyeOff, KeyRound, LoaderCircle, Monitor, Smartphone, Sparkles, X } from 'lucide-react';
import { AI_PROVIDERS, type AiTokenParameter } from '@/lib/ai-config';
import { secureRandomUUID } from '@/lib/client-compat';
import { LiftoffEffects } from '@/components/studio/liftoff-effects';
import { StudioLanguageSwitch, useStudioI18n, initialInterfaceText } from './studio-i18n';
import { continueWithBlocks } from '@/lib/block-transfer';

type PresetId = 'custom' | (typeof AI_PROVIDERS)[number]['id'];
type FieldErrors = Partial<Record<'baseUrl' | 'model' | 'apiKey' | 'prompt', string>>;
type Result = { html: string; provider: string; model: string; skills: string[] };
const modelSuggestions = [...new Set(AI_PROVIDERS.flatMap(item => item.models))];

function checkEndpoint(value: string): string {
  if (!value.trim()) return '请填写接口地址。';
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return '请填写以 https:// 开头的公网接口地址。';
    if (url.username || url.password || /[?#\\\s]/.test(value.trim())) return '地址中不要放入密钥、参数或锚点；密钥请填写在下方。';
    return '';
  } catch { return '请填写完整的接口地址，例如 https://api.example.com/v1。'; }
}
const samplePrompts: Record<string, string> = {
  restaurant: '为「青屿小馆」做一个餐厅网站。用墨绿、温暖的留白与统一字体，介绍季节餐桌，展示菜单与联系方式。请把未提供的地址和菜单明确标为待填写，适配手机。',
  personal: '为独立设计师做一个作品集网站。黑白极简，大标题，清晰展示个人介绍、项目与联系方式。未提供的作品和邮箱用待填写标记，不虚构客户或评价，适配手机。',
  business: '为「序物工作室」做一个品牌网站。蓝色与干净的留白，介绍器物设计、空间陈设和定制服务，呈现品牌故事与联系入口，适配手机。不虚构合作案例。',
};

// The result remains isolated from the parent document and the API credential.
function previewDocument(html: string) {
  return '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src https: data:; font-src data:; script-src \'none\'; connect-src \'none\'; frame-src \'none\'; object-src \'none\'; form-action \'none\'; base-uri \'none\'"><meta name="referrer" content="no-referrer">' + html;
}

function requestCancellation(requestId: string | null) {
  if (!requestId) return;
  // An explicit signal also reaches servers whose HTTP adapter omits disconnect events.
  void fetch('/api/generate/cancel', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId }), keepalive: true, cache: 'no-store',
  }).catch(() => {});
}

export function ApiStudio() {
  const { t } = useStudioI18n();
  const [preset, setPreset] = useState<PresetId>('custom');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [tokenParameter, setTokenParameter] = useState<AiTokenParameter>('max_tokens');
  const [apiKey, setApiKey] = useState('');
  const [visibleKey, setVisibleKey] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [manualHref, setManualHref] = useState('/studio/manual');
  const [hubHref, setHubHref] = useState('/studio');
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const controller = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const cancelled = useRef(false);
  const resultRef = useRef<HTMLElement>(null);
  const destination = !checkEndpoint(baseUrl) ? new URL(baseUrl.trim()).host : t('你填写的接口');

  useEffect(() => {
    const example = new URLSearchParams(location.search).get('example');
    if (example && samplePrompts[example]) {
      setPrompt(initialInterfaceText(samplePrompts[example]));
      setManualHref('/studio/manual?example=' + encodeURIComponent(example));
      setHubHref('/studio?example=' + encodeURIComponent(example));
    }
    const leave = () => { setApiKey(''); requestCancellation(requestIdRef.current); controller.current?.abort(); };
    window.addEventListener('pagehide', leave);
    return () => { window.removeEventListener('pagehide', leave); requestCancellation(requestIdRef.current); controller.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  function choosePreset(id: PresetId) {
    setPreset(id); setError(''); setFieldErrors({});
    const next = AI_PROVIDERS.find(item => item.id === id);
    if (!next) return;
    setBaseUrl(next.baseUrl); setModel(next.defaultModel); setTokenParameter('max_tokens'); setApiKey(''); setVisibleKey(false);
    setNotice('已填入示例地址和模型，仍可自由修改。请填写对应接口的密钥。');
  }

  function changeEndpoint(value: string) {
    setBaseUrl(value); setPreset('custom'); setError('');
    setFieldErrors(previous => ({ ...previous, baseUrl: undefined }));
    if (apiKey) { setApiKey(''); setVisibleKey(false); setNotice('接口地址已更改，请重新填写对应的密钥。'); }
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (controller.current) return;
    const invalid: FieldErrors = {};
    const endpointError = checkEndpoint(baseUrl);
    if (endpointError) invalid.baseUrl = endpointError;
    if (!/^[\x21-\x7e]{1,200}$/.test(model.trim()) || model.includes('://') || /^https?:/i.test(model.trim())) invalid.model = '请填写服务商提供的完整模型 ID，支持英文、数字和符号，不要填写空格或网址。';
    if (!/^[\x21-\x7e]{1,512}$/.test(apiKey.trim())) invalid.apiKey = '请填写该接口的完整 API Key，不能含中文、空格或换行。';
    if (prompt.trim().length < 10) invalid.prompt = '再介绍一点你的网站：至少填写 10 个字。';
    setFieldErrors(invalid); setError('');
    const firstInvalid = (Object.keys(invalid) as (keyof FieldErrors)[])[0];
    if (firstInvalid) {
      const ids = { baseUrl: 'ai-endpoint', model: 'ai-model', apiKey: 'ai-key', prompt: 'ai-prompt' };
      requestAnimationFrame(() => document.getElementById(ids[firstInvalid])?.focus());
      return;
    }
    let requestId: string;
    try { requestId = secureRandomUUID(); }
    catch { setError('当前浏览器无法安全发起请求，请升级浏览器后重试。'); return; }
    requestIdRef.current = requestId;
    const abort = new AbortController();
    controller.current = abort; cancelled.current = false;
    setBusy(true); setElapsed(0); setError(''); setNotice('');
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; requestCancellation(requestId); abort.abort(); }, 100000);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'custom', baseUrl: baseUrl.trim(), model: model.trim(), tokenParameter, apiKey: apiKey.trim(), prompt: prompt.trim(), requestId }),
        cache: 'no-store', signal: abort.signal,
      });
      const data = await response.json().catch(() => null) as (Result & {error?: string}) | null;
      if (!response.ok || !data) throw new Error(data?.error || '生成暂时没有完成，请稍后重试。');
      if (typeof data.html !== 'string' || !data.html.trim()) throw new Error('模型没有返回可预览的网页，请调整描述后重试。');
      setResult(data);
      setNotice('网站已生成。可以切换预览尺寸，或下载 HTML 文件。');
      if (window.matchMedia('(max-width: 900px)').matches) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (reason) {
      if (cancelled.current) setNotice('已停止等待并发送取消请求，填写的内容仍在。服务商可能已产生部分调用费用。');
      else if (timedOut) setError('等待超过 100 秒，已停止等待。请稍后重试，服务商可能已产生部分调用费用。');
      else if (abort.signal.aborted) setNotice('本次生成已停止。');
      else setError(reason instanceof TypeError ? '网络连接中断，请检查网络后重试。' : reason instanceof Error ? reason.message : '暂时无法生成，请稍后重试。');
    } finally {
      clearTimeout(timeout); controller.current = null; requestIdRef.current = null; setBusy(false);
    }
  }

  function download() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([result.html], { type: 'text/html;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'wenbing-ai-website.html';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    setNotice('HTML 文件已准备下载，可在浏览器中打开。当前网站尚未发布。');
  }

  return <main className="api-studio">
    <header className="studio-header">
      <a href="/" className="brand" aria-label={t("文炳建站首页")}><StudioMark/>{t("文炳建站")}</a>
      <span className="studio-header-label">{t("API 制作")}</span>
      <StudioLanguageSwitch />
    </header>
    <div className="studio-shell">
      <div className="studio-intro" data-liftoff-surface>
        <LiftoffEffects compact/>
        <div><a href={hubHref} className="studio-back"><ArrowLeft size={15}/>{t("选择制作方式")}</a><h1>{t("想法在这里，")}<br/>{t("成为网站。")}</h1></div>
        <p>{t("连接你自己的 API，写下想做的网站。")}<br/>{t("让两套设计规范，照顾从排版到细节的每一步。")}</p>
      </div>
      <div className="studio-grid">
        <form className="api-form" onSubmit={generate} noValidate>
          <fieldset disabled={busy} aria-labelledby="api-connection-title">
            <legend className="api-connection-heading"><span id="api-connection-title">{t("连接你的 API")}</span><a className="studio-skip" href={manualHref}>{t("暂时没有 API")}<ArrowUpRight size={15}/></a></legend>
            <p className="api-connection-intro">{t("填写你已有的接口，不限服务商。")}<br/>{t("支持 OpenAI 兼容的 Chat Completions 接口。")}</p>
            <label htmlFor="ai-preset">{t("快速填写")}<span>{t("可选，填入后仍可修改")}</span></label>
            <select id="ai-preset" value={preset} onChange={event => choosePreset(event.target.value as PresetId)}><option value="custom">{t("自定义接口")}</option>{AI_PROVIDERS.map(item => <option key={item.id} value={item.id}>{t(item.label)}{t("示例")}</option>)}</select>
            <label htmlFor="ai-endpoint">{t("接口地址")}<span>Base URL</span></label>
            <input className="api-connection-input" id="ai-endpoint" type="url" value={baseUrl} onChange={event => changeEndpoint(event.target.value)} required maxLength={2048} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="https://api.example.com/v1" aria-invalid={Boolean(fieldErrors.baseUrl)} aria-describedby="endpoint-help endpoint-error"/>
            <p className="api-help api-field-help" id="endpoint-help">{t("填写服务商提供的 HTTPS 地址，也支持以 /chat/completions 结尾的完整地址。")}</p>
            <p className="api-field-error" id="endpoint-error" aria-live="polite">{t(fieldErrors.baseUrl || '')}</p>
            <label htmlFor="ai-model">{t("模型名称")}<span>{t("支持手动输入")}</span></label>
            <input className="api-connection-input" id="ai-model" value={model} list="ai-model-suggestions" onChange={event => { setModel(event.target.value); setError(''); setFieldErrors(previous => ({ ...previous, model: undefined })); }} required maxLength={200} placeholder={t("填写你已开通的模型 ID")} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(fieldErrors.model)} aria-describedby="model-help model-error"/>
            <datalist id="ai-model-suggestions">{modelSuggestions.map(value => <option key={value} value={value}/>)}</datalist>
            <p className="api-help api-field-help" id="model-help">{t("模型名称按服务商控制台填写，列表仅供参考。")}</p>
            <p className="api-field-error" id="model-error" aria-live="polite">{t(fieldErrors.model || '')}</p>
            <label htmlFor="ai-key">API Key <span>{t("仅本次页面使用")}</span></label>
            <div className="api-key-input"><KeyRound size={17} aria-hidden="true"/><input id="ai-key" type={visibleKey ? 'text' : 'password'} value={apiKey} onChange={event => { setApiKey(event.target.value); setError(''); setFieldErrors(previous => ({ ...previous, apiKey: undefined })); }} required maxLength={512} placeholder={t("填写该接口的密钥")} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(fieldErrors.apiKey)} aria-describedby="key-privacy key-error"/><button type="button" onClick={() => setVisibleKey(value => !value)} aria-label={t(visibleKey ? '隐藏密钥' : '显示密钥')}>{visibleKey ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
            <p className="api-field-error" id="key-error" aria-live="polite">{t(fieldErrors.apiKey || '')}</p>
            <p className="api-help" id="key-privacy">{t("密钥经本站服务器发送至")}<strong>{destination}</strong>{t("，本站不保存。离开或刷新页面后需重新填写。")}</p>
            <details className="api-advanced">
              <summary>{t("接口兼容设置")}</summary>
              <label htmlFor="ai-token-parameter">{t("生成长度参数")}</label>
              <select id="ai-token-parameter" value={tokenParameter} onChange={event => { setTokenParameter(event.target.value as AiTokenParameter); setError(''); }} aria-describedby="token-parameter-help">
                <option value="max_tokens">{t("通用模式 · max_tokens")}</option>
                <option value="max_completion_tokens">{t("新版模式 · max_completion_tokens")}</option>
              </select>
              <p className="api-help" id="token-parameter-help">{t("通常保持默认。若服务商文档要求 max_completion_tokens，请切换到新版模式。单次上限为 8192 tokens；部分模型会将推理过程计入。")}</p>
            </details>
          </fieldset>
          <fieldset disabled={busy} className="api-brief">
            <legend>{t("你想做一个怎样的网站？")}</legend>
            <label htmlFor="ai-prompt" className="sr-only">{t("网站需求")}</label>
            <textarea id="ai-prompt" value={prompt} onChange={event => { setPrompt(event.target.value); setError(''); setFieldErrors(previous => ({ ...previous, prompt: undefined })); }} required minLength={10} maxLength={6000} rows={6} placeholder={t("例如：为我的咖啡店做一个温暖、简洁的网站。用奶白和墨绿，展示品牌故事、招牌饮品和地址，手机上也好看。")} aria-invalid={Boolean(fieldErrors.prompt)} aria-describedby="prompt-error"/>
            <p className="api-field-error" id="prompt-error" aria-live="polite">{t(fieldErrors.prompt || '')}</p>
            <div className="api-prompt-bottom"><div className="api-examples">{[['restaurant', '小店'], ['personal', '作品集'], ['business', '品牌']].map(([kind, label]) => <button type="button" key={kind} onClick={() => { setPrompt(t(samplePrompts[kind])); setFieldErrors(previous => ({ ...previous, prompt: undefined })); }}>{t(label)}{t("示例")}</button>)}</div><span>{prompt.length}/6000</span></div>
          </fieldset>
          <div className="api-skills" aria-label={t("已启用的设计技能")}><span className="api-skills-label">{t("每次生成，都有设计依据。")}</span><div><Check size={15}/><strong>UI/UX Pro Max</strong><span>{t("字体 · 配色 · 手机适配")}</span></div><div><Check size={15}/><strong>Taste Skill</strong><span>{t("视觉方向 · 排版 · 细节")}</span></div></div>
          {error && <p className="api-feedback api-error" role="alert">{t(error)}</p>}
          <button className="btn dark full api-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle size={18} className="spin"/> : <Sparkles size={18}/>} {busy ? t('正在生成 · {{seconds}} 秒', { seconds: elapsed }) : t('生成我的网站')}{!busy && <ArrowRight size={18}/>}</button>
          {busy && <button className="api-cancel" type="button" onClick={() => { cancelled.current = true; requestCancellation(requestIdRef.current); controller.current?.abort(); }}><X size={14}/>{t("取消本次生成")}</button>}
          <p className="api-billing">{t("点击生成，将把需求发送至")}{destination}{t("。调用费用由接口服务商从你的 API 账户扣除。")}</p>
        </form>
        <section className="api-output" ref={resultRef} aria-label={t("AI 网站预览")} aria-busy={busy}>
          <div className="api-output-bar"><span><span className="live-dot"/>{t(result ? '你的网站' : '下一站，你的网站')}</span><div className="api-device-switch" aria-label={t("预览尺寸")}><button type="button" aria-label={t("电脑预览")} aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor size={17}/></button><button type="button" aria-label={t("手机预览")} aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone size={17}/></button></div></div>
          {result ? <div className={'api-result-canvas ' + device}><iframe title={t("AI 生成的网站预览")} srcDoc={previewDocument(result.html)} sandbox="" referrerPolicy="no-referrer"/></div> : <div className="api-output-empty"><div className="studio-monogram" aria-hidden="true"><StudioMark/></div><h2>{t("给想法，")}<br/>{t("一个看得见的开始。")}</h2><p>{t("填入 API 和网站需求，")}<br/>{t("你的第一个版本会出现在这里。")}</p><div className="api-empty-path"><span>{t("连接 API")}</span><ArrowRight size={14}/><span>{t("描述想法")}</span><ArrowRight size={14}/><span>{t("预览网站")}</span></div></div>}
          {busy && <p className="api-generation-status" role="status"><LoaderCircle className="spin" size={17}/>{t("正在等待模型生成网页，通常需要几十秒。")}{result && t('当前保留上一版预览。')}</p>}
          <div className="api-output-bottom"><span>{t(result ? '已生成 · 尚未发布' : '你的内容，你的风格。')}<small>{t(result ? '预览禁用脚本与表单提交；下载后可查看完整文件。' : '无需安装软件，电脑与手机都能开始。')}</small></span>{result && <button type="button" className="btn dark" onClick={download}><Download size={16}/>{t("下载 HTML")}</button>}</div>
          {notice && <p className="api-feedback" role="status">{t(notice)}</p>}
          {result && <button type="button" className="studio-continue-blocks" onClick={() => { try { continueWithBlocks(result.html, t('我的 AI 网站')); } catch (reason) { setNotice(reason instanceof Error ? reason.message : '暂时无法打开模块工作区。'); } }}>{t("把这个网站带入模块拼搭")}<ArrowUpRight size={16}/></button>}
        </section>
      </div>
      <footer className="studio-footer"><span>{t("先让想法成形，再慢慢打磨。")}</span><a href={manualHref}>{t("不接 API，也可以开始制作")}<ArrowUpRight size={15}/></a></footer>
    </div>
  </main>;
}

function StudioMark() {
  return <svg width="29" height="29" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 22.5L9 9.5L16 23L23 9.5L28 22.5" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M11.5 17L16 8L20.5 17" stroke="#7795ee" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
