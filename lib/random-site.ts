import { MAX_BLOCKS, MAX_PAGES, blockId, createBlock, type BlockKind, type BlockPage, type BlockProject, type SiteBlock } from './block-model';
import { randomizePageStyle } from './random-block-style';

type Locale = 'zh' | 'en';
type RandomSiteOptions = { pageCount?: number; random?: () => number; locale?: Locale };
type RandomSiteResult = { project: BlockProject; changed: number; pageCount: number; added: number; removed: number; paletteName: string };
type Copy = readonly [string, string];
type Content = { kind: BlockKind; title: Copy; text?: Copy; items?: readonly { title: Copy; text: Copy }[] };
type PageRecipe = { title: Copy; headline: Copy; intro: Copy; content: readonly Content[] };

// Neutral, editable examples: no names, contact details, claims, or remote assets.
const recipes: readonly PageRecipe[] = [
  {
    title: ['首页', 'Home'], headline: ['让想法有一个自己的地方', 'A place for your ideas'],
    intro: ['用这一页介绍你正在做的事，再带访客探索作品、服务与故事。所有内容都可以继续编辑。', 'Introduce what you do, then invite visitors to explore your work, services, and story. Every part is yours to edit.'],
    content: [
      { kind: 'text', title: ['从这里认识你', 'Start with your story'], text: ['写下你的方向、关注的问题，以及希望为访客带来的价值。', 'Describe your focus, the questions you explore, and the value you bring to visitors.'] },
      { kind: 'project', title: ['一个值得分享的项目', 'A project worth sharing'], text: ['上传自己的图片，补充项目背景、思考过程和最终呈现。', 'Add your own image, project background, process, and final result.'] },
    ],
  },
  {
    title: ['关于', 'About'], headline: ['故事从一个想法开始', 'It starts with an idea'],
    intro: ['介绍你的经历、工作方式和长期关注的方向，让访客了解这个网站背后的想法。', 'Share your background, approach, and interests to introduce the ideas behind this website.'],
    content: [
      { kind: 'text', title: ['我们的出发点', 'Our starting point'], text: ['在这里记录为什么开始，以及你希望做出怎样的改变。', 'Explain why you started and the difference you hope to make.'] },
      { kind: 'accordion', title: ['我们重视什么', 'What matters to us'], items: [
        { title: ['清晰表达', 'Clarity'], text: ['用简单的语言说明目标，让每一个选择都有依据。', 'Explain the goal simply and give each decision a reason.'] },
        { title: ['持续打磨', 'Care'], text: ['从反馈中学习，逐步完善细节与体验。', 'Learn from feedback and refine the details and experience.'] },
      ] },
    ],
  },
  {
    title: ['服务', 'Services'], headline: ['把需要变成具体的方案', 'Turn a need into a clear plan'],
    intro: ['展示你能提供的帮助，说明适合谁、包含哪些工作，以及如何开始。', 'Explain how you can help, who it is for, what is included, and how to get started.'],
    content: [
      { kind: 'accordion', title: ['可以一起做的事', 'Ways to work together'], items: [
        { title: ['梳理方向', 'Explore the direction'], text: ['了解背景与目标，整理需要优先解决的问题。', 'Understand the context and goals, then identify the questions to address first.'] },
        { title: ['方案设计', 'Design the approach'], text: ['把想法转成可讨论的方案，并通过反馈逐步调整。', 'Make an idea tangible and refine it through feedback.'] },
        { title: ['落地与完善', 'Build and refine'], text: ['完成必要的内容与细节，并为后续更新留出空间。', 'Complete the content and details while leaving room for future updates.'] },
      ] },
      { kind: 'text', title: ['为你的目标而设计', 'Designed around your goal'], text: ['替换这里的说明，写清服务范围、交付内容和合作方式。', 'Replace this copy with your scope, deliverables, and collaboration process.'] },
    ],
  },
  {
    title: ['作品', 'Work'], headline: ['把过程与成果一起展示', 'Show the work and the thinking'],
    intro: ['选择有代表性的项目，用图片和文字讲清问题、过程与结果。', 'Choose representative projects and explain the challenge, process, and outcome with images and words.'],
    content: [
      { kind: 'project', title: ['项目一：从观察到构想', 'Project one: from observation to concept'], text: ['这里可以展示项目背景、最初的发现，以及你的设计方向。', 'Share the background, early observations, and design direction.'] },
      { kind: 'project', title: ['项目二：从构想到实现', 'Project two: from concept to creation'], text: ['上传项目图片，记录关键选择，以及最后呈现的细节。', 'Add project images, key decisions, and details of the final result.'] },
    ],
  },
  {
    title: ['流程', 'Process'], headline: ['每一步都有清楚的方向', 'A clear direction at every step'],
    intro: ['向访客说明从初次沟通到完成项目的过程，让下一步更容易理解。', 'Walk visitors through the journey from the first conversation to the finished project.'],
    content: [
      { kind: 'accordion', title: ['从沟通开始', 'Start with a conversation'], items: [
        { title: ['第一步：了解目标', 'Step one: understand the goal'], text: ['整理背景、需求和现有资料。', 'Gather the context, requirements, and available materials.'] },
        { title: ['第二步：确定方向', 'Step two: define the direction'], text: ['讨论方案，明确优先级和需要完成的内容。', 'Discuss an approach, agree on priorities, and define the work.'] },
        { title: ['第三步：制作与反馈', 'Step three: create and review'], text: ['分阶段展示进展，并根据反馈完善。', 'Share progress in stages and refine it with feedback.'] },
        { title: ['第四步：交付与更新', 'Step four: deliver and maintain'], text: ['检查最终内容，整理后续使用与更新方式。', 'Review the final content and explain how to use and update it.'] },
      ] },
      { kind: 'text', title: ['让信息始终清晰', 'Keep everyone informed'], text: ['在这里补充你的沟通方式、所需资料和每个阶段的安排。', 'Add your communication approach, required materials, and plans for each stage.'] },
    ],
  },
  {
    title: ['常见问题', 'FAQ'], headline: ['把疑问留在这里，把答案带走', 'Questions, answered'],
    intro: ['整理访客最关心的问题，并填写与你的实际情况一致的回答。', 'Collect the questions visitors ask most often and answer them based on your own experience.'],
    content: [
      { kind: 'accordion', title: ['开始之前', 'Before you begin'], items: [
        { title: ['需要准备什么资料？', 'What should I prepare?'], text: ['你可以在这里列出目标、参考资料、文字和图片等准备事项。', 'List useful preparation such as goals, references, copy, and images here.'] },
        { title: ['如何确认工作范围？', 'How is the scope agreed?'], text: ['说明你如何讨论需求、确认内容，并处理后续调整。', 'Explain how you discuss requirements, agree on the scope, and handle changes.'] },
        { title: ['完成后可以继续更新吗？', 'Can the work be updated later?'], text: ['补充实际可提供的更新方式、使用说明和支持范围。', 'Describe the updates, instructions, and support you actually provide.'] },
      ] },
    ],
  },
  {
    title: ['联系', 'Contact'], headline: ['下一个故事，从交流开始', 'The next story starts with a conversation'],
    intro: ['在这里补充你希望公开的联系渠道。页面暂未包含任何个人联系方式。', 'Add the contact channels you want to make public. No personal contact details have been included.'],
    content: [
      { kind: 'text', title: ['聊聊你的想法', 'Tell us about your idea'], text: ['介绍项目背景、想实现的目标，以及你希望得到的帮助。准备好后，可将区块按钮设置为自己的联系方式。', 'Share the background, the goal, and the help you need. When ready, set a block button to your own contact link.'] },
    ],
  },
  {
    title: ['灵感记录', 'Notes'], headline: ['记录正在发生的想法', 'Ideas along the way'],
    intro: ['分享观察、学习与实践中的片段，让这个网站持续生长。', 'Share observations, lessons, and experiments as your website grows.'],
    content: [
      { kind: 'text', title: ['一次新的观察', 'A fresh observation'], text: ['用这一块记录最近关注的问题、发现的细节，或值得继续探索的方向。', 'Use this space for a question, a detail you noticed, or a direction to explore.'] },
      { kind: 'text', title: ['一个小小的尝试', 'A small experiment'], text: ['写下尝试的过程、获得的反馈，以及下一次想改进的地方。', 'Describe an experiment, what you learned from feedback, and what to try next.'] },
    ],
  },
  {
    title: ['资源', 'Resources'], headline: ['让有用的经验更容易找到', 'Make useful knowledge easy to find'],
    intro: ['整理实践中使用的资料、方法和建议，帮助访客找到适合自己的起点。', 'Collect the materials, methods, and ideas from your practice to help visitors find a starting point.'],
    content: [
      { kind: 'text', title: ['从基础开始', 'Start with the essentials'], text: ['介绍你常用的准备方法、整理思路，以及使用这些资料时需要注意的地方。', 'Share how you prepare, organize your thinking, and use these materials.'] },
      { kind: 'accordion', title: ['使用指南', 'A practical guide'], items: [
        { title: ['如何选择适合的资料？', 'How do I choose useful material?'], text: ['先明确当前目标，再挑选与实际问题相关的内容。', 'Start with your current goal and choose material relevant to the task.'] },
        { title: ['如何把学习用于实践？', 'How do I put learning into practice?'], text: ['从一个小任务开始，记录过程与反馈，再逐步调整。', 'Begin with a small task, record the process and feedback, then adjust.'] },
      ] },
    ],
  },
  {
    title: ['动态', 'Updates'], headline: ['分享每一个新的进展', 'Share what is taking shape'],
    intro: ['在这里发布项目进展、内容更新与新的尝试，让访客了解网站最近的变化。', 'Share project progress, content updates, and new experiments so visitors can follow what is changing.'],
    content: [
      { kind: 'text', title: ['正在进行', 'In progress'], text: ['写下近期正在关注的事情，以及值得分享的过程和发现。', 'Describe what you are working on and the process or discoveries worth sharing.'] },
      { kind: 'text', title: ['接下来想做的事', 'What comes next'], text: ['补充下一阶段的计划，并在有新进展时继续更新这一页。', 'Outline your next steps and return to this page as the work develops.'] },
    ],
  },
];

function fraction(random: () => number): number {
  const value = random();
  return Number.isFinite(value) ? Math.max(0, Math.min(1 - Number.EPSILON, value)) : 0;
}

/** Configure exactly 1–10 pages; the caller can undo the complete operation. */
export function randomizeSite(project: BlockProject, options: RandomSiteOptions = {}): RandomSiteResult {
  const requested = options.pageCount === undefined ? 7 : options.pageCount;
  if (!Number.isInteger(requested) || requested < 1 || requested > MAX_PAGES) {
    throw new Error(options.locale === 'en' ? 'Enter a whole number from 1 to 10 for the page count.' : '网页数量请输入 1–10 的整数。');
  }
  const random = options.random || Math.random;
  const pageCount = requested;
  const copy = (value: Copy) => value[options.locale === 'en' ? 1 : 0];
  const ids = new Set(project.pages.flatMap(page => [page.id, ...page.blocks.map(block => block.id)]));
  const freshId = (prefix: string) => {
    let id = blockId(prefix);
    while (ids.has(id)) id = blockId(prefix);
    ids.add(id);
    return id;
  };
  const makeBlock = (kind: BlockKind, content: Partial<SiteBlock> = {}): SiteBlock => {
    const block = createBlock(kind);
    if (ids.has(block.id)) block.id = freshId('b');
    else ids.add(block.id);
    return { ...block, ...content };
  };
  const pages = project.pages.slice(0, pageCount);
  const removedPages = project.pages.slice(pageCount);
  const removedPageIds = new Set(removedPages.map(page => page.id));
  const removedBlockIds = new Set(removedPages.flatMap(page => page.blocks.map(block => block.id)));
  while (pages.length < pageCount) {
    const base = copy(recipes[pages.length].title);
    let title = base, suffix = 2;
    while (pages.some(page => page.title === title)) title = base + ' ' + suffix++;
    pages.push({ id: freshId('page'), title, blocks: [] });
  }
  const filled = pages.map((page, index): BlockPage => {
    const recipe = recipes[index];
    const next = pages[(index + 1) % pages.length];
    const nav = () => makeBlock('nav', { title: copy(['你的网站', 'Your website']) });
    // Preserve authored blocks and ordering; only add a way to reach the new pages.
    if (page.blocks.length) {
      return page.blocks.some(block => block.kind === 'nav') || page.blocks.length >= MAX_BLOCKS
        ? page : { ...page, blocks: [nav(), ...page.blocks] };
    }
    const details = recipe.content.map(content => makeBlock(content.kind, {
      title: copy(content.title), text: content.text ? copy(content.text) : '', button: '',
      items: content.items?.map(item => ({ title: copy(item.title), text: copy(item.text) })) || [],
      ...(content.kind === 'project' ? { button: copy(['展开详情', 'View details']), link: { type: 'modal' as const, target: '' } } : {}),
    }));
    if (details.length > 1 && fraction(random) >= .5) details.reverse();
    const heading = makeBlock(index === 0 || fraction(random) < .5 ? 'hero' : 'text', {
      eyebrow: copy(recipe.title), title: copy(recipe.headline), text: copy(recipe.intro), button: '',
    });
    const closing = makeBlock(fraction(random) < .5 ? 'contact' : 'signature', {
      title: copy(pages.length === 1 ? ['回到内容', 'Revisit the details'] : ['继续探索', 'Keep exploring']),
      text: copy(pages.length === 1 ? ['回到上方，继续查看本页介绍与作品。', 'Return to the introduction and work on this page.'] : ['下一页，还有更多内容。', 'There is more to discover on the next page.']),
      button: pages.length === 1 ? copy(['浏览本页内容', 'Explore this page']) : (copy(['前往', 'Explore']) + ' ' + next.title).slice(0, 60).replace(/[\uD800-\uDBFF]$/, ''),
      link: pages.length === 1 ? { type: 'section', target: details[0].id } : { type: 'page', target: next.id },
    });
    return { ...page, blocks: [nav(), heading, ...details, closing] };
  });

  // Repair only links affected by this reduction; authored valid and external links stay intact.
  const linked = filled.map(page => ({ ...page, blocks: page.blocks.map(block => {
    const sectionNav = (project.layout === 'portfolio' && block.kind === 'nav') || block.design === 'editorial-nav';
    const items = sectionNav ? block.items.filter(item => !removedBlockIds.has(item.text)) : block.items;
    const kept = items.length === block.items.length ? block : { ...block, items };
    const removedPageLink = block.link.type === 'page' && removedPageIds.has(block.link.target);
    const removedSectionLink = block.link.type === 'section' && removedBlockIds.has(block.link.target);
    if (!removedPageLink && !removedSectionLink) return kept;
    const section = [...page.blocks, ...filled.flatMap(item => item.blocks)]
      .find(item => item.id !== block.id && item.kind !== 'nav' && item.kind !== 'embed');
    const link = (filled.length === 1 || removedSectionLink) && section
      ? { type: 'section' as const, target: section.id }
      : { type: 'page' as const, target: filled[0].id };
    const generatedNextPageCopy = ['下一页，还有更多内容。', 'There is more to discover on the next page.'].includes(block.text);
    const text = filled.length === 1 && generatedNextPageCopy
      ? copy(['回到上方，继续查看本页介绍与作品。', 'Return to the introduction and work on this page.']) : block.text;
    return { ...kept, link, text, button: block.button ? copy(['继续浏览', 'Continue exploring']) : '' };
  }) }));

  // Share base colors across every page; custom unified colors remain fixed.
  const spotlightBlockIds = new Set(linked.filter((_, index) => index === 0 || index === linked.length - 1)
    .flatMap(page => page.blocks.map(block => block.id)));
  const styled = randomizePageStyle({ id: 'random-site-style', title: '', blocks: linked.flatMap(page => page.blocks) }, {
    random, spotlightEligible: block => spotlightBlockIds.has(block.id), colorSettings: project.colorSettings,
  });
  const styledById = new Map(styled.page.blocks.map(block => [block.id, block]));
  const result = linked.map(page => ({ ...page, blocks: page.blocks.map(block => styledById.get(block.id) || block) }));
  return {
    project: { ...project, pages: result }, changed: styled.changed, pageCount: result.length,
    added: Math.max(0, result.length - project.pages.length), removed: removedPages.length, paletteName: styled.paletteName,
  };
}
