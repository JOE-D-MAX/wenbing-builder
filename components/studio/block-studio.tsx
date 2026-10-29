'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, defaultKeyboardCoordinateGetter, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type KeyboardCoordinateGetter, type CollisionDetection, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, Copy, Eye, FilePlus2, GripVertical, ImagePlus, Layers3, LayoutTemplate, Monitor, MousePointer2, Plus, Pause, Play, Redo2, Smartphone, Sparkles, Shuffle, Trash2, Undo2, X } from 'lucide-react';
import { BLOCK_IMPORT_KEY, BLOCK_LIBRARY, BLOCK_STORAGE_KEY, EFFECT_LIBRARY, MAX_BLOCKS, MAX_PAGES, MAX_EMBED_HTML_CHARS, blockId, createBlock, createStarterProject, parseBlockProject, safeBlockUrl, type BlockKind, type BlockLink, type BlockProject, type EffectId, type SiteBlock } from '@/lib/block-model';
import { renderBlockProject } from '@/lib/block-renderer';
import { randomizePageStyle } from '@/lib/random-block-style';
import { randomizeSite } from '@/lib/random-site';
import { applyProjectColorSettings, getProjectColorSettings, inheritUnifiedColors } from '@/lib/project-colors';
import { createDraftPersistence, type DraftPersistence } from '@/lib/draft-persistence';
import { createDesignStarterProject } from '@/lib/design-templates';
import { EffectPreview, usePreviewMotion } from './effect-preview';
import { BlockMiniature } from './block-miniature';
import { CanvasImagePicker } from './canvas-image-picker';
import { BackgroundVideo as BackgroundVideoLayer } from './background-video';
import { BackgroundVideoPicker } from './background-video-picker';
import { ProjectColorControls } from './project-color-controls';
import { readBackgroundVideo } from '@/lib/client-background-video';
import { safeBackgroundVideoSrc, type BackgroundVideo } from '@/lib/block-model';
import { PortfolioBlockFields } from './portfolio-block-fields';
import { DesignBlockFields } from './design-block-fields';
import { decodeUploadImage } from '@/lib/client-compat';
import { StudioLanguageSwitch, useStudioI18n } from './studio-i18n';

import { BACKGROUND_LIBRARY, PALETTE_LIBRARY, appearanceStyle, getBlockAppearance, type BackgroundId, type BlockAppearance, type BlockColors } from '@/lib/block-model';

type StudioMessage = string | { key: string; values?: Record<string, string | number> };
type History = { past: BlockProject[]; current: BlockProject; future: BlockProject[] };
type DragItem = { type: 'palette'; palette: string } | { type: 'background'; background: BackgroundId } | { type: 'library'; kind: BlockKind } | { type: 'effect'; effect: EffectId } | { type: 'block'; blockId: string; pageId: string };
const JSON_LIMIT = 3 * 1024 * 1024;
const labelFor = (kind: BlockKind) => BLOCK_LIBRARY.find(x => x.kind === kind)?.name || '完整网站';
const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => args.context.active?.data.current?.type === 'block' ? sortableKeyboardCoordinates(event, args) : defaultKeyboardCoordinateGetter(event, args);
const collision: CollisionDetection = args => {
  const matches = pointerWithin(args);
  const blocks = matches.filter(match => args.droppableContainers.find(x => x.id === match.id)?.data.current?.type === 'block');
  return args.pointerCoordinates ? (blocks.length ? blocks : matches) : closestCenter(args);
};

async function compressImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片。');
  if (file.size > 20 * 1024 * 1024) throw new Error('原图过大，请选择 20 MB 以内的图片。');
  const bitmap = await decodeUploadImage(file);
  try {
    const ratio = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('浏览器无法处理这张图片。');
    ctx.drawImage(bitmap.source, 0, 0, canvas.width, canvas.height);
    let data = canvas.toDataURL('image/webp', 0.86);
    for (const quality of [0.72, 0.58, 0.42]) { if (data.length <= 1900000) break; data = canvas.toDataURL('image/webp', quality); }
    if (data.length > 1900000) throw new Error('压缩后图片仍然过大，请换一张较小的图片。');
    return data;
  } finally { bitmap.close(); }
}

function LibraryItem({ item, onAdd }: { item: { kind: BlockKind; name: string; description: string }; onAdd: () => void }) {
  const { t } = useStudioI18n();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `library:${item.kind}`, data: { type: 'library', kind: item.kind } satisfies DragItem });
  const example = useMemo(() => createBlock(item.kind), [item.kind]);
  return <div ref={setNodeRef} className={`bs-library-card ${isDragging ? 'is-dragging' : ''}`}>
    <BlockMiniature block={example} small />
    <div className="bs-library-bottom"><div><strong>{t(item.name)}</strong><p>{t(item.description)}</p></div><button type="button" className="bs-icon bs-drag" {...attributes} {...listeners} aria-label={t('拖入{{name}}', { name: t(item.name) })}><GripVertical size={17} /></button><button type="button" className="bs-icon" onClick={onAdd} aria-label={t('添加{{name}}', { name: t(item.name) })}><Plus size={17} /></button></div>
  </div>;
}

function EffectItem({ item, onAdd, onRemove, disabled, applied = false, playing, location = 'library' }: { item: (typeof EFFECT_LIBRARY)[number]; onAdd: () => void; onRemove?: () => void; disabled: boolean; applied?: boolean; playing: boolean; location?: string }) {
  const { t } = useStudioI18n();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: `${location}:effect:${item.id}`, data: { type: 'effect', effect: item.id } satisfies DragItem });
  return <div ref={setNodeRef} className={`bs-effect-card bs-visual-effect ${applied ? 'is-applied' : ''} ${isDragging ? 'is-dragging' : ''}`}>
    <button type="button" ref={setActivatorNodeRef} className="bs-effect-drag-preview" {...attributes} {...listeners} aria-label={t('拖动{{name}}预览到区块', { name: t(item.name) })}><EffectPreview effect={item.id} playing={playing} /></button>
    <div className="bs-effect-copy"><strong>{t(item.name)}</strong><p>{t(item.description)}</p></div>
    <div className="bs-effect-actions">{applied && onRemove ? <button type="button" onClick={onRemove} className="bs-effect-remove" aria-label={t('移除{{name}}特效', { name: t(item.name) })}>{t("移除")}</button> : <span className="bs-effect-drag-caption"><GripVertical size={14} />{t("拖入区块")}</span>}<button type="button" disabled={disabled} onClick={onAdd} className="bs-effect-apply" aria-label={applied ? t('重播{{name}}效果', { name: t(item.name) }) : t('应用{{name}}特效', { name: t(item.name) })}>{applied ? t("重播") : t("应用")}{applied ? <Play size={14} /> : <Plus size={14} />}</button></div>
  </div>;
}


function SortableBlock({ block, pageId, accent, selected, onSelect, onMove, onCopy, onDelete, onReplay, imagePicker, videoTools, playing, demo, first, last }: { imagePicker?: ReactNode; videoTools?: ReactNode; playing: boolean; demo?: { effect: EffectId; revision: number }; onReplay: (effect: EffectId) => void; block: SiteBlock; pageId: string; accent: string; selected: boolean; onSelect: () => void; onMove: (delta: number) => void; onCopy: () => void; onDelete: () => void; first: boolean; last: boolean }) {
  const { t } = useStudioI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: block.id, data: { type: 'block', blockId: block.id, pageId } satisfies DragItem });
  return <article id={`canvas-block-${block.id}`} ref={setNodeRef} className={`bs-canvas-block ${selected ? 'is-selected' : ''} ${isDragging ? 'is-dragging' : ''} ${isOver ? 'is-over' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
    <div className="bs-block-toolbar"><button type="button" className="bs-icon bs-drag" {...attributes} {...listeners} aria-label={t('拖动{{name}}', { name: t(labelFor(block.kind)) })}><GripVertical size={17} /></button><button type="button" className="bs-block-name" onClick={onSelect} aria-pressed={selected}>{t(labelFor(block.kind))}{selected && <span>{t("编辑中")}</span>}</button><div className="bs-block-actions"><button type="button" className="bs-icon" disabled={first} onClick={() => onMove(-1)} aria-label={t('上移{{name}}', { name: t(labelFor(block.kind)) })}><ArrowUp size={15} /></button><button type="button" className="bs-icon" disabled={last} onClick={() => onMove(1)} aria-label={t('下移{{name}}', { name: t(labelFor(block.kind)) })}><ArrowDown size={15} /></button><button type="button" className="bs-icon" onClick={onCopy} aria-label={t('复制{{name}}', { name: t(labelFor(block.kind)) })}><Copy size={15} /></button><button type="button" className="bs-icon" onClick={onDelete} aria-label={t('删除{{name}}', { name: t(labelFor(block.kind)) })}><Trash2 size={15} /></button></div></div>
    <button type="button" className="bs-mini-select" onClick={onSelect} aria-label={t('编辑{{name}}', { name: block.title || t(labelFor(block.kind)) })}><BlockMiniature key={`${block.id}:${demo?.revision || 0}`} block={block} accent={accent} playing={playing} demoEffect={demo?.effect} /></button>
    {videoTools}
    {imagePicker}
    {block.effects.length > 0 && <div className="bs-effect-tags">{block.effects.map(id => <button type="button" key={id} onClick={() => onReplay(id)} aria-label={t('在画布重播{{name}}', { name: t(EFFECT_LIBRARY.find(e => e.id === id)?.name || '') })}><Play size={11} />{t(EFFECT_LIBRARY.find(e => e.id === id)?.name || '')}<span>{t("重播")}</span></button>)}</div>}
  </article>;
}

function MaterialItem({ type, id, name, description, appearance, onAdd }: { type: 'palette' | 'background'; id: string; name: string; description: string; appearance: BlockAppearance; onAdd: () => void }) {
  const { t } = useStudioI18n();
  const data: DragItem = type === 'palette' ? { type, palette: id } : { type, background: id as BackgroundId };
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: `${type}:${id}`, data });
  const materialName = type === 'palette' ? t('{{name}}配色', { name: t(name) }) : t(name);
  return <div ref={setNodeRef} className={`bs-material-card ${isDragging ? 'is-dragging' : ''}`}>
    <button type="button" ref={setActivatorNodeRef} className="bs-material-drag-preview" {...attributes} {...listeners} aria-label={t('拖动{{name}}预览到区块', { name: materialName })}>
      <span className="bs-material-art" style={appearanceStyle(appearance) as CSSProperties} aria-hidden="true">{type === 'palette' ? <><span className="bs-material-aa">Aa</span><span className="bs-swatches">{[appearance.backgroundColor, appearance.secondaryColor, appearance.textColor, appearance.accentColor].map((color, index) => <i key={index} style={{ background: color }} />)}</span></> : <span className="bs-material-outline" />}</span>
    </button>
    <div className="bs-material-copy"><strong>{t(name)}</strong><p>{t(description)}</p></div>
    <div className="bs-effect-actions"><span className="bs-effect-drag-caption"><GripVertical size={14} />{t("拖入区块")}</span><button type="button" className="bs-effect-apply" onClick={onAdd} aria-label={t('应用{{name}}', { name: materialName })}>{t("应用")}<Plus size={14} /></button></div>
  </div>;
}

function VideoMaterialItem({ playing, onAdd }: { playing: boolean; onAdd: () => void }) {
  const { t } = useStudioI18n();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: 'background:video', data: { type: 'background', background: 'video' } satisfies DragItem });
  return <div ref={setNodeRef} className={`bs-material-card ${isDragging ? 'is-dragging' : ''}`}>
    <button type="button" ref={setActivatorNodeRef} className="bs-material-drag-preview" {...attributes} {...listeners} aria-label={t("拖动视频背景预览到区块")}><span className="bs-video-material-art"><BackgroundVideoLayer video={{ src: '/media/background-demo.webm', poster: '/media/background-demo.jpg', dim: .2 }} playing={playing} small /><span className="bs-video-material-label"><strong>{t("视频背景")}</strong><small>{t("静音循环 · 内容叠加")}</small></span></span></button>
    <div className="bs-material-copy"><strong>{t("视频背景")}</strong><p>{t("示意视频；应用后选择自己的视频")}</p></div><div className="bs-effect-actions"><span className="bs-effect-drag-caption"><GripVertical size={14} />{t("拖入区块")}</span><button type="button" className="bs-effect-apply" onClick={onAdd} aria-label={t("应用视频背景")}>{t("应用")}<Plus size={14} /></button></div>
  </div>;
}

function CanvasDrop({ children, pageId, empty }: { children: ReactNode; pageId: string; empty: boolean }) {
  const { t } = useStudioI18n();
  const { setNodeRef, isOver } = useDroppable({ id: `canvas:${pageId}`, data: { type: 'canvas', pageId } });
  return <div ref={setNodeRef} className={`bs-canvas-stack ${isOver ? 'is-over' : ''} ${empty ? 'is-empty' : ''}`}>
    {children}
    {empty && <div className="bs-drop-hint"><Layers3 size={24} /><strong>{t("你的空白画布")}</strong><span>{t("拖入背景、配色或动效开始，再自由添加内容。")}</span></div>}
  </div>;
}

function AccordionItemsEditor({ items, onChange }: { items: SiteBlock['items']; onChange: (items: SiteBlock['items']) => void }) {
  const { t } = useStudioI18n();
  const serialize = (value: SiteBlock['items']) => value.map(i => `${i.title}｜${i.text}`).join('\n');
  const [value, setValue] = useState(() => serialize(items));
  const committed = useRef(serialize(items));
  useEffect(() => { const incoming = serialize(items); if (incoming !== committed.current) { committed.current = incoming; setValue(incoming); } }, [items]);
  return <label className="bs-field"><span>{t("折叠内容")}</span><textarea rows={7} maxLength={38000} value={value} onChange={e => { const next = e.target.value; const parsed = next.split('\n').slice(0, 12).map(line => { const [title, ...text] = line.split(/[｜|]/); return { title: title.slice(0, 100), text: text.join('｜').slice(0, 3000) }; }); setValue(next); committed.current = serialize(parsed); onChange(parsed); }} /><small>{t("每行一项，用「标题｜内容」分隔，最多 12 项。")}</small></label>;
}

export function BlockStudio() {
  const { t, locale } = useStudioI18n();
  // Source messages update with the interface language without restarting requests.
  const messageText = (message: StudioMessage) => typeof message === 'string' ? t(message) : t(message.key, Object.fromEntries(Object.entries(message.values || {}).map(([key, value]) => [key, typeof value === 'string' ? t(value) : value])));
  const [history, setHistory] = useState<History | null>(null);
  const [templateMode, setTemplateMode] = useState<'' | 'editorial'>('');
  const storageKey = useRef(BLOCK_STORAGE_KEY);
  const persistence = useRef<DraftPersistence | null>(null);
  const [draftConflict, setDraftConflict] = useState(false);
  const previewMotion = usePreviewMotion();
  const [videoTarget, setVideoTarget] = useState<{ pageId: string; blockId: string } | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);
  const videoRequest = useRef(0);
  const [zoomTarget, setZoomTarget] = useState<{ pageId: string; blockId: string } | null>(null);
  const viewContext = useRef({ pageId: '', selectedId: '' });
  const [effectDemos, setEffectDemos] = useState<Record<string, { effect: EffectId; revision: number }>>({});
  const [pageId, setPageId] = useState(''); const [selectedId, setSelectedId] = useState('');
  const [randomScope, setRandomScope] = useState<'site' | 'page' | 'block'>('site');
  const [randomPageCount, setRandomPageCount] = useState('7');
  const [libraryTab, setLibraryTab] = useState<'backgrounds' | 'palettes' | 'effects' | 'blocks'>('effects');
  const [mobilePanel, setMobilePanel] = useState<'library' | 'canvas' | 'properties'>('canvas');
  const [view, setView] = useState<'edit' | 'preview'>('edit'); const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [notice, setNotice] = useState<StudioMessage>(''); const [error, setError] = useState<StudioMessage>(''); const [saved, setSaved] = useState('正在恢复草稿');
  const [dragItem, setDragItem] = useState<DragItem | null>(null); const [imageBusy, setImageBusy] = useState(false);
  const initialized = useRef(false); const historyRef = useRef<History | null>(null); const mergeRef = useRef({ key: '', time: 0 }); const imageRequest = useRef(0); const alive = useRef(true);
  const project = history?.current; const currentPage = project?.pages.find(page => page.id === pageId) || project?.pages[0];
  const selected = currentPage?.blocks.find(block => block.id === selectedId);
  useEffect(() => { viewContext.current = { pageId: currentPage?.id || '', selectedId }; }, [currentPage?.id, selectedId]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }), useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }));

  useEffect(() => {
    if (initialized.current) return; initialized.current = true;
    const initialize = async () => {
    const templateParam = new URLSearchParams(window.location.search).get('template');
    const useTemplate = templateParam === 'editorial' ? templateParam : '';
    storageKey.current = useTemplate ? BLOCK_STORAGE_KEY + ':template:' + useTemplate : BLOCK_STORAGE_KEY;
    setTemplateMode(useTemplate);
    let restored = createStarterProject(); let restoreFailed = false;
    let newTemplate = false;
    let raw: string | null = null;
    try { raw = localStorage.getItem(storageKey.current); if (raw) { if (new Blob([raw]).size > JSON_LIMIT) throw new Error('本机草稿超过 3 MB，暂时无法恢复。'); restored = parseBlockProject(JSON.parse(raw)); } else if (useTemplate) {
      restored = createDesignStarterProject();
      if (!alive.current) return;
      newTemplate = true;
    } } catch (err) { if (useTemplate) { setError({ key: '模板打开失败：{{reason}}。原来的制作草稿仍保留。', values: { reason: err instanceof Error ? err.message : '资料格式不正确' } }); return; } restoreFailed = true; setError({ key: '未能恢复本机草稿：{{reason}} 原草稿仍保留，网页导入已暂停。主动编辑后才会替换原草稿。', values: { reason: err instanceof Error ? err.message : '资料格式不正确' } }); }
    if (!alive.current) return;
    if (useTemplate) setNotice(newTemplate ? '已创建可编辑模板副本。可以逐块修改文字、图片、配色与跳转；原来的草稿保留在「返回我的草稿」。' : '已恢复上次编辑的模板副本，原来的制作草稿保持不变。');
    persistence.current = createDraftPersistence({ getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) }, storageKey.current, raw);
    const base = restored; let imported = false;
    if (!restoreFailed && new URLSearchParams(window.location.search).get('import') === '1') {
      try {
        const raw = sessionStorage.getItem(BLOCK_IMPORT_KEY);
        if (raw) {
          if (new Blob([raw]).size > JSON_LIMIT) throw new Error('待导入网页过大，请重新生成较小的网页。');
          const payload = JSON.parse(raw) as { html?: unknown; title?: unknown };
          if (typeof payload.html !== 'string' || !payload.html.trim() || payload.html.length > MAX_EMBED_HTML_CHARS) throw new Error('待导入网页为空或过大，请重新生成较小的网页。');
          if (base.pages[0].blocks.length >= MAX_BLOCKS) throw new Error('当前首页模块已满，请删除一个模块后重新导入。');
          const block = { ...createBlock('embed'), html: payload.html, title: typeof payload.title === 'string' ? payload.title.slice(0, 160) : '已生成的网站' };
          const combined = { ...base, pages: base.pages.map((p, i) => i === 0 ? { ...p, blocks: [...p.blocks, block] } : p) };
          if (new Blob([JSON.stringify(combined)]).size > JSON_LIMIT) throw new Error('导入后项目会超过 3 MB。请先减少图片或模块，再重新导入；待导入网页仍然保留。');
          restored = combined; imported = true; setSelectedId(block.id); setNotice('网页已作为静态模块追加到首页，原草稿已保留，可撤销此次导入。'); sessionStorage.removeItem(BLOCK_IMPORT_KEY);
        } else { setNotice('没有待导入的网页。你可以从 API 或模板制作页重新发送。'); }
        const url = new URL(window.location.href); url.searchParams.delete('import'); window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      } catch (err) { setError(err instanceof Error ? err.message : '网页导入失败，请重试。'); }
    }
    const next = { past: imported ? [base] : [], current: restored, future: [] }; setHistory(next); historyRef.current = next; setPageId(restored.pages[0].id); if (!imported) setSelectedId((useTemplate ? restored.pages[0].blocks.find(block => block.kind === 'hero')?.id : '') || restored.pages[0].blocks[0]?.id || '');
    if (imported || newTemplate) persistence.current.stage(JSON.stringify(restored));
    setSaved(imported || newTemplate ? '等待保存' : '本机草稿已就绪');
    };
    void initialize();
  }, []);

  useEffect(() => { alive.current = true; return () => { alive.current = false; imageRequest.current += 1; videoRequest.current += 1; }; }, []);
  useEffect(() => {
    const flush = () => { try { persistence.current?.save(); } catch { /* Keep pending changes for retry or recovery. */ } };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      flush();
      if (persistence.current?.hasPending()) { event.preventDefault(); event.returnValue = ''; }
    };
    const changed = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key !== null && event.key !== storageKey.current)) return;
      try { if (persistence.current?.observeExternalChange()) { setDraftConflict(true); setSaved('尚未保存'); } }
      catch { setSaved('尚未保存'); }
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('storage', changed);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('storage', changed);
      flush();
    };
  }, []);

  useEffect(() => {
    if (!project || !persistence.current) return;
    if (!persistence.current.hasPending()) {
      if (history?.past.length || history?.future.length) setSaved(draftConflict ? '尚未保存' : '已保存到本机');
      return;
    }
    setSaved('正在保存…');
    const timer = window.setTimeout(() => {
      try {
        const result = persistence.current?.save();
        if (result === 'conflict') { setDraftConflict(true); setSaved('尚未保存'); }
        else setSaved('已保存到本机');
      } catch { setSaved('尚未保存'); setError('本机存储已满，当前修改仍在页面中。请减少图片或视频后重试保存。'); }
    }, 600);
    return () => clearTimeout(timer);
  }, [project]);

  function downloadCurrentDraft() {
    if (!historyRef.current) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(historyRef.current.current, null, 2)], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'wenbing-block-recovery.json';
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function reloadLatestDraft() {
    if (persistence.current?.hasPending() && !window.confirm(t('重新加载将丢弃本页未保存的修改。建议先下载当前副本，是否继续？'))) return;
    persistence.current?.discardPending();
    window.location.reload();
  }

  const commit = useCallback((update: (value: BlockProject) => BlockProject, mergeKey = '') => {
    const previous = historyRef.current; if (!previous) return false;
    const next = update(previous.current); if (next === previous.current) return false;
    if (new Blob([JSON.stringify(next)]).size > JSON_LIMIT) { setError('这次修改会让项目超过 3 MB，已保留修改前的项目。请减少图片或模块，再重试。'); return false; }
    const now = Date.now(); const merge = Boolean(mergeKey && mergeRef.current.key === mergeKey && now - mergeRef.current.time < 850);
    const state = { past: merge ? previous.past : [...previous.past.slice(-19), previous.current], current: next, future: [] };
    mergeRef.current = { key: mergeKey, time: now }; historyRef.current = state; persistence.current?.stage(JSON.stringify(state.current)); setHistory(state); setError(''); return true;
  }, []);

  const revealWorkspaceRegion = (id: string) => {
    requestAnimationFrame(() => {
      const node = document.getElementById(id);
      node?.focus({ preventScroll: true });
      node?.scrollIntoView({ behavior: previewMotion.reduced ? 'instant' : 'smooth', block: 'start' });
    });
  };

  const toggleUnifiedColors = () => {
    if (imageBusy || videoBusy) return;
    const current = historyRef.current?.current;
    if (!current) return;
    const settings = getProjectColorSettings(current);
    const unified = !settings.unified;
    if (!commit(value => applyProjectColorSettings(value, { ...getProjectColorSettings(value), unified }))) return;
    setNotice(unified ? '已开启统一配色。调色会立即应用到整站。' : '已切换为随机特效配色，底色保持统一。');
  };

  const changeUnifiedColor = (key: keyof BlockColors, value: string) => {
    if (imageBusy || videoBusy || !/^#[a-fA-F0-9]{6}$/.test(value)) return;
    const current = historyRef.current?.current;
    if (!current || !getProjectColorSettings(current).unified) return;
    if (!commit(project => {
      const settings = getProjectColorSettings(project);
      return applyProjectColorSettings(project, { ...settings, colors: { ...settings.colors, [key]: value } });
    }, `project-colors:${key}`)) return;
    setNotice('整站配色已更新，可撤销。');
  };

  const applyUnifiedPalette = (id: string) => {
    if (imageBusy || videoBusy) return;
    const current = historyRef.current?.current;
    const palette = PALETTE_LIBRARY.find(item => item.id === id);
    if (!current || !palette || !getProjectColorSettings(current).unified) return;
    const { backgroundColor, secondaryColor, textColor, accentColor } = palette.appearance;
    if (!commit(value => applyProjectColorSettings(value, { unified: true, colors: { backgroundColor, secondaryColor, textColor, accentColor } }))) return;
    setNotice('整站配色已更新，可撤销。');
  };

  const applyRandomStyle = () => {
    if (!currentPage || imageBusy || videoBusy) return;
    const currentProject = historyRef.current?.current;
    if (!currentProject) return;
    const page = currentProject.pages.find(item => item.id === currentPage.id);
    if (!page) return;
    if (randomScope === 'site') {
      const pageCount = Number(randomPageCount);
      if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > MAX_PAGES) { setError('网页数量请输入 1–10 的整数。'); return; }
      const result = randomizeSite(currentProject, { pageCount, locale });
      if (!result.changed && !result.added && !result.removed) { setError('导入网页保留原有样式，请先添加一个可编辑区块。'); return; }
      if (!commit(() => result.project)) return;
      const updatedPage = result.project.pages.find(item => item.id === page.id) || result.project.pages[0];
      setPageId(updatedPage.id);
      setEffectDemos({}); setZoomTarget(null); setVideoTarget(null);
      if (!updatedPage.blocks.some(block => block.id === selectedId && block.kind !== 'embed')) setSelectedId(updatedPage.blocks.find(block => block.kind !== 'embed')?.id || '');
      setView('edit'); setMobilePanel('canvas');
      setNotice({ key: '已在当前画布纵向生成 {{count}} 个网页，新增 {{added}} 页，移除 {{removed}} 页。向下滚动即可直接编辑；可一次撤销恢复。', values: { count: result.pageCount, added: result.added, removed: result.removed } });
      revealWorkspaceRegion('bs-page-editor');
      return;
    }
    if (randomScope === 'block' && (!selected || selected.kind === 'embed')) {
      setError('请先选中一个可编辑区块，再随机配置。'); return;
    }
    const edgePage = page.id === currentProject.pages[0]?.id || page.id === currentProject.pages.at(-1)?.id;
    const result = randomizePageStyle(page, {
      ...(randomScope === 'block' ? { blockId: selected!.id } : {}),
      colorSettings: currentProject.colorSettings,
      spotlightEligible: () => edgePage,
    });
    if (!result.changed) { setError('导入网页保留原有样式，请先添加一个可编辑区块。'); return; }
    if (!commit(value => ({ ...value, pages: value.pages.map(item => item.id === page.id ? result.page : item) }))) return;
    setEffectDemos({}); setZoomTarget(null); setVideoTarget(null);
    if (!result.page.blocks.some(block => block.id === selectedId && block.kind !== 'embed')) setSelectedId(result.page.blocks.find(block => block.kind !== 'embed')?.id || '');
    setView('edit'); setMobilePanel('canvas');
    setNotice({ key: '已随机配置 {{count}} 个区块，使用「{{palette}}」配色。可点击撤销恢复。', values: { count: result.changed, palette: result.paletteName } });
  };

  const selectCanvasBlock = (pageTarget: string, blockTarget: string) => {
    const page = historyRef.current?.current.pages.find(item => item.id === pageTarget);
    if (!page || (blockTarget && !page.blocks.some(block => block.id === blockTarget))) return;
    if (viewContext.current.pageId !== pageTarget) mergeRef.current.key = '';
    viewContext.current = { pageId: pageTarget, selectedId: blockTarget };
    setPageId(pageTarget); setSelectedId(blockTarget);
  };

  const selectCanvasPage = (id: string) => {
    if (!historyRef.current?.current.pages.some(page => page.id === id)) return;
    selectCanvasBlock(id, ''); setZoomTarget(null); setVideoTarget(null);
    setMobilePanel('canvas');
    revealWorkspaceRegion(view === 'preview' ? 'bs-page-editor' : `canvas-page-${id}`);
  };

  const undo = useCallback(() => {
    const h = historyRef.current; if (!h?.past.length) return; imageRequest.current += 1; setImageBusy(false); setZoomTarget(null); videoRequest.current += 1; setVideoBusy(false); setVideoTarget(null);
    const next = { past: h.past.slice(0, -1), current: h.past[h.past.length - 1], future: [h.current, ...h.future] }; historyRef.current = next; persistence.current?.stage(JSON.stringify(next.current)); setHistory(next); mergeRef.current.key = ''; setNotice('已撤销，可再次恢复。');
  }, []);
  const redo = useCallback(() => {
    const h = historyRef.current; if (!h?.future.length) return; imageRequest.current += 1; setImageBusy(false); setZoomTarget(null); videoRequest.current += 1; setVideoBusy(false); setVideoTarget(null);
    const next = { past: [...h.past, h.current], current: h.future[0], future: h.future.slice(1) }; historyRef.current = next; persistence.current?.stage(JSON.stringify(next.current)); setHistory(next); mergeRef.current.key = ''; setNotice('已恢复修改。');
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => { const target = event.target as HTMLElement; if (target.matches('input, textarea, select, [contenteditable="true"]')) return; if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); } };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [undo, redo]);

  const updateBlock = (patch: Partial<SiteBlock>, mergeKey = '') => {
    if (!currentPage || !selected) return;
    if ('image' in patch) { imageRequest.current += 1; setImageBusy(false); setZoomTarget(null); videoRequest.current += 1; setVideoBusy(false); setVideoTarget(null); }
    commit(p => ({ ...p, pages: p.pages.map(page => page.id === currentPage.id ? { ...page, blocks: page.blocks.map(b => b.id === selected.id ? { ...b, ...patch } : b) } : page) }), mergeKey ? `${selected.id}-${mergeKey}` : '');
  };
  const addBlock = (kind: BlockKind, beforeId?: string, pageTarget = currentPage?.id || '') => {
    const draft = historyRef.current?.current;
    const page = draft?.pages.find(item => item.id === pageTarget);
    if (!page) return;
    if (page.blocks.length >= MAX_BLOCKS) { setError({ key: '每页最多 {{count}} 个模块。可以新建一个页面继续制作。', values: { count: MAX_BLOCKS } }); return; }
    const block = createBlock(kind);
    if (draft?.layout === 'portfolio') { block.appearance = { ...getBlockAppearance(page.blocks.find(item => item.id === selectedId) || page.blocks[0] || block, draft.accent) }; if (kind === 'project') block.span = 'half'; }
    if (!commit(p => ({ ...p, pages: p.pages.map(item => { if (item.id !== page.id) return item; const blocks = [...item.blocks]; const position = beforeId ? blocks.findIndex(b => b.id === beforeId) : -1; blocks.splice(position < 0 ? blocks.length : position, 0, inheritUnifiedColors(block, p)); return { ...item, blocks }; }) }))) return;
    selectCanvasBlock(page.id, block.id); setView('edit'); setMobilePanel('canvas'); setNotice({ key: '已添加{{name}}。点击模块可编辑内容。', values: { name: labelFor(kind) } });
  };
  const replayEffect = (blockId: string, effect: EffectId, pageTarget?: string) => {
    const page = historyRef.current?.current.pages.find(item => (!pageTarget || item.id === pageTarget) && item.blocks.some(block => block.id === blockId));
    if (!page) return;
    setEffectDemos(previous => ({ ...previous, [blockId]: { effect, revision: (previous[blockId]?.revision || 0) + 1 } }));
    selectCanvasBlock(page.id, blockId); setView('edit'); setMobilePanel('canvas');
    requestAnimationFrame(() => { const node = document.getElementById(`canvas-block-${blockId}`); if (!node) return; const rect = node.getBoundingClientRect(); if (rect.top < 16 || rect.bottom > window.innerHeight) node.scrollIntoView({ behavior: previewMotion.reduced ? 'instant' : 'smooth', block: 'nearest' }); });
  };
  const cancelZoom = () => { imageRequest.current += 1; setImageBusy(false); setZoomTarget(null); videoRequest.current += 1; setVideoBusy(false); setVideoTarget(null); setNotice('已取消选图，项目保持原样。'); };
  const applyEffect = (effect: EffectId, targetId = selectedId, pageTarget = currentPage?.id || '') => {
    const page = historyRef.current?.current.pages.find(item => targetId ? item.blocks.some(block => block.id === targetId) : item.id === pageTarget);
    if (!page) return;
    const target = page.blocks.find(b => b.id === targetId);
    if (effect === 'zoom' && (!target || !target.image) && target?.kind !== 'embed') {
      if (!target && page.blocks.length) { setNotice('先选中一个区块，或直接拖到目标区块。'); return; }
      imageRequest.current += 1; setImageBusy(false); setZoomTarget({ pageId: page.id, blockId: target?.id || '' });
      selectCanvasBlock(page.id, target?.id || ''); setView('edit'); setMobilePanel('canvas'); setNotice('在目标区块选择图片，选好后自动应用放大效果。');
      requestAnimationFrame(() => document.getElementById(target ? `canvas-block-${target.id}` : 'canvas-new-image')?.scrollIntoView({ behavior: previewMotion.reduced ? 'instant' : 'smooth', block: 'nearest' }));
      return;
    }
    if (!target && page.blocks.length === 0) {
      const block = createBlock(effect === 'zoom' ? 'project' : 'surface');
      block.effects = [effect];
      if (effect === 'ambient') block.appearance = { ...PALETTE_LIBRARY.find(p => p.id === 'ink-lime')!.appearance };
      if (effect === 'stars' || effect === 'spotlight') block.appearance = { ...PALETTE_LIBRARY.find(p => p.id === 'ocean')!.appearance };
      if (!commit(p => ({ ...p, pages: p.pages.map(item => item.id === page.id ? { ...item, blocks: [inheritUnifiedColors(block, p)] } : item) }))) return;
      replayEffect(block.id, effect, page.id);
      setNotice(effect === 'zoom' ? '已添加图片放大效果。点击图片区块并上传自己的图片。' : '已新建区块并在画布上演示特效，可继续编辑自己的内容。'); return;
    }
    if (!target) { setNotice('先选中一个区块，或直接把特效预览拖到目标区块。'); return; }
    if (target.kind === 'embed') { setNotice('导入网页仅保留静态布局。请将新特效应用到其他区块。'); return; }
    if (target.effects.includes(effect)) { replayEffect(targetId, effect, page.id); setNotice(effect === 'zoom' && !target.image ? '请先上传自己的图片，放大效果会直接显示在画布。' : '已在目标区块重播特效，项目内容保持不变。'); return; }
    if (!commit(p => ({ ...p, pages: p.pages.map(item => item.id === page.id ? { ...item, blocks: item.blocks.map(b => b.id === targetId ? { ...b, effects: [...b.effects, effect] } : b) } : item) }))) return;
    replayEffect(targetId, effect, page.id); setNotice(effect === 'zoom' && !target.image ? '图片放大已应用；上传自己的图片后会直接显示效果。' : { key: '已应用{{name}}，画布已即时展示；点击区块下方可重播。', values: { name: EFFECT_LIBRARY.find(e => e.id === effect)?.name || '' } });
  };
  const removeEffect = (effect: EffectId) => {
    if (!selected || !currentPage) return;
    if (effect === 'zoom') { imageRequest.current += 1; setImageBusy(false); setZoomTarget(null); videoRequest.current += 1; setVideoBusy(false); setVideoTarget(null); }
    if (commit(p => ({ ...p, pages: p.pages.map(page => page.id === currentPage.id ? { ...page, blocks: page.blocks.map(b => b.id === selected.id ? { ...b, effects: b.effects.filter(id => id !== effect) } : b) } : page) }))) setNotice('特效已移除，其他内容与样式保留；可撤销。');
  };
  const cancelVideo = () => { videoRequest.current += 1; setVideoBusy(false); setVideoTarget(null); };
  const openVideoPicker = (blockTarget = selectedId, pageTarget = currentPage?.id || '') => {
    const page = historyRef.current?.current.pages.find(item => blockTarget ? item.blocks.some(block => block.id === blockTarget) : item.id === pageTarget);
    if (!page) return;
    const target = page.blocks.find(block => block.id === blockTarget);
    if (target?.kind === 'embed') { setNotice('请将视频背景应用到原生区块。'); return; }
    if (!target && page.blocks.length) { setNotice('请先选中一个区块，或直接拖到目标区块。'); return; }
    cancelVideo(); setVideoTarget({ pageId: page.id, blockId: target?.id || '' });
    selectCanvasBlock(page.id, target?.id || ''); setView('edit'); setMobilePanel('canvas');
    setNotice('选择本机视频或填写视频直链，视频会铺在该区块的内容后方。');
    requestAnimationFrame(() => document.getElementById(target ? `canvas-video-${target.id}` : 'canvas-new-video')?.scrollIntoView({ behavior: previewMotion.reduced ? 'instant' : 'smooth', block: 'nearest' }));
  };
  const saveBackgroundVideo = (video: BackgroundVideo, blockTarget: string, pageTarget: string) => {
    const page = historyRef.current?.current.pages.find(item => item.id === pageTarget);
    const target = page?.blocks.find(item => item.id === blockTarget);
    if (!page || (blockTarget && (!target || target.kind === 'embed'))) return;
    if (!target && page.blocks.length) { setError('画布已变化，请重新选择视频要应用的区块。'); return; }
    const base = target || createBlock('surface');
    const next = { ...base, backgroundVideo: video, appearance: { ...getBlockAppearance(base, historyRef.current?.current.accent), background: 'video' as const } };
    if (!commit(p => ({ ...p, pages: p.pages.map(item => item.id !== pageTarget ? item : { ...item, blocks: target ? item.blocks.map(block => block.id === blockTarget ? next : block) : [inheritUnifiedColors(next, p)] }) }))) return;
    setVideoTarget(null); selectCanvasBlock(page.id, next.id); setView('edit'); setMobilePanel('canvas');
    setNotice('视频背景已应用，原有内容保留。视频静音循环，可在区块下方暂停或更换。');
  };
  const uploadBackgroundVideo = async (file: File | undefined, blockTarget: string, pageTarget: string) => {
    if (!file) return;
    const request = ++videoRequest.current, snapshot = historyRef.current;
    setVideoBusy(true); setError('');
    try {
      const video = await readBackgroundVideo(file);
      if (!alive.current || request !== videoRequest.current) return;
      if (viewContext.current.pageId !== pageTarget || viewContext.current.selectedId !== blockTarget) { setNotice('已切换编辑区块，视频添加已取消，请在目标区块重新选择。'); return; }
      if (historyRef.current !== snapshot) { setError('读取期间项目发生了修改，请重新选择视频；原内容已保留。'); return; }
      saveBackgroundVideo(video, blockTarget, pageTarget);
    } catch (error) { if (alive.current && request === videoRequest.current) setError(error instanceof Error ? error.message : '视频读取失败。'); }
    finally { if (alive.current && request === videoRequest.current) setVideoBusy(false); }
  };
  const useVideoUrl = (url: string, blockTarget: string, pageTarget: string) => {
    const src = url.startsWith('https://') ? safeBackgroundVideoSrc(url) : '';
    if (!src) { setError('请填写有效的 HTTPS 视频文件地址，不支持网页分享链接或账号密码。'); return; }
    cancelVideo(); saveBackgroundVideo({ src, dim: .35 }, blockTarget, pageTarget);
  };
  const toggleBackgroundVideo = (block: SiteBlock) => {
    const page = historyRef.current?.current.pages.find(item => item.blocks.some(target => target.id === block.id));
    const target = page?.blocks.find(item => item.id === block.id);
    if (!page || !target?.backgroundVideo) return;
    const backgroundVideo = { ...target.backgroundVideo, paused: !target.backgroundVideo.paused };
    if (commit(p => ({ ...p, pages: p.pages.map(item => item.id !== page.id ? item : { ...item, blocks: item.blocks.map(value => value.id === block.id ? { ...value, backgroundVideo } : value) }) }))) selectCanvasBlock(page.id, block.id);
  };
  const applyMaterial = (material: { palette: string } | { background: BackgroundId }, targetId = selectedId, pageTarget = currentPage?.id || '') => {
    const page = historyRef.current?.current.pages.find(item => targetId ? item.blocks.some(block => block.id === targetId) : item.id === pageTarget);
    if (!page) return;
    let target = page.blocks.find(b => b.id === targetId);
    if (!target && page.blocks.length) { setNotice('先选中一个区块，再应用背景或配色。'); return; }
    if (target?.kind === 'embed') { setNotice('导入网页保留自己的样式。请在前后添加空白区块，再应用素材。'); return; }
    if ('background' in material && material.background === 'video' && !target?.backgroundVideo?.src) { openVideoPicker(targetId, page.id); return; }
    cancelVideo();
    const isNew = !target; target ??= createBlock('surface');
    const before = getBlockAppearance(target, historyRef.current?.current.accent);
    const palette = 'palette' in material ? PALETTE_LIBRARY.find(p => p.id === material.palette) : undefined;
    const appearance = palette ? { ...palette.appearance, background: before.background } : 'background' in material ? { ...before, background: material.background } : before;
    const next = { ...target, appearance };
    if (!commit(p => {
      const settings = getProjectColorSettings(p);
      const inserted = isNew ? inheritUnifiedColors(next, p) : next;
      const updated = { ...p, pages: p.pages.map(item => item.id === page.id ? { ...item, blocks: isNew ? [inserted] : item.blocks.map(b => b.id === next.id ? next : b) } : item) };
      return settings.unified && palette ? applyProjectColorSettings(updated, { unified: true, colors: palette.appearance }) : updated;
    })) return;
    selectCanvasBlock(page.id, next.id); setView('edit'); setMobilePanel('canvas');
    setNotice({ key: isNew ? '{{name}}已应用，已创建空白区块。' : '{{name}}已应用，文字和跳转保持原样。', values: { name: palette ? '配色' : '背景' } });
  };
  const updateAppearance = (patch: Partial<BlockAppearance>) => {
    if (!selected) return;
    if (patch.background === 'video' && !selected.backgroundVideo?.src) { openVideoPicker(selected.id); return; }
    const current = historyRef.current?.current;
    const { background, ...colors } = patch;
    if (current && getProjectColorSettings(current).unified && Object.keys(colors).length) {
      if (imageBusy || videoBusy) return;
      if (!commit(value => {
        const settings = getProjectColorSettings(value);
        const updated = applyProjectColorSettings(value, { unified: true, colors: { ...settings.colors, ...colors } });
        return background === undefined ? updated : { ...updated, pages: updated.pages.map(page => ({ ...page, blocks: page.blocks.map(block => block.id === selected.id ? { ...block, appearance: { ...getBlockAppearance(block, updated.accent), background } } : block) })) };
      }, `project-colors:${Object.keys(colors).sort().join(',')}`)) return;
      setNotice('整站配色已更新，可撤销。'); return;
    }
    updateBlock({ appearance: { ...getBlockAppearance(selected, project?.accent), ...patch } }, 'appearance');
  };
  const applyPageAppearance = () => {
    if (!selected || !currentPage || !project || selected.kind === 'embed') return;
    const appearance = getBlockAppearance(selected, project?.accent);
    if (commit(p => {
      const settings = getProjectColorSettings(p);
      const updated = settings.unified ? applyProjectColorSettings(p, { unified: true, colors: appearance }) : p;
      return { ...updated, pages: updated.pages.map(page => page.id === currentPage.id ? { ...page, blocks: page.blocks.map(b => b.kind === 'embed' ? b : { ...b, appearance: { ...appearance, background: appearance.background === 'video' ? getBlockAppearance(b, updated.accent).background : appearance.background } }) } : page) };
    })) setNotice('当前背景和配色已应用到本页区块，原有文字与动效已保留；可撤销。');
  };
  const moveBlock = (id: string, delta: number) => {
    const page = historyRef.current?.current.pages.find(item => item.blocks.some(block => block.id === id));
    if (!page) return; const index = page.blocks.findIndex(b => b.id === id); const nextIndex = index + delta; if (index < 0 || nextIndex < 0 || nextIndex >= page.blocks.length) return;
    if (!commit(p => ({ ...p, pages: p.pages.map(item => item.id === page.id ? { ...item, blocks: arrayMove(item.blocks, index, nextIndex) } : item) }))) return;
    selectCanvasBlock(page.id, id); setNotice(delta < 0 ? '模块已上移。' : '模块已下移。');
  };
  const copyBlock = (id: string) => {
    const page = historyRef.current?.current.pages.find(item => item.blocks.some(block => block.id === id));
    if (!page) return; if (page.blocks.length >= MAX_BLOCKS) { setError({ key: '每页最多 {{count}} 个模块。', values: { count: MAX_BLOCKS } }); return; }
    const original = page.blocks.find(b => b.id === id); if (!original) return; const copy = { ...original, id: blockId(), items: original.items.map(i => ({ ...i })), effects: [...original.effects], link: { ...original.link } };
    if (!commit(p => ({ ...p, pages: p.pages.map(item => { if (item.id !== page.id) return item; const blocks = [...item.blocks]; blocks.splice(blocks.findIndex(b => b.id === id) + 1, 0, inheritUnifiedColors(copy, p)); return { ...item, blocks }; }) }))) return; selectCanvasBlock(page.id, copy.id); setNotice('已复制模块。');
  };
  const deleteBlock = (id: string) => {
    const page = historyRef.current?.current.pages.find(item => item.blocks.some(block => block.id === id));
    if (!page) return;
    if (!commit(p => ({ ...p, pages: p.pages.map(item => item.id === page.id ? { ...item, blocks: item.blocks.filter(b => b.id !== id) } : item) }))) return;
    if (zoomTarget?.blockId === id) cancelZoom(); if (videoTarget?.blockId === id) cancelVideo();
    selectCanvasBlock(page.id, viewContext.current.pageId === page.id && viewContext.current.selectedId !== id ? viewContext.current.selectedId : '');
    setNotice('已删除模块，可点击「撤销」恢复。');
  };
  const startDrag = (event: DragStartEvent) => setDragItem(event.active.data.current as DragItem);
  const endDrag = (event: DragEndEvent) => {
    setDragItem(null); const active = event.active.data.current as DragItem | undefined; const over = event.over?.data.current;
    if (!active || !over || !['canvas', 'block'].includes(over.type)) return;
    const page = historyRef.current?.current.pages.find(item => item.id === over.pageId);
    if (!page || (over.type === 'block' && !page.blocks.some(block => block.id === over.blockId))) return;
    if (active.type === 'block' && active.pageId !== page.id) { setNotice('区块只能在所属网页内排序；可在目标网页添加新模块。'); return; }
    const targetId = over.type === 'block' ? over.blockId : page.blocks.find(block => block.id === selectedId && block.kind !== 'embed')?.id || page.blocks.find(block => block.kind !== 'embed')?.id || '';
    if (active.type === 'library') addBlock(active.kind, over.type === 'block' ? over.blockId : undefined, page.id);
    else if (active.type === 'palette') applyMaterial({ palette: active.palette }, targetId, page.id);
    else if (active.type === 'background') applyMaterial({ background: active.background }, targetId, page.id);
    else if (active.type === 'effect') { if (over.type === 'block' || !page.blocks.length) applyEffect(active.effect, over.type === 'block' ? over.blockId : '', page.id); else setNotice('请把特效预览拖到一个具体区块上。'); }
    else if (active.type === 'block' && active.pageId === page.id) { const oldIndex = page.blocks.findIndex(b => b.id === active.blockId); const nextIndex = over.type === 'block' ? page.blocks.findIndex(b => b.id === over.blockId) : page.blocks.length - 1; if (oldIndex >= 0 && nextIndex >= 0 && oldIndex !== nextIndex) moveBlock(active.blockId, nextIndex - oldIndex); }
  };
  const addPage = () => {
    if (!project) return; if (project.pages.length >= MAX_PAGES) { setError({ key: '一个项目最多 {{count}} 个页面。', values: { count: MAX_PAGES } }); return; }
    const page = { id: blockId('page'), title: `页面 ${project.pages.length + 1}`, blocks: [] };
    if (!commit(p => ({ ...p, pages: [...p.pages, page] }))) return; selectCanvasBlock(page.id, ''); setView('edit'); setMobilePanel('canvas'); setNotice('已新建页面。可以修改名称，再添加模块。'); revealWorkspaceRegion(`canvas-page-${page.id}`);
  };
  const deletePage = () => { if (!project || !currentPage || project.pages.length === 1) return; const remaining = project.pages.filter(p => p.id !== currentPage.id); if (!commit(p => ({ ...p, pages: remaining }))) return; imageRequest.current += 1; setImageBusy(false); setZoomTarget(null); videoRequest.current += 1; setVideoBusy(false); setVideoTarget(null); selectCanvasBlock(remaining[0].id, ''); setNotice('页面已删除。指向它的按钮将停用；撤销可恢复。'); revealWorkspaceRegion(view === 'preview' ? 'bs-page-editor' : `canvas-page-${remaining[0].id}`); };
  const uploadImage = async (file?: File, blockTarget = selected?.id || '', pageTarget = currentPage?.id || '', addZoom = false) => {
    if (!file || !pageTarget || (!blockTarget && !addZoom)) return;
    const request = ++imageRequest.current; setImageBusy(true); setError('');
    try {
      const image = await compressImage(file);
      if (!alive.current || imageRequest.current !== request) return;
      const page = historyRef.current?.current.pages.find(item => item.id === pageTarget);
      const target = page?.blocks.find(item => item.id === blockTarget);
      if (!page || (blockTarget && (!target || target.kind === 'embed'))) return;
      if (!target && page.blocks.length >= MAX_BLOCKS) { setError({ key: '每页最多 {{count}} 个模块，请先移除一个模块。', values: { count: MAX_BLOCKS } }); return; }
      const created = target ? null : createBlock('surface');
      const finalId = target?.id || created!.id;
      const saved = commit(project => ({ ...project, pages: project.pages.map(item => item.id !== pageTarget ? item : { ...item, blocks: created ? [...item.blocks, inheritUnifiedColors({ ...created, image, effects: ['zoom'] }, project)] : item.blocks.map(block => block.id === blockTarget ? { ...block, image, effects: addZoom ? [...new Set<EffectId>([...block.effects, 'zoom'])] : block.effects } : block) }) }));
      if (!saved) return;
      setZoomTarget(null);
      const updated = historyRef.current?.current.pages.find(item => item.id === pageTarget)?.blocks.find(item => item.id === finalId);
      if (updated?.effects.includes('zoom') && viewContext.current.pageId === pageTarget && viewContext.current.selectedId === blockTarget) replayEffect(finalId, 'zoom', pageTarget);
      setNotice(addZoom ? '图片已添加，放大效果已在画布展示。原有内容与配色保留。' : '图片已压缩并保存在本机项目中。');
    } catch (err) { if (alive.current && imageRequest.current === request) setError(err instanceof Error ? err.message : '图片处理失败，请重试。'); }
    finally { if (alive.current && imageRequest.current === request) setImageBusy(false); }
  };
  const previewHtml = useMemo(() => { if (!project || view !== 'preview') return ''; try { return renderBlockProject(project, { pageId: currentPage?.id }); } catch { return '';  } }, [project, currentPage?.id, view]);

  if (!project || !currentPage || !history) return <main className="bs-loading"><Layers3 size={32} />{error ? <><p role="alert">{messageText(error)}</p><a href="/studio/blocks">{t("返回我的草稿")}</a><button type="button" onClick={() => window.location.reload()}>{t("重新加载模板")}</button></> : <p>{t("正在打开模块工作区…")}</p>}</main>;
  const editLink = (type: BlockLink['type']) => updateBlock({ link: { type, target: type === 'page' ? project.pages.find(p => p.id !== currentPage.id)?.id || currentPage.id : type === 'section' ? currentPage.blocks.find(b => b.id !== selectedId)?.id || '' : '' } });
  return <main className="block-studio" style={{ '--bs-accent': project.accent } as CSSProperties}>
    <header className="bs-header"><a className="bs-brand" href="/studio"><ArrowLeft size={17} /><span>{t("文炳建站")}</span><span className="bs-header-separator" /><strong>{t("模块制作")}</strong></a><div className="bs-header-links"><a href="/studio/api">{t("API 创作")}<ArrowRight size={14} /></a><a href="/studio/manual">{t("模板制作")}<ArrowRight size={14} /></a><StudioLanguageSwitch /></div></header>
    {templateMode && <div className="bs-template-banner"><span>{t("正在编辑：")}{t("黑荧绿设计模板副本")}</span><a href="/studio/blocks"><ArrowLeft size={15} />{t("返回我的草稿")}</a></div>}
    <div className="bs-titlebar"><div><span className="bs-eyebrow">STYLE YOUR OWN CANVAS</span><h1>{t("选背景，配颜色，让页面动起来。")}</h1><p>{t("背景、配色和动效独立应用。内容与布局，由你决定。")}</p></div><span className="bs-local"><span />{t("本机创作 · 尚未发布")}</span></div>
    <span className="bs-hidden-label" role="status">{t(saved)}</span>
    {draftConflict && <div className="bs-notice is-error bs-draft-conflict" role="alert"><span>{t('另一页面已更新此项目，本页已暂停自动保存。当前内容仍保留，请下载副本或重新加载最新草稿。')}</span><div className="bs-conflict-actions"><button type="button" className="bs-button" onClick={downloadCurrentDraft}>{t('下载当前副本')}</button><button type="button" className="bs-button" onClick={reloadLatestDraft}>{t('重新加载最新草稿')}</button></div></div>}
    {(notice || error) && <div className={`bs-notice ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}><span>{messageText(error || notice)}</span><button type="button" className="bs-icon" aria-label={t("关闭提示")} onClick={() => { setError(''); setNotice(''); }}><X size={15} /></button></div>}
    <div className="bs-mobile-tabs" aria-label={t("编辑区域")}>{([{ id: 'library', label: '风格素材', icon: Layers3 }, { id: 'canvas', label: '页面画布', icon: LayoutTemplate }, { id: 'properties', label: '编辑属性', icon: MousePointer2 }] as const).map(tab => <button type="button" key={tab.id} aria-pressed={mobilePanel === tab.id} onClick={() => setMobilePanel(tab.id)}><tab.icon size={17} />{t(tab.label)}</button>)}</div>
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={startDrag} onDragCancel={() => setDragItem(null)} onDragEnd={endDrag} accessibility={{ screenReaderInstructions: { draggable: t('按空格拾起模块，方向键调整位置，再按空格放下，按 Escape 取消。也可以使用添加、上移和下移按钮。') } }}>
      <div className={`bs-workspace bs-mobile-${mobilePanel}`}>
        <aside className="bs-library bs-panel"><div className="bs-panel-heading"><div><span className="bs-step">01</span><h2>{t("风格素材")}</h2></div></div><div className="bs-segment bs-library-tabs">{([{ id: 'backgrounds', label: '背景' }, { id: 'palettes', label: '配色' }, { id: 'effects', label: '动效' }, { id: 'blocks', label: '结构' }] as const).map(tab => <button type="button" key={tab.id} aria-pressed={libraryTab === tab.id} onClick={() => setLibraryTab(tab.id)}>{t(tab.label)}</button>)}</div><p className="bs-helper">{libraryTab === 'blocks' ? t("通用结构，不包含任何网站的内容。") : libraryTab === 'effects' ? t("先看动态预览，再拖入区块；也可点击右下角应用。") : libraryTab === 'backgrounds' ? t("拖入背景预览即可应用；视频背景可选择本机视频。") : t("只改颜色，保留文字与跳转；拖动画面即可应用。")}</p>{(libraryTab === 'effects' || libraryTab === 'backgrounds') && <div className="bs-motion-control"><span>{previewMotion.reduced ? t("已跟随系统减少动画") : t("可见卡片自动演示")}</span><button type="button" onClick={previewMotion.toggle} disabled={previewMotion.reduced}>{previewMotion.paused || previewMotion.reduced ? <Play size={13} /> : <Pause size={13} />}{previewMotion.reduced ? t("静态预览") : previewMotion.paused ? t("播放演示") : t("暂停演示")}</button></div>}<div key={libraryTab} className="bs-library-scroll">{libraryTab === 'blocks' ? BLOCK_LIBRARY.map(item => <LibraryItem key={item.kind} item={item} onAdd={() => addBlock(item.kind)} />) : libraryTab === 'effects' ? EFFECT_LIBRARY.map(item => <EffectItem key={item.id} item={item} playing={previewMotion.playing} applied={selected?.effects.includes(item.id)} disabled={Boolean((!selected && currentPage.blocks.length) || selected?.kind === 'embed')} onAdd={() => applyEffect(item.id)} onRemove={() => removeEffect(item.id)} />) : libraryTab === 'palettes' ? [...PALETTE_LIBRARY.filter(item => item.id === 'ink-lime'), ...PALETTE_LIBRARY.filter(item => item.id !== 'ink-lime')].map(item => <MaterialItem key={item.id} type="palette" id={item.id} name={t(item.name)} description={t("背景、文字与强调色一起应用")} appearance={item.appearance} onAdd={() => applyMaterial({ palette: item.id })} />) : [...BACKGROUND_LIBRARY.filter(item => item.id === 'video'), ...BACKGROUND_LIBRARY.filter(item => item.id === 'halo'), ...BACKGROUND_LIBRARY.filter(item => !['halo', 'video'].includes(item.id))].map(item => item.id === 'video' ? <VideoMaterialItem key={item.id} playing={previewMotion.playing} onAdd={() => applyMaterial({ background: 'video' })} /> : <MaterialItem key={item.id} type="background" id={item.id} name={t(item.name)} description={t(item.description)} appearance={{ ...getBlockAppearance(selected || createBlock('surface'), project.accent), background: item.id }} onAdd={() => applyMaterial({ background: item.id })} />)}</div></aside>
        <section className="bs-center"><div className="bs-canvas-heading"><div><span className="bs-step">02</span><h2>{t("组合页面")}</h2></div><div className="bs-canvas-tools"><div className="bs-history-actions" role="group" aria-label={t("编辑历史")}><button type="button" className="bs-icon" aria-label={t("撤销")} title={t("撤销")} disabled={!history.past.length} onClick={undo}><Undo2 size={17} /></button><button type="button" className="bs-icon" aria-label={t("恢复")} title={t("恢复")} disabled={!history.future.length} onClick={redo}><Redo2 size={17} /></button></div><div className="bs-segment"><button type="button" aria-pressed={view === 'edit'} onClick={() => { setView('edit'); setMobilePanel('canvas'); revealWorkspaceRegion(`canvas-page-${currentPage.id}`); }}><LayoutTemplate size={15} />{t("编辑")}</button><button type="button" aria-pressed={view === 'preview'} onClick={() => { setView('preview'); setMobilePanel('canvas'); revealWorkspaceRegion('bs-page-editor'); }}><Eye size={15} />{t("预览")}</button></div></div></div>
          <div className="bs-pages"><label><span className="bs-hidden-label">{t("当前页面")}</span><select aria-label={t("当前页面")} value={currentPage.id} onChange={e => selectCanvasPage(e.target.value)}>{project.pages.map(page => <option key={page.id} value={page.id}>{page.title}</option>)}</select><ChevronDown size={14} /></label><button type="button" className="bs-icon" aria-label={t("新建页面")} onClick={addPage} disabled={project.pages.length >= MAX_PAGES}><FilePlus2 size={18} /></button><button type="button" className="bs-icon" aria-label={t("删除当前页面")} disabled={project.pages.length <= 1} onClick={deletePage}><Trash2 size={16} /></button><span className="bs-page-stats"><strong className="bs-page-total" aria-live="polite" aria-atomic="true">{t("共 {{count}} 页", { count: project.pages.length })}</strong><small>{currentPage.blocks.length} / {MAX_BLOCKS} {t("模块")}</small></span></div>
          <label className="bs-page-name"><span>{t("页面名称")}</span><input aria-label={t("页面名称")} value={currentPage.title} maxLength={60} onChange={e => commit(p => ({ ...p, pages: p.pages.map(page => page.id === currentPage.id ? { ...page, title: e.target.value } : page) }), `page-title:${currentPage.id}`)} /></label>
          <label className="bs-project-layout"><span>{t("网页版式")}</span><select aria-label={t("网页版式")} value={project.layout || 'free'} onChange={event => commit(p => ({ ...p, layout: event.target.value === 'portfolio' ? 'portfolio' : undefined }))}><option value="free">{t("自由区块")}</option><option value="portfolio">{t("个人作品集 · 双列作品与大字首屏")}</option></select></label>
          <div className="bs-random-config" role="group" aria-label={t('随机配置')}>
            <ProjectColorControls settings={getProjectColorSettings(project)} disabled={imageBusy || videoBusy}
              onToggle={toggleUnifiedColors} onColorChange={changeUnifiedColor} onPreset={applyUnifiedPalette} />
            <div className="bs-random-controls">
              <div className="bs-random-field"><label htmlFor="random-style-scope">{t('配置范围')}</label><select id="random-style-scope" value={randomScope} onChange={event => setRandomScope(event.target.value === 'block' ? 'block' : event.target.value === 'page' ? 'page' : 'site')}><option value="site">{t('整个网站')}</option><option value="page">{t('当前页面')}</option><option value="block">{t('选中区块')}</option></select></div>
              {randomScope === 'site' && <div className="bs-random-field"><label htmlFor="random-site-page-count">{t('网页数量')}</label><input id="random-site-page-count" type="number" min={1} max={MAX_PAGES} step={1} required value={randomPageCount} onChange={event => setRandomPageCount(event.target.value)} aria-invalid={!Number.isInteger(Number(randomPageCount)) || Number(randomPageCount) < 1 || Number(randomPageCount) > MAX_PAGES} aria-describedby="random-style-help" /></div>}
              <button type="button" className="bs-button bs-random-button" onClick={applyRandomStyle} disabled={imageBusy || videoBusy || (randomScope === 'block' ? !selected || selected.kind === 'embed' : randomScope === 'page' && currentPage.blocks.length > 0 && currentPage.blocks.every(block => block.kind === 'embed'))} aria-describedby="random-style-help"><Shuffle size={16} aria-hidden="true" />{randomScope === 'site' ? t('一键配置整站') : t('随机配置')}</button>
            </div>
            <p id="random-style-help">{randomScope === 'site' ? t('填写 1–10 的整数，点击后网站页数与输入一致。数量减少时保留前面的页面，移除后面的页面；可一次撤销恢复。') : <>{t('一键搭配背景、配色与动效，保留文字、图片和跳转；可撤销。')}{randomScope === 'page' && currentPage.blocks.length === 0 ? ' ' + t('空白页面会添加一个风格区块。') : randomScope === 'block' && (!selected || selected.kind === 'embed') ? ' ' + t('请先选中一个可编辑区块。') : currentPage.blocks.length > 0 && currentPage.blocks.every(block => block.kind === 'embed') ? ' ' + t('导入网页保留原有样式，请先添加一个可编辑区块。') : ''}</>}</p>
          </div>
          <div id="bs-page-editor" className="bs-page-editor" tabIndex={-1}>
          {view === 'edit' ? <><p className="bs-canvas-tip"><MousePointer2 size={14} />{t("所有网页在此纵向展开；点击区块直接编辑，拖入素材即可应用。")}</p>
            <div className="bs-vertical-pages">
              {project.pages.map((canvasPage, pageIndex) => <section key={canvasPage.id} id={`canvas-page-${canvasPage.id}`} data-canvas-page={canvasPage.id} className={`bs-canvas-page ${currentPage.id === canvasPage.id ? 'is-current' : ''}`} tabIndex={-1} aria-label={t('网页：{{name}}', { name: canvasPage.title })}>
                <div className="bs-canvas-page-heading"><h3><button type="button" className="bs-canvas-page-title" onClick={() => selectCanvasPage(canvasPage.id)} aria-pressed={currentPage.id === canvasPage.id}><span>{t('第 {{index}} 页', { index: pageIndex + 1 })}</span>{canvasPage.title}</button></h3><span>{t('{{count}} 个区块', { count: canvasPage.blocks.length })}</span></div>
                <SortableContext items={canvasPage.blocks.map(block => block.id)} strategy={verticalListSortingStrategy}>
                  <CanvasDrop pageId={canvasPage.id} empty={!canvasPage.blocks.length}>
                    {videoTarget?.pageId === canvasPage.id && !videoTarget.blockId && <div id="canvas-new-video"><BackgroundVideoPicker busy={videoBusy} onUpload={file => { selectCanvasBlock(canvasPage.id, ''); void uploadBackgroundVideo(file, '', canvasPage.id); }} onUrl={url => { selectCanvasBlock(canvasPage.id, ''); useVideoUrl(url, '', canvasPage.id); }} onCancel={cancelVideo} /></div>}
                    {zoomTarget?.pageId === canvasPage.id && !zoomTarget.blockId && <div id="canvas-new-image"><CanvasImagePicker busy={imageBusy} onUpload={file => { selectCanvasBlock(canvasPage.id, ''); void uploadImage(file, '', canvasPage.id, true); }} onCancel={cancelZoom} /></div>}
                    {canvasPage.blocks.map((block, index) => <SortableBlock key={block.id} block={block}
                      videoTools={block.kind !== 'embed' ? <>
                        {getBlockAppearance(block, project.accent).background === 'video' && block.backgroundVideo && <div className="bs-video-tools"><button type="button" className="bs-text-button" onClick={() => toggleBackgroundVideo(block)}>{block.backgroundVideo.paused ? <Play size={14} /> : <Pause size={14} />}{block.backgroundVideo.paused ? t("恢复背景自动播放") : t("暂停背景视频")}</button><button type="button" className="bs-text-button" onClick={() => openVideoPicker(block.id, canvasPage.id)}>{t("更换背景视频")}</button></div>}
                        {videoTarget?.pageId === canvasPage.id && videoTarget.blockId === block.id && <div id={`canvas-video-${block.id}`}><BackgroundVideoPicker busy={videoBusy} onUpload={file => { selectCanvasBlock(canvasPage.id, block.id); void uploadBackgroundVideo(file, block.id, canvasPage.id); }} onUrl={url => { selectCanvasBlock(canvasPage.id, block.id); useVideoUrl(url, block.id, canvasPage.id); }} onCancel={cancelVideo} /></div>}
                      </> : undefined}
                      imagePicker={block.kind !== 'embed' && ((zoomTarget?.pageId === canvasPage.id && zoomTarget.blockId === block.id) || (block.effects.includes('zoom') && !block.image)) ? <CanvasImagePicker busy={imageBusy} onUpload={file => { selectCanvasBlock(canvasPage.id, block.id); void uploadImage(file, block.id, canvasPage.id, true); }} onCancel={zoomTarget?.blockId === block.id ? cancelZoom : undefined} /> : undefined}
                      playing={previewMotion.playing} demo={effectDemos[block.id]}
                      onReplay={effect => effect === 'zoom' && !block.image ? applyEffect(effect, block.id, canvasPage.id) : replayEffect(block.id, effect, canvasPage.id)}
                      pageId={canvasPage.id} accent={project.accent} selected={currentPage.id === canvasPage.id && selectedId === block.id}
                      first={index === 0} last={index === canvasPage.blocks.length - 1}
                      onSelect={() => { selectCanvasBlock(canvasPage.id, block.id); if (window.innerWidth <= 800) setMobilePanel('properties'); }}
                      onMove={delta => moveBlock(block.id, delta)} onCopy={() => copyBlock(block.id)} onDelete={() => deleteBlock(block.id)} />)}
                  </CanvasDrop>
                </SortableContext>
              </section>)}
            </div>
          </> : <div className="bs-preview"><div className="bs-preview-toolbar"><span>{t("互动预览")}</span><div className="bs-segment"><button type="button" aria-label={t("电脑预览")} aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor size={17} /></button><button type="button" aria-label={t("手机预览")} aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone size={17} /></button></div></div>{!previewHtml && <p role="alert">{t('预览暂时无法生成，请检查项目内容。')}</p>}<iframe title={t("模块网站互动预览")} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={previewHtml} className={device === 'mobile' ? 'is-mobile' : ''} /><p className="bs-helper">{t("可以点击按钮、切换页面并体验特效。预览中不会打开外部网站。")}</p></div>}
          </div>
        </section>
        <aside className="bs-properties bs-panel"><div className="bs-panel-heading"><div><span className="bs-step">03</span><h2>{t("让它成为你的")}</h2></div></div>{selected ? <div className="bs-property-scroll"><div className="bs-selection-label"><span>{t(labelFor(selected.kind))}</span><strong>{selected.title.split('\n')[0] || t("未命名模块")}</strong></div><label className="bs-field"><span>{selected.kind === 'embed' ? t("模块名称") : t("标题")}</span><textarea rows={selected.kind === 'nav' ? 1 : 3} value={selected.title} maxLength={160} onChange={e => updateBlock({ title: e.target.value }, 'title')} /></label>
          {selected.kind === 'embed' ? <div className="bs-import-note"><LayoutTemplate size={22} /><p>{t("保留原网页的静态布局与内容；原网页脚本、表单和在线图片不会加载。可以调整它的顺序，在前后添加模块。")}</p><p>{t("此模块不直接修改原网页代码。切换预览可查看静态页面。")}</p></div> : <>
            {!['nav', 'signature'].includes(selected.kind) && <label className="bs-field"><span>{t("上方小标题")}</span><input value={selected.eyebrow} maxLength={100} onChange={e => updateBlock({ eyebrow: e.target.value }, 'eyebrow')} /></label>}
            {selected.kind !== 'nav' && <label className="bs-field"><span>{t("内容说明")}</span><textarea rows={5} value={selected.text} maxLength={5000} onChange={e => updateBlock({ text: e.target.value }, 'text')} /></label>}
            {selected.kind === 'accordion' && !selected.design && <AccordionItemsEditor key={selected.id} items={selected.items} onChange={items => updateBlock({ items }, 'items')} />}
            {selected.design && <DesignBlockFields block={selected} project={project} onChange={patch => updateBlock(patch, 'design')} />}
            {project.layout === 'portfolio' && !selected.design && <PortfolioBlockFields block={selected} project={project} onChange={patch => updateBlock(patch, 'portfolio')} />}
            <div className="bs-property-divider" /><h3 className="bs-property-subtitle">{t("背景与配色")}</h3><label className="bs-field"><span>{t("背景样式")}</span><select value={getBlockAppearance(selected, project.accent).background} onChange={e => updateAppearance({ background: e.target.value as BackgroundId })}>{BACKGROUND_LIBRARY.map(item => <option key={item.id} value={item.id}>{t(item.name)}</option>)}</select></label>
            <div className="bs-color-grid">{([{ key: 'backgroundColor', name: '背景颜色' }, { key: 'secondaryColor', name: '辅助颜色' }, { key: 'textColor', name: '文字颜色' }, { key: 'accentColor', name: '强调颜色' }] as const).map(color => <label key={color.key} className="bs-field bs-color-field"><span>{t(color.name)}</span><input type="color" value={getBlockAppearance(selected, project.accent)[color.key]} onChange={e => updateAppearance({ [color.key]: e.target.value })} /></label>)}</div><button type="button" className="bs-button bs-apply-page" onClick={applyPageAppearance}>{getBlockAppearance(selected, project.accent).background === 'video' ? t("将配色应用整页") : t("将此样式应用整页")}</button>
            {selected.backgroundVideo && getBlockAppearance(selected, project.accent).background === 'video' && <div className="bs-video-controls"><h3 className="bs-property-subtitle">{t("视频背景")}</h3><p className="bs-helper">{t("静音循环，离开画面自动暂停；减少动态效果或省流模式下显示静态背景。")}</p><label className="bs-field"><span>{t("遮罩深度 ·")}{Math.round(selected.backgroundVideo.dim * 100)}%</span><input type="range" aria-label={t("视频遮罩深度")} min="0" max="80" step="5" value={Math.round(selected.backgroundVideo.dim * 100)} onChange={event => updateBlock({ backgroundVideo: { ...selected.backgroundVideo!, dim: Number(event.target.value) / 100 } }, 'video-dim')} /></label><button type="button" className="bs-text-button" onClick={() => toggleBackgroundVideo(selected)}>{selected.backgroundVideo.paused ? t("恢复背景自动播放") : t("暂停背景视频")}</button><button type="button" className="bs-text-button" onClick={() => openVideoPicker(selected.id)}>{t("更换背景视频")}</button><button type="button" className="bs-text-button" onClick={() => { cancelVideo(); updateBlock({ backgroundVideo: undefined, appearance: { ...getBlockAppearance(selected, project.accent), background: 'solid' } }); setNotice('视频背景已移除，其他内容保留；可撤销。'); }}>{t("移除背景视频")}</button></div>}
            {(selected.kind === 'project' || ['editorial-hero', 'editorial-intro', 'editorial-contact'].includes(selected.design || '') || selected.image || selected.effects.includes('zoom') || zoomTarget?.blockId === selected.id) && <div className="bs-field"><span>{t("区块图片")}</span>{selected.image && <img className="bs-image-current" src={selected.image} alt={t("当前作品图片")} />}<label className={`bs-upload ${imageBusy ? 'is-busy' : ''}`}><ImagePlus size={18} />{imageBusy ? t("正在压缩图片…") : selected.image ? t("更换图片") : t("选择本机图片")}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={imageBusy} onChange={e => { void uploadImage(e.target.files?.[0], selected.id, currentPage.id, zoomTarget?.blockId === selected.id); e.target.value = ''; }} /></label><small>{t("仅保存在本机；自动缩小到 1200 像素以内。")}</small>{selected.image && <button type="button" className="bs-text-button" onClick={() => updateBlock({ image: '' })}>{t("移除图片")}</button>}</div>}
            {selected.kind !== 'nav' && <><div className="bs-property-divider" /><h3 className="bs-property-subtitle">{t("按钮与跳转")}</h3><label className="bs-field"><span>{t("按钮文字")}</span><input value={selected.button} maxLength={60} onChange={e => updateBlock({ button: e.target.value }, 'button')} /></label><label className="bs-field"><span>{t("点击后")}</span><select value={selected.link.type} onChange={e => editLink(e.target.value as BlockLink['type'])}><option value="none">{t("不跳转")}</option><option value="page">{t("进入另一个页面")}</option><option value="section">{t("滚动到指定模块")}</option><option value="url">{t("打开外部链接")}</option><option value="modal">{t("弹出内容详情")}</option></select></label>
              {selected.link.type === 'page' && <label className="bs-field"><span>{t("目标页面")}</span><select value={selected.link.target} onChange={e => updateBlock({ link: { ...selected.link, target: e.target.value } })}><option value="">{t("请选择页面")}</option>{project.pages.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>}
              {selected.link.type === 'section' && <label className="bs-field"><span>{t("目标模块")}</span><select value={selected.link.target} onChange={e => updateBlock({ link: { ...selected.link, target: e.target.value } })}><option value="">{t("请选择模块")}</option>{project.pages.map(page => <optgroup key={page.id} label={page.title}>{page.blocks.filter(b => b.id !== selected.id).map(b => <option key={b.id} value={b.id}>{b.title.split('\n')[0] || t(labelFor(b.kind))}</option>)}</optgroup>)}</select></label>}
              {selected.link.type === 'url' && <label className="bs-field"><span>{t("完整网址或邮箱链接")}</span><input type="text" placeholder="https://example.com" value={selected.link.target} maxLength={2000} onChange={e => updateBlock({ link: { ...selected.link, target: e.target.value } }, 'link')} /><small>{t("支持 https://、http://、mailto: 和 tel:。")}</small>{selected.link.target && !safeBlockUrl(selected.link.target) && <small className="bs-inline-warning">{t("请填写完整的有效链接，目前该按钮不会跳转。")}</small>}</label>}
              {selected.link.type === 'modal' && <p className="bs-helper">{t("点击按钮后，弹窗展示本模块的标题、说明和图片。")}</p>}
              {selected.link.type !== 'none' && !selected.button && <p className="bs-inline-warning">{t("填写按钮文字后，页面上才会显示跳转入口。")}</p>}
            </>}
            <div className="bs-property-divider" /><div className="bs-applied-heading"><h3 className="bs-property-subtitle">{t("已应用动效")}</h3><button type="button" className="bs-text-button" onClick={() => { setLibraryTab('effects'); setMobilePanel('library'); }}>{t("浏览动效")}<ArrowRight size={14} /></button></div><div className="bs-motion-control"><span>{previewMotion.reduced ? t("系统已减少动画") : t("演示仅供效果参考")}</span><button type="button" onClick={previewMotion.toggle} disabled={previewMotion.reduced}>{previewMotion.paused || previewMotion.reduced ? <Play size={13} /> : <Pause size={13} />}{previewMotion.reduced ? t("静态预览") : previewMotion.paused ? t("播放全部演示") : t("暂停全部演示")}</button></div><div className="bs-applied-effects">{selected.effects.length ? selected.effects.map(id => { const effect = EFFECT_LIBRARY.find(item => item.id === id); return effect ? <EffectItem key={id} item={effect} playing={previewMotion.playing} location={`applied:${selected.id}`} applied disabled={false} onAdd={() => applyEffect(id)} onRemove={() => removeEffect(id)} /> : null; }) : <p className="bs-no-effects">{t("还没有动效。从左侧拖入一张预览卡片，或点击卡片右下角的「应用」。")}</p>}</div><p className="bs-helper">{t("图片放大需要自己的图片。触屏与减少动态效果模式会自动简化动画。")}</p>
          </>}
          <div className="bs-property-divider" /><button type="button" className="bs-button bs-danger" onClick={() => deleteBlock(selected.id)}><Trash2 size={15} />{t("删除这个模块")}</button></div> : <div className="bs-properties-empty"><MousePointer2 size={26} /><h3>{t("选中一个模块")}</h3><p>{t("从左侧选择背景或配色开始；选中区块后，可以继续调整颜色、动效和内容。")}</p><button type="button" className="bs-button" onClick={() => { setMobilePanel('canvas'); setView('edit'); }}>{t("回到画布")}<ArrowRight size={14} /></button></div>}</aside>
      </div>
      <DragOverlay dropAnimation={null}>{dragItem && <div className="bs-drag-overlay"><GripVertical size={18} />{t((dragItem.type === 'library' ? labelFor(dragItem.kind) : dragItem.type === 'palette' ? PALETTE_LIBRARY.find(p => p.id === dragItem.palette)?.name : dragItem.type === 'background' ? BACKGROUND_LIBRARY.find(b => b.id === dragItem.background)?.name : dragItem.type === 'effect' ? EFFECT_LIBRARY.find(e => e.id === dragItem.effect)?.name : labelFor(project.pages.flatMap(page => page.blocks).find(b => b.id === dragItem.blockId)?.kind || 'text')) || '')}</div>}</DragOverlay>
    </DndContext>
  </main>;
}
