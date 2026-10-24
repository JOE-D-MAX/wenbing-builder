import { generateDraft } from './generator';
import { normalizeBrief } from './studio';

export type { Brief } from './studio';
export function readBrief(input:unknown) {
  const b=normalizeBrief(input);
  if(!b.name.trim()||b.text.trim().length<8)throw new Error('请填写名称和至少 8 个字的介绍。');
  const draft=generateDraft(b.kind,`名称：${b.name.replace(/[\r\n]/g,' ')}\n${b.text}\n${b.contact}`,b.prompt);
  return {...draft,image:b.image,headline:b.headline?.trim()||draft.headline,
    theme:b.theme&&b.theme!=='auto'?b.theme:draft.theme,
    layout:b.layout&&b.layout!=='auto'?b.layout:draft.layout,
    font:b.font&&b.font!=='auto'?b.font:draft.font};
}

// Template HTML is free to view; publication stays payment-gated.
export function previewSummary(input:unknown) {
  const d=readBrief(input);
  return {name:d.name,kind:d.kind,layout:d.layout,theme:d.theme,sectionCount:d.items.length+2};
}
