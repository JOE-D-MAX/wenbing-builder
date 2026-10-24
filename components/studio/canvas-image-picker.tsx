'use client';

import { ImagePlus, X } from 'lucide-react';
import { useStudioI18n } from './studio-i18n';

export function CanvasImagePicker({ busy, onUpload, onCancel }: { busy: boolean; onUpload: (file?: File) => void; onCancel?: () => void }) {
  const { t } = useStudioI18n();
  return <div className="bs-canvas-image-picker">
    <div><ImagePlus size={22} /><strong>{t('选择一张图片，立即查看放大效果')}</strong></div>
    <p>{t('保留当前区块的配色、文字和其他特效。')}</p>
    <label className={`bs-upload ${busy ? 'is-busy' : ''}`}><ImagePlus size={17} />{t(busy ? '正在处理图片…' : '选择图片并应用放大')}<input type="file" aria-label={t('选择图片并应用放大')} accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { onUpload(event.target.files?.[0]); event.target.value = ''; }} /></label>
    <small>{t('支持 JPG、PNG、WebP，自动压缩，仅保存在本机项目。')}</small>
    {onCancel && <button type="button" className="bs-text-button" onClick={onCancel}><X size={14} />{t('取消添加图片')}</button>}
  </div>;
}
