'use client';

import { useState } from 'react';
import { Film, Link2, X } from 'lucide-react';
import { useStudioI18n } from './studio-i18n';

export function BackgroundVideoPicker({ busy, onUpload, onUrl, onCancel }: { busy: boolean; onUpload: (file?: File) => void; onUrl: (url: string) => void; onCancel?: () => void }) {
  const { t } = useStudioI18n();
  const [url, setUrl] = useState('');
  return <div className="bs-video-picker">
    <div className="bs-video-picker-heading"><Film size={20} /><strong>{t('让视频成为这一块的背景')}</strong></div>
    <p>{t('视频铺在内容后方，文字、图片和按钮继续保留。')}</p>
    <label className={`bs-upload ${busy ? 'is-busy' : ''}`}><Film size={17} />{t(busy ? '正在读取视频…' : '选择本机视频')}<input type="file" aria-label={t('选择背景视频')} accept="video/mp4,video/webm,.mp4,.webm" disabled={busy} onChange={event => { onUpload(event.target.files?.[0]); event.target.value = ''; }} /></label>
    <small>{t('MP4 / WebM，单个 2 MB 以内；保存在本机项目，随网站一同导出。')}</small>
    <details><summary><Link2 size={14} />{t('使用视频直链')}</summary><label className="bs-field"><span>{t('HTTPS 视频地址')}</span><input type="url" value={url} placeholder="https://example.com/background.mp4" maxLength={2000} onChange={event => setUrl(event.target.value)} /></label><button type="button" className="bs-button" disabled={busy || !url.trim()} onClick={() => onUrl(url.trim())}>{t('应用视频地址')}</button><small>{t('需要可公开播放的视频文件地址，不能使用视频网站分享页。直链视频播放时需要联网。')}</small></details>
    {onCancel && <button type="button" className="bs-text-button" onClick={onCancel}><X size={14} />{t('取消选择视频')}</button>}
  </div>;
}
