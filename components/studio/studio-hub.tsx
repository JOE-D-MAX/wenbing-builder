'use client';

import { ArrowLeft, ArrowUpRight, ImageIcon, Layers3, MousePointer2, Palette, Sparkles, Type } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { LiftoffEffects } from '@/components/studio/liftoff-effects';
import { StudioLanguageSwitch, useStudioI18n } from './studio-i18n';

export function StudioHub({ apiHref }: { apiHref: string }) {
  const { t } = useStudioI18n();
  return <main className="studio-hub">
    <header className="studio-header">
      <a href="/" className="brand" aria-label={t('文炳建站首页')}><HubMark/>{t('文炳建站')}</a>
      <span className="studio-header-label">{t('制作空间')}</span>
      <a className="hub-home" href="/"><ArrowLeft size={15} aria-hidden="true"/>{t('返回首页')}</a>
      <StudioLanguageSwitch/>
    </header>
    <div className="hub-shell">
      <section className="hub-intro" data-liftoff-surface aria-labelledby="hub-title">
        <LiftoffEffects compact/>
        <div className="hub-intro-copy">
          <p className="hub-kicker">{t('从这里，开始你的创作')}</p>
          <h1 id="hub-title">{t('选择你的制作方式。')}</h1>
          <p>{t('亲手拼搭每一个细节，或让 AI 帮你完成第一个版本。')}</p>
        </div>
      </section>
      <nav className="hub-choices" aria-label={t('选择制作方式')}>
        <a className="hub-choice hub-choice-blocks" href="/studio/blocks" aria-labelledby="hub-blocks-title" aria-describedby="hub-blocks-description">
          <Card className="hub-choice-card">
            <div className="hub-visual hub-blocks-visual" aria-hidden="true">
              <div className="hub-materials"><span><Palette size={17}/>{t('配色')}</span><span><Sparkles size={17}/>{t('特效')}</span><span><Type size={17}/>{t('文字')}</span></div>
              <div className="hub-mini-page">
                <div className="hub-mini-nav"><i/><span/><span/></div>
                <div className="hub-mini-content"><div><b>{t('你的网站，')}<br/>{t('由你定义。')}</b><i/><i/></div><div className="hub-mini-image"><ImageIcon size={28}/></div></div>
                <div className="hub-mini-grid"><span/><span/><span/></div>
              </div>
              <div className="hub-drag-tag"><MousePointer2 size={20}/>{t('拖入喜欢的效果')}</div>
            </div>
            <div className="hub-card-copy">
              <p className="hub-method"><Layers3 size={17} aria-hidden="true"/>{t('自由拼搭 · 无需 API')}</p>
              <h2 id="hub-blocks-title">{t('模块搭建')}</h2>
              <p id="hub-blocks-description">{t('挑选背景、配色和动态效果，拖到画布上。边搭建，边看到你的网站。')}</p>
              <span className="hub-enter">{t('进入模块搭建')}<ArrowUpRight size={22} aria-hidden="true"/></span>
            </div>
          </Card>
        </a>
        <a className="hub-choice hub-choice-api" href={apiHref} aria-labelledby="hub-api-title" aria-describedby="hub-api-description">
          <Card className="hub-choice-card">
            <div className="hub-visual hub-api-visual" aria-hidden="true">
              <div className="hub-prompt-card"><Sparkles size={19}/><span>{t('把我的想法，变成一个网站。')}</span></div>
              <div className="hub-api-path"><i/><span>{t('想法')}</span><span>{t('设计')}</span><span>{t('网站')}</span></div>
              <div className="hub-ai-page"><div><i/><i/><i/></div><strong>{t('想法，有了形状。')}</strong><span/><span/><div className="hub-ai-grid"><i/><i/><i/></div></div>
            </div>
            <div className="hub-card-copy">
              <p className="hub-method"><Sparkles size={17} aria-hidden="true"/>{t('智能生成 · 自备 API')}</p>
              <h2 id="hub-api-title">{t('API 制作')}</h2>
              <p id="hub-api-description">{t('连接自己的模型接口，描述你想做的网站。两套设计 Skill 辅助排版与视觉。')}</p>
              <span className="hub-enter">{t('进入 API 制作')}<ArrowUpRight size={22} aria-hidden="true"/></span>
            </div>
          </Card>
        </a>
      </nav>
      <p className="hub-footnote">{t('先选一种方式开始，也可以随时回到这里切换。')}</p>
    </div>
  </main>;
}

function HubMark() {
  return <svg width="29" height="29" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 22.5L9 9.5L16 23L23 9.5L28 22.5" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M11.5 17L16 8L20.5 17" stroke="#7795ee" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
