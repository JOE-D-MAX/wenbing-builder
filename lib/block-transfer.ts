import { BLOCK_IMPORT_KEY, MAX_EMBED_HTML_CHARS } from './block-model';

/** Transfer only the generated document, never API credentials or account config. */
export function continueWithBlocks(html: string, title: string) {
  if (!html || html.length > MAX_EMBED_HTML_CHARS) throw new Error('这份网页过大，暂时无法带入模块工作区。');
  try { sessionStorage.setItem(BLOCK_IMPORT_KEY, JSON.stringify({ html, title: title.slice(0, 100) })); }
  catch { throw new Error('浏览器暂时无法保存网页，请先下载文件，再打开模块工作区。'); }
  location.assign('/studio/blocks?import=1');
}
