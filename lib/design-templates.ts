import { blockId, createBlock, PALETTE_LIBRARY, parseBlockProject, type BlockKind, type BlockProject, type DesignId, type SiteBlock } from './block-model';

/** Original editable placeholders: no reference-site text, images or identity data. */
export const DESIGN_TEMPLATES: { id: DesignId; name: string; description: string; kind: BlockKind }[] = [
  { id: 'editorial-nav', name: '悬浮导航', description: '圆角胶囊承托品牌文字和锚点入口', kind: 'nav' },
  { id: 'editorial-hero', name: '大字开场', description: '错落大字、荧光强调与留白', kind: 'hero' },
  { id: 'editorial-intro', name: '双栏介绍', description: '左侧标题与右侧说明，保持阅读节奏', kind: 'text' },
  { id: 'editorial-metrics', name: '数字成果', description: '用大字号排列自己的关键指标', kind: 'text' },
  { id: 'editorial-timeline', name: '经历条目', description: '分隔线、阶段标签和说明内容', kind: 'text' },
  { id: 'editorial-project', name: '图片项目', description: '大幅视觉与项目详情跳转', kind: 'project' },
  { id: 'editorial-steps', name: '步骤列表', description: '顺序编号与点击展开的步骤', kind: 'accordion' },
  { id: 'editorial-contact', name: '收尾行动', description: '醒目标题、说明与独立行动入口', kind: 'contact' },
];

export function createDesignBlock(id: DesignId): SiteBlock {
  const template = DESIGN_TEMPLATES.find(item => item.id === id);
  if (!template) throw new Error('找不到这个设计模板。');
  const base = createBlock(template.kind);
  const appearance = { ...PALETTE_LIBRARY.find(item => item.id === 'ink-lime')!.appearance };
  const content: Record<DesignId, Partial<SiteBlock>> = {
    'editorial-nav': { title: '你的品牌', items: [{ title: '内容介绍', text: '' }, { title: '项目展示', text: '' }, { title: '行动入口', text: '' }] },
    'editorial-hero': { eyebrow: '在这里填写一句开场白', title: '填写你的\n主标题', text: '用一两句话介绍你的主题。内容可以随时替换，设计会随文字一起调整。', button: '查看内容', effects: ['curtain'] },
    'editorial-intro': { eyebrow: '主题介绍', title: '在这里介绍\n你的创作方向', text: '写下你希望读者了解的背景、方法或想法。保持简洁，让这一段成为下一部分内容的起点。', button: '' },
    'editorial-metrics': { eyebrow: '关键指标', title: '用你的成果说话', text: '将占位符替换为自己确认过的数据。', button: '', items: [{ title: '—', text: '填写指标名称' }, { title: '—', text: '填写指标名称' }, { title: '—', text: '填写指标名称' }] },
    'editorial-timeline': { eyebrow: '阶段记录', title: '记录重要的阶段', text: '自由整理你的学习、创作或项目经历。', button: '', items: [{ title: '阶段一', text: '填写时间、主题与这一阶段的说明。' }, { title: '阶段二', text: '填写时间、主题与这一阶段的说明。' }, { title: '阶段三', text: '填写时间、主题与这一阶段的说明。' }] },
    'editorial-project': { eyebrow: '项目展示', title: '你的项目标题', text: '介绍项目的出发点、过程和结果。上传自己的图片，也可以保留这幅抽象图形。', button: '查看项目', effects: ['zoom'] },
    'editorial-steps': { eyebrow: '制作步骤', title: '把过程讲清楚', text: '点击步骤查看说明，也可以自由增加或调整顺序。', button: '', items: [{ title: '明确目标', text: '填写这一阶段的目标和需要准备的内容。' }, { title: '展开实践', text: '填写你如何推进工作与验证想法。' }, { title: '整理成果', text: '填写交付方式与后续计划。' }] },
    'editorial-contact': { eyebrow: '行动入口', title: '为下一步\n留一个入口', text: '填写你希望访客接下来做什么，并为按钮设置自己的跳转。', button: '设置你的行动入口' },
  };
  return { ...base, design: id, theme: 'dark', appearance: id === 'editorial-hero' ? { ...appearance, background: 'halo' } : appearance, ...content[id] };
}

/** A separate opt-in project, never a replacement for the user's stored draft. */
export function createDesignStarterProject(): BlockProject {
  const homeId = blockId('page');
  const detailId = blockId('page');
  const blocks = DESIGN_TEMPLATES.map(item => createDesignBlock(item.id));
  const [nav, hero, intro, , , project, , contact] = blocks;
  nav.items = [{ title: '内容介绍', text: intro.id }, { title: '项目展示', text: project.id }, { title: '行动入口', text: contact.id }];
  hero.link = { type: 'section', target: project.id };
  project.link = { type: 'page', target: detailId };
  const detailHero = createDesignBlock('editorial-hero');
  detailHero.title = '详情标题\n由你填写';
  detailHero.eyebrow = '独立详情示例';
  detailHero.text = '这是一个独立页面。修改标题、说明和图片，就可以继续完善自己的项目介绍。';
  detailHero.button = '返回首页';
  detailHero.link = { type: 'page', target: homeId };
  const detailBody = createDesignBlock('editorial-intro');
  detailBody.title = '补充项目内容';
  detailBody.text = '在这里介绍自己的过程、选择与收获。示例没有预填任何人物、机构或作品信息。';
  return parseBlockProject({ version: 1, name: '墨黑荧绿 · 设计练习', accent: '#d9fb68', pages: [{ id: homeId, title: '首页', blocks }, { id: detailId, title: '详情示例', blocks: [detailHero, detailBody] }] });
}
