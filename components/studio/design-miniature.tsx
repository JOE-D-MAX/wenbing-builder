'use client';

import { ArrowDown, ArrowUpRight, Plus } from 'lucide-react';
import type { SiteBlock } from '@/lib/block-model';
import { useStudioI18n } from './studio-i18n';

/** Editable compositions, never a screenshot or an embed of the reference site. */
export function DesignMiniature({ block }: { block: SiteBlock }) {
  const { t } = useStudioI18n();
  const heading = <>{block.eyebrow && <span className="bs-design-eyebrow"><i aria-hidden="true" />{block.eyebrow}</span>}<h3>{block.title || t('填写你的标题')}</h3></>;
  const action = block.button ? <span className="bs-design-action">{block.button}<ArrowUpRight size={16} aria-hidden="true" /></span> : null;
  const media = <div className="bs-design-media bs-mini-image-clip">{block.image
    ? <img className="bs-mini-image" src={block.image} alt="" loading="lazy" draggable={false} />
    : <div className="bs-design-geometry bs-mini-image" aria-hidden="true"><i /><i /><i /><span /></div>}</div>;

  switch (block.design) {
    case 'editorial-nav':
      return <div className="bs-design bs-design-nav"><div className="bs-design-nav-glass"><strong>{block.title || t('网站名称')}</strong><span className="bs-design-nav-items">{block.items.slice(0, 6).map((item, i) => <span key={i}>{item.title}</span>)}</span>{action || <ArrowUpRight size={16} aria-hidden="true" />}</div></div>;
    case 'editorial-hero':
      return <div className="bs-design bs-design-hero"><div className="bs-design-hero-copy">{heading}{block.text && <p>{block.text}</p>}{action}</div>{media}<span className="bs-design-scroll" aria-hidden="true"><ArrowDown size={17} /></span></div>;
    case 'editorial-intro':
      return <div className="bs-design bs-design-intro"><div className="bs-design-intro-heading">{heading}{media}</div><div className="bs-design-intro-copy"><span className="bs-design-round-arrow" aria-hidden="true"><ArrowUpRight size={26} /></span>{block.text && <p>{block.text}</p>}{block.items.length > 0 && <div className="bs-design-tags">{block.items.map((item, i) => <span key={i}>{item.title}</span>)}</div>}{action}</div></div>;
    case 'editorial-metrics':
      return <div className="bs-design bs-design-metrics"><div className="bs-design-section-heading">{heading}{block.text && <p>{block.text}</p>}</div><div className="bs-design-metric-grid">{block.items.map((item, i) => <div key={i}><strong>{item.title || '—'}</strong><span>{item.text || t('填写说明')}</span></div>)}</div></div>;
    case 'editorial-timeline':
      return <div className="bs-design bs-design-timeline"><div className="bs-design-section-heading">{heading}{block.text && <p>{block.text}</p>}</div><div className="bs-design-timeline-list">{block.items.map((item, i) => <div key={i}><i aria-hidden="true" /><strong>{item.title || t('填写阶段')}</strong><p>{item.text}</p><ArrowUpRight size={17} aria-hidden="true" /></div>)}</div></div>;
    case 'editorial-project':
      return <div className="bs-design bs-design-project">{media}<div className="bs-design-project-copy">{heading}{block.text && <p>{block.text}</p>}{block.items.length > 0 && <div className="bs-design-tags">{block.items.map((item, i) => <span key={i}>{item.title}</span>)}</div>}{action}</div></div>;
    case 'editorial-steps':
      return <div className="bs-design bs-design-steps"><div className="bs-design-section-heading">{heading}{block.text && <p>{block.text}</p>}</div><div className="bs-design-step-list">{block.items.map((item, i) => <div key={i}><span className="bs-design-step-marker" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><div><strong>{item.title || t('填写步骤')}</strong><p>{item.text}</p></div><Plus size={18} aria-hidden="true" /></div>)}</div></div>;
    case 'editorial-contact':
      return <div className="bs-design bs-design-contact"><span className="bs-design-contact-orbit" aria-hidden="true" />{heading}{block.text && <p>{block.text}</p>}{action}{block.image && media}</div>;
    default:
      return null;
  }
}
