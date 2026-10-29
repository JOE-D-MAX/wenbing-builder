'use client';

import { Palette } from 'lucide-react';
import { PALETTE_LIBRARY, type BlockColors, type ProjectColorSettings } from '@/lib/block-model';
import { useStudioI18n } from './studio-i18n';

type Props = {
  settings: ProjectColorSettings;
  disabled: boolean;
  onToggle: () => void;
  onColorChange: (key: keyof BlockColors, value: string) => void;
  onPreset: (id: string) => void;
};

const fields = [
  { key: 'backgroundColor', label: '统一底色' },
  { key: 'secondaryColor', label: '辅助底色' },
  { key: 'textColor', label: '文字颜色' },
  { key: 'accentColor', label: '特效颜色' },
] as const;

export function ProjectColorControls({ settings, disabled, onToggle, onColorChange, onPreset }: Props) {
  const { t } = useStudioI18n();
  return <div className="bs-project-colors">
    <div className="bs-color-mode-heading">
      <button type="button" className="bs-color-toggle" role="switch" aria-checked={settings.unified}
        aria-label={t('统一配色')} aria-controls={settings.unified ? 'project-color-palette' : undefined} aria-describedby="project-color-mode-help"
        disabled={disabled} onClick={onToggle}>
        <Palette size={18} aria-hidden="true" /><span>{t('统一配色')}</span>
        <span className="bs-color-switch-track" aria-hidden="true"><i /></span>
      </button>
      <span className="bs-color-mode-state">{settings.unified ? t('已开启') : t('随机特效配色')}</span>
    </div>
    <p id="project-color-mode-help">{settings.unified
      ? t('调色立即应用整站；文字内容和特效种类保持不变。')
      : t('默认随机配色：底色保持统一，特效颜色按区块变化。')}</p>
    {settings.unified && <fieldset id="project-color-palette" className="bs-project-palette" disabled={disabled}>
      <legend>{t('整站调色盘')}</legend>
      <div className="bs-project-palette-presets" role="group" aria-label={t('预设配色')}>
        {PALETTE_LIBRARY.map(palette => <button type="button" key={palette.id}
          onClick={() => onPreset(palette.id)}
          aria-label={t('使用{{name}}配色', { name: t(palette.name) })}
          aria-pressed={fields.every(({ key }) => settings.colors[key].toLowerCase() === palette.appearance[key].toLowerCase())}>
          <span className="bs-project-palette-chips" aria-hidden="true">{fields.map(({ key }) => <i key={key} style={{ backgroundColor: palette.appearance[key] }} />)}</span>
          <span>{t(palette.name)}</span>
        </button>)}
      </div>
      <div className="bs-project-palette-fields">{fields.map(({ key, label }) => <label key={key}>
        <span>{t(label)}</span>
        <span className="bs-project-palette-input"><input type="color" value={settings.colors[key]}
          aria-label={t(label)} onChange={event => onColorChange(key, event.target.value)} /><code>{settings.colors[key].toUpperCase()}</code></span>
      </label>)}</div>
    </fieldset>}
  </div>;
}
