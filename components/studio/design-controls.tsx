'use client';
import { useStudioI18n } from './studio-i18n';

import type { CSSProperties } from 'react';
import { LAYOUTS, THEMES, type Brief } from '@/lib/studio';

type DesignControlsProps = {
  brief: Brief;
  onChange: (change: Partial<Brief>) => void;
};

function SelectionMark({ selected }: { selected: boolean }) {
  return <span className="design-selection" aria-hidden="true">{selected ? '✓' : ''}</span>;
}

export function DesignControls({ brief, onChange }: DesignControlsProps) {
  const { t } = useStudioI18n();
  const layout = brief.layout || 'auto';
  const theme = brief.theme || 'auto';
  const font = brief.font || 'auto';
  const automatic = layout === 'auto' && theme === 'auto' && font === 'auto';
  const accent = THEMES.find((option) => option.value === theme)?.color || THEMES[0].color;

  return (
    <section className="design-controls" aria-label={t('视觉风格设置')} style={{ '--design-accent': accent } as CSSProperties}>
      <div className="design-controls-heading">
        <div><span>DESIGN DIRECTION</span><h3>{t("定义你的风格")}</h3></div>
        <button type="button" className="design-auto" aria-pressed={automatic} onClick={() => onChange({ layout: 'auto', theme: 'auto', font: 'auto' })}>{t("全部自动匹配")}</button>
      </div>

      <fieldset className="design-fieldset">
        <legend>{t("页面版式")}</legend>
        <div className="design-fieldset-meta"><p>{t("为内容选择合适的节奏")}</p><button type="button" aria-pressed={layout === 'auto'} onClick={() => onChange({ layout: 'auto' })}>{t('自动匹配')}{layout === 'auto' ? ' ✓' : ''}</button></div>
        <div className="design-layout-grid">
          {LAYOUTS.map((option) => (
            <button type="button" className="design-layout-option" key={option.value} aria-pressed={layout === option.value} onClick={() => onChange({ layout: option.value })}>
              <span className={`design-layout-thumbnail design-thumbnail-${option.value}`} aria-hidden="true">
                <span className="design-thumb-nav"><i /><i /></span>
                <span className="design-thumb-body"><span className="design-thumb-copy"><i /><i /><i /></span><span className="design-thumb-art" /></span>
                <span className="design-thumb-items"><i /><i /><i /></span>
              </span>
              <span className="design-option-title">{t(option.label)}<SelectionMark selected={layout === option.value} /></span>
              <span className="design-option-description">{t(option.description)}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="design-fieldset">
        <legend>{t("品牌配色")}</legend>
        <div className="design-fieldset-meta"><p>{t("留白与色彩，共同形成气质")}</p><button type="button" aria-pressed={theme === 'auto'} onClick={() => onChange({ theme: 'auto' })}>{t('自动匹配')}{theme === 'auto' ? ' ✓' : ''}</button></div>
        <div className="design-palette">
          {THEMES.map((option) => (
            <button type="button" key={option.value} className="design-color-option" aria-pressed={theme === option.value} onClick={() => onChange({ theme: option.value })}>
              <span className="design-color-dot" style={{ backgroundColor: option.color }} aria-hidden="true">{theme === option.value ? '✓' : ''}</span>
              <span>{t(option.label)}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="design-fieldset design-font-fieldset">
        <legend>{t("文字气质")}</legend>
        <div className="design-font-options">
          <button type="button" aria-pressed={font === 'auto'} onClick={() => onChange({ font: 'auto' })}><span className="design-font-auto">Aa</span><span>{t("自动匹配")}</span></button>
          <button type="button" aria-pressed={font === 'serif'} onClick={() => onChange({ font: 'serif' })}><span className="design-font-serif">{t("Aa 宋")}</span><span>{t("典雅衬线")}</span></button>
          <button type="button" aria-pressed={font === 'sans'} onClick={() => onChange({ font: 'sans' })}><span className="design-font-sans">{t("Aa 黑")}</span><span>{t("简洁无衬线")}</span></button>
        </div>
      </fieldset>
      <p className="design-controls-note">{t("手动选择优先于提示词。未选择的项目会自动匹配。")}</p>
    </section>
  );
}
