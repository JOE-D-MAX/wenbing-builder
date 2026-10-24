'use client';
import { useStudioI18n } from './studio-i18n';
import { Plus, X } from 'lucide-react';
import type { BlockProject, SiteBlock } from '@/lib/block-model';

export function PortfolioBlockFields({ block, project, onChange }: { block: SiteBlock; project: BlockProject; onChange: (patch: Partial<SiteBlock>) => void }) {
  const { t } = useStudioI18n();
  const item = (index: number) => block.items[index] || { title: '', text: '' };
  const changeItem = (index: number, patch: Partial<SiteBlock['items'][number]>) => {
    const next = [...block.items];
    while (next.length <= index) next.push({ title: '', text: '' });
    next[index] = { ...next[index], ...patch }; onChange({ items: next });
  };
  const tags = (start: number) => <label className="bs-field"><span>{t(block.kind === 'hero' ? '首屏方向标签' : '技能标签')}</span><textarea rows={3} maxLength={1100} value={block.items.slice(start).map(item => item.title).join('\n')} onChange={event => onChange({ items: [...block.items.slice(0, start), ...event.target.value.split('\n').slice(0, 11).map(title => ({ title: title.slice(0, 100), text: '' }))] })} /><small>{t("每行一个标签。")}</small></label>;
  return <div className="bs-portfolio-fields">
    <h3>{t("作品集版式")}</h3>
    {block.kind !== 'nav' && <label className="bs-field"><span>{t("标题强调文字")}</span><input value={block.highlight || ''} maxLength={160} onChange={event => onChange({ highlight: event.target.value })} /><small>{t("输入标题中的文字，使用当前区块的强调色。")}</small></label>}
    {block.kind === 'project' && <label className="bs-field"><span>{t("区块宽度")}</span><select value={block.span || 'full'} onChange={event => onChange({ span: event.target.value as SiteBlock['span'] })}><option value="half">{t("半宽 · 电脑预览中两列排列")}</option><option value="full">{t("通栏 · 占满一行")}</option></select><small>{t("手机预览自动排成一列。")}</small></label>}
    {block.kind === 'text' && <label className="bs-field"><span>{t("文字版式")}</span><select value={block.presentation || ''} onChange={event => onChange({ presentation: event.target.value as SiteBlock['presentation'] || undefined })}><option value="">{t("正文")}</option><option value="section-heading">{t("作品区标题与筛选")}</option><option value="about">{t("关于介绍 · 双栏")}</option><option value="detail">{t("详情正文")}</option></select></label>}
    {block.kind === 'project' && <>
      <label className="bs-field"><span>{t("卡片版式")}</span><select value={block.presentation === 'business' ? 'business' : ''} onChange={event => onChange({ presentation: event.target.value === 'business' ? 'business' : undefined })}><option value="">{t("图片作品")}</option><option value="business">{t("文字展示")}</option></select></label>
      <label className="bs-field"><span>{t("画面上方文字")}</span><input value={item(0).title} maxLength={100} onChange={event => changeItem(0, { title: event.target.value })} /></label>
      <label className="bs-field"><span>{t("画面主题文字")}</span><textarea rows={2} value={item(0).text} maxLength={3000} onChange={event => changeItem(0, { text: event.target.value })} /></label>
      {block.presentation === 'business' && <label className="bs-field"><span>{t("画面底部说明")}</span><input value={block.items[2]?.text ?? '目标　／　计划　／　协同　／　交付'} maxLength={160} onChange={event => changeItem(2, { text: event.target.value })} /></label>}
      <label className="bs-field"><span>{t("筛选分类")}</span><select value={item(1).title || ''} onChange={event => changeItem(1, { title: event.target.value })}><option value="">{t("仅在全部实践中显示")}</option><option value="content">{t("AI 与内容")}</option><option value="workflow">{t("工作流与协同")}</option><option value="content workflow">{t("同时归入两类")}</option></select></label>
      <label className="bs-field"><span>{t("分类说明")}</span><input value={item(1).text} maxLength={100} onChange={event => changeItem(1, { text: event.target.value })} /></label>
    </>}
    {block.kind === 'nav' && <>
      <p className="bs-helper">{t("编辑导航名称，并选择它指向的页面区块。")}</p>
      {block.items.map((entry, index) => <div className="bs-nav-entry" key={index}>
        <label className="bs-field"><span>{t('导航名称 {{number}}', { number: index + 1 })}</span><input value={entry.title} maxLength={100} onChange={event => changeItem(index, { title: event.target.value })} /></label>
        <label className="bs-field"><span>{t('导航目标 {{number}}', { number: index + 1 })}</span><select value={entry.text} onChange={event => changeItem(index, { text: event.target.value })}><option value="">{t("选择目标区块")}</option>{project.pages.map(page => <optgroup label={page.title} key={page.id}>{page.blocks.filter(b => b.kind !== 'nav').map(b => <option key={b.id} value={b.id}>{b.title.replace(/\n/g, ' ').slice(0, 26) || t('未命名区块')}</option>)}</optgroup>)}</select></label>
        <button type="button" className="bs-text-button" onClick={() => onChange({ items: block.items.filter((_, i) => i !== index) })}><X size={13} />{t('移除导航 {{number}}', { number: index + 1 })}</button>
      </div>)}
      <button type="button" className="bs-button" disabled={block.items.length >= 6} onClick={() => onChange({ items: [...block.items, { title: t('导航名称'), text: '' }] })}><Plus size={15} />{t("添加导航")}</button>
    </>}
    {block.kind === 'hero' && <>
      <label className="bs-field"><span>{t("首屏身份文字")}</span><input value={item(0).title} maxLength={100} onChange={event => changeItem(0, { title: event.target.value })} /></label>
      <label className="bs-field"><span>{t("首屏右侧说明")}</span><input value={item(0).text} maxLength={100} onChange={event => changeItem(0, { text: event.target.value })} /></label>
      {tags(1)}
    </>}
    {block.presentation === 'about' && <>
      <label className="bs-field"><span>{t("个人字标")}</span><input value={item(0).title} maxLength={8} onChange={event => changeItem(0, { title: event.target.value })} /></label>
      <label className="bs-field"><span>{t("姓名与身份")}</span><textarea rows={3} value={item(0).text} maxLength={3000} onChange={event => changeItem(0, { text: event.target.value })} /></label>
      {tags(1)}
    </>}
  </div>;
}
