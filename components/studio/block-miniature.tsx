'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ArrowRight, ImagePlus, Layers3, Plus } from 'lucide-react';
import { BLOCK_LIBRARY, appearanceStyle, getBlockAppearance, type EffectId, type SiteBlock } from '@/lib/block-model';
import { DesignMiniature } from './design-miniature';
import { BackgroundVideo } from './background-video';
import { useStudioI18n } from './studio-i18n';

/** Editor-only motion: never stored in project data or included in exported HTML. */
export function BlockMiniature({ block, small = false, accent, playing = true, demoEffect }: { block: SiteBlock; small?: boolean; accent?: string; playing?: boolean; demoEffect?: EffectId }) {
  const { t } = useStudioI18n();
  // Small cards are generated library examples. Canvas content stays exactly as authored.
  const exampleText = (value: string) => small ? t(value) : value;
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [inView, setInView] = useState(false);
  const [entered, setEntered] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const effects = block.effects;
  const appearance = getBlockAppearance(block, accent);
  const hasAmbient = effects.includes('ambient');
  const live = (!small || hasAmbient) && playing && inView && (!hasAmbient || documentVisible);
  useEffect(() => {
    if (!hasAmbient) return;
    const syncVisibility = () => setDocumentVisible(!document.hidden);
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, [hasAmbient]);
  useEffect(() => { if (live) setEntered(true); }, [live]);
  const label = t(BLOCK_LIBRARY.find(item => item.kind === block.kind)?.name || '完整网站');
  useEffect(() => {
    const node = ref.current;
    if (!node || (small && !hasAmbient)) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const observer = new IntersectionObserver(entries => setInView(entries.some(entry => entry.isIntersecting)), { threshold: .04 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [small, hasAmbient]);
  useEffect(() => {
    if (!live && ref.current) delete ref.current.dataset.lit;
    if (!live && frame.current) { cancelAnimationFrame(frame.current); frame.current = 0; }
    return () => { if (frame.current) cancelAnimationFrame(frame.current); frame.current = 0; };
  }, [live]);
  const point = useRef({ x: 0, y: 0 });
  const moveLight = (event: PointerEvent<HTMLDivElement>) => {
    if (!live || !effects.includes('spotlight') || event.pointerType === 'touch') return;
    const node = event.currentTarget;
    const box = node.getBoundingClientRect();
    point.current = { x: event.clientX - box.left, y: event.clientY - box.top };
    node.dataset.lit = 'true';
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      node.style.setProperty('--canvas-light-x', `${point.current.x}px`);
      node.style.setProperty('--canvas-light-y', `${point.current.y}px`);
      frame.current = 0;
    });
  };
  const leaveLight = () => {
    if (ref.current) delete ref.current.dataset.lit;
    if (frame.current) { cancelAnimationFrame(frame.current); frame.current = 0; }
  };
  const classes = effects.map(effect => `bs-canvas-fx-${effect}`).join(' ');
  return <div ref={ref} className={`bs-mini bs-mini-${block.kind} ${block.design ? `bs-mini-design bs-mini-design-${block.design}` : ''} ${effects.includes('spotlight') ? 'has-spotlight' : ''} ${small ? 'is-small' : `bs-canvas-live ${classes}`} ${live ? 'is-running' : ''} ${entered ? 'has-entered' : ''}`} data-demo={demoEffect && effects.includes(demoEffect) ? demoEffect : undefined} style={appearanceStyle(appearance) as CSSProperties} onPointerMove={moveLight} onPointerLeave={leaveLight}>
    {appearance.background === 'video' && block.backgroundVideo && <BackgroundVideo video={block.backgroundVideo} playing={playing} small={small} />}
    {effects.includes('stars') && <span className="bs-mini-stars" aria-hidden="true" />}
    {hasAmbient && <span className="bs-mini-ambient" aria-hidden="true"><i /><i /></span>}
    {effects.includes('spotlight') && <span className="bs-mini-glow" aria-hidden="true" />}
    {effects.includes('curtain') && !small && <span className="bs-mini-curtain" aria-hidden="true"><i /><i /></span>}
    <div className="bs-mini-reveal-stage"><div className="bs-mini-lift-stage">
      {block.design ? <DesignMiniature block={block} /> : block.kind === 'surface' ? (block.image && !block.title && !block.text ? null : <div className="bs-surface-placeholder"><Layers3 size={24} /><span>{block.title ? exampleText(block.title) : t('空白区块')}</span>{block.text && <p>{exampleText(block.text)}</p>}</div>) : block.kind === 'nav' ? <><strong>{block.title ? exampleText(block.title) : t('我的网站')}</strong><span className="bs-mini-nav">{t('关于 · 作品 · 联系')} <ArrowRight size={12} /></span></> : block.kind === 'embed' ? <><span className="bs-mini-kicker">IMPORTED WEBSITE</span><h3>{block.title || t('完整网站')}</h3><p>{t('原布局已保留 · 在预览中查看完整网页')}</p><div className="bs-embed-lines"><i /><i /><i /></div></> : <>
        {block.image && block.kind === 'project' && <div className="bs-mini-image-clip"><img src={block.image} alt="" loading="lazy" className="bs-mini-image" /></div>}
        <div className="bs-mini-content">
          {block.eyebrow && <span className="bs-mini-kicker">{exampleText(block.eyebrow)}</span>}
          <h3>{block.title ? exampleText(block.title) : label}</h3>
          {block.text && <p>{exampleText(block.text)}</p>}
          {block.kind === 'accordion' && <div className="bs-mini-accordion">{block.items.slice(0, 3).map((item, i) => <div key={i}><span>0{i + 1}　{exampleText(item.title)}</span><Plus size={13} /></div>)}</div>}
          {block.button && <span className="bs-mini-button">{exampleText(block.button)}<ArrowRight size={12} /></span>}
          {block.kind === 'project' && !block.image && <div className="bs-mini-image-placeholder"><ImagePlus size={30} /><span>{t(effects.includes('zoom') ? '上传图片后，可在这里看到放大效果' : '添加自己的图片')}</span></div>}
        </div>
      </>}
      {!block.design && block.image && block.kind !== 'project' && block.kind !== 'embed' && <div className="bs-mini-image-clip bs-mini-extra-image"><img src={block.image} alt="" loading="lazy" className="bs-mini-image" /></div>}
    </div></div>
  </div>;
}
