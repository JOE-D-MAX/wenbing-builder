'use client';
import { useStudioI18n } from './studio-i18n';

import { Plus, X } from 'lucide-react';
import type { BlockProject, SiteBlock } from '@/lib/block-model';
import { DESIGN_TEMPLATES } from '@/lib/design-templates';

export function DesignBlockFields({ block, project, onChange }: { block: SiteBlock; project: BlockProject; onChange: (patch: Partial<SiteBlock>) => void }) {
  const { t } = useStudioI18n();
  const definition = DESIGN_TEMPLATES.find(item => item.id === block.design);
  const navigation = block.design === 'editorial-nav';
  const isList = navigation || ['editorial-metrics', 'editorial-timeline', 'editorial-steps'].includes(block.design || '') || block.items.length > 0;
  const limit = navigation ? 6 : 12;
  const changeItem = (index: number, patch: Partial<SiteBlock['items'][number]>) => onChange({ items: block.items.map((item, i) => i === index ? { ...item, ...patch } : item) });
  return <div className="bs-design-fields">
    <h3 className="bs-property-subtitle">{t(definition?.name || '设计模板')}</h3>
    <p className="bs-helper">{t("这是可编辑的版式。文字、颜色、图片和跳转都可以换成自己的内容。")}</p>
    {isList && <>
      {block.items.map((item, index) => <div className="bs-design-entry" key={index}>
        <label className="bs-field"><span>{t(navigation ? '导航文字 {{number}}' : block.design === 'editorial-metrics' ? '展示数值 {{number}}' : '条目标题 {{number}}', { number: index + 1 })}</span><input value={item.title} maxLength={100} onChange={event => changeItem(index, { title: event.target.value })} /></label>
        {navigation ? <label className="bs-field"><span>{t('导航目标 {{number}}', { number: index + 1 })}</span><select value={item.text} onChange={event => changeItem(index, { text: event.target.value })}><option value="">{t("请选择目标区块")}</option>{project.pages.map(page => <optgroup key={page.id} label={page.title}>{page.blocks.filter(candidate => candidate.kind !== 'nav').map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.title.replace(/\n/g, ' ').slice(0, 26) || t('未命名区块')}</option>)}</optgroup>)}</select></label> : <label className="bs-field"><span>{t('条目说明 {{number}}', { number: index + 1 })}</span><textarea rows={2} value={item.text} maxLength={3000} onChange={event => changeItem(index, { text: event.target.value })} /></label>}
        <button type="button" className="bs-text-button" onClick={() => onChange({ items: block.items.filter((_, i) => i !== index) })}><X size={13} />{t('移除条目 {{number}}', { number: index + 1 })}</button>
      </div>)}
      <button type="button" className="bs-button" disabled={block.items.length >= limit} onClick={() => onChange({ items: [...block.items, { title: t(navigation ? '新导航' : '新条目'), text: '' }] })}><Plus size={15} />{t(navigation ? '添加导航' : '添加条目')}</button>
      {block.design === 'editorial-metrics' && <p className="bs-helper">{t("示例不预设成绩，请填写自己的真实数据。")}</p>}
    </>}
  </div>;
}
