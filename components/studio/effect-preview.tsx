'use client';
import { useStudioI18n } from './studio-i18n';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { MousePointer2 } from 'lucide-react';
import type { EffectId } from '@/lib/block-model';

export function usePreviewMotion() {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReduced(media.matches);
    const syncVisibility = () => setVisible(!document.hidden);
    syncMotion(); syncVisibility();
    media.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => { media.removeEventListener('change', syncMotion); document.removeEventListener('visibilitychange', syncVisibility); };
  }, []);
  return { paused, reduced, playing: !paused && !reduced && visible, toggle: () => setPaused(value => !value) };
}

/** Small self-contained demonstrations; no animation loop runs outside the viewport. */
export function EffectPreview({ effect, playing }: { effect: EffectId; playing: boolean }) {
  const { t } = useStudioI18n();
  const ref = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const observer = new IntersectionObserver(entries => setInView(entries.some(entry => entry.isIntersecting)), { threshold: .08 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <span ref={ref} className={`bs-live-preview bs-live-${effect} ${playing && inView ? 'is-playing' : 'is-still'}`} aria-hidden="true">
    <span className="bs-live-label">{t(playing ? '动态演示' : '静态预览')}</span>
    {effect === 'spotlight' && <><span className="bs-demo-light" /><span className="bs-demo-type">LIGHT<br /><small>{t("光随指针移动")}</small></span><MousePointer2 className="bs-demo-cursor" size={21} /></>}
    {effect === 'stars' && <><span className="bs-demo-stars bs-demo-stars-near" /><span className="bs-demo-stars bs-demo-stars-far" /><span className="bs-demo-orbit" /><span className="bs-demo-type">STARFIELD<br /><small>{t("星点缓慢漂移")}</small></span></>}
    {effect === 'ambient' && <><span className="bs-demo-ambient"><i /><i /></span><span className="bs-demo-type">{t("雾光流动")}<br /><small>{t("光晕缓慢漂移")}</small></span></>}
    {effect === 'zoom' && <><span className="bs-demo-photo"><img src="/sample-cafe-800.webp" alt="" width={800} height={533} loading="lazy" draggable={false} /></span><span className="bs-demo-photo-caption">{t("示意图片 · 悬停放大")}</span></>}
    {effect === 'reveal' && <span className="bs-demo-reveal"><span style={{ '--delay': '0s' } as CSSProperties}>{t("每一段内容")}</span><strong style={{ '--delay': '.25s' } as CSSProperties}>{t("渐次浮现")}</strong><i style={{ '--delay': '.5s' } as CSSProperties} /></span>}
    {effect === 'lift' && <><span className="bs-demo-floor" /><span className="bs-demo-lift"><span>HOVER</span><strong>{t("轻轻浮起")}</strong><i /></span><MousePointer2 className="bs-demo-lift-cursor" size={19} /></>}
    {effect === 'curtain' && <><span className="bs-demo-curtain-content"><small>{t("让内容登场")}</small><strong>{t("开场揭幕")}</strong><i /></span><span className="bs-demo-curtain-panels"><i /><i /></span></>}
    <span className="bs-live-drag-hint">{t("拖动此预览")}</span>
  </span>;
}
