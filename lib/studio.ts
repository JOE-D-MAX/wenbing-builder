import type { SiteKind, Theme, Layout } from './generator';

export type Brief = {kind:SiteKind;name:string;text:string;prompt:string;contact:string;image:string;headline?:string;theme?:Theme|'auto';layout?:Layout|'auto';font?:'serif'|'sans'|'auto'};
export const THEMES = [{value:'forest',label:'森林墨绿',color:'#173e32'}, {value:'ink',label:'黑白极简',color:'#191919'}, {value:'blue',label:'深蓝商务',color:'#233d6a'}, {value:'clay',label:'陶土暖调',color:'#92513c'}] as const;
export const LAYOUTS = [{value:'editorial',label:'编辑留白',description:'大标题 · 作品与故事'}, {value:'studio',label:'品牌工作室',description:'卡片网格 · 服务与品牌'}, {value:'menu',label:'菜单画册',description:'清晰列表 · 餐厅与小店'}] as const;
export function normalizeBrief(input:unknown):Brief {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('资料格式不正确。');
  const b=input as Record<string,unknown>;
  if(!['personal','restaurant','business'].includes(String(b.kind)))throw new Error('请选择网站类型。');
  const limits={name:80,text:6000,prompt:600,contact:1000,image:1600000};
  for(const [field,limit] of Object.entries(limits))if(typeof b[field]!=='string'||b[field].length>limit)throw new Error('资料不完整或内容过长，请检查填写内容。');
  if(b.image&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.image as string))throw new Error('图片格式不支持。');
  if(b.headline!==undefined&&(typeof b.headline!=='string'||b.headline.length>160))throw new Error('首页标题请控制在 160 字以内。');
  const options={theme:['auto','forest','ink','blue','clay'],layout:['auto','editorial','studio','menu'],font:['auto','serif','sans']};
  for(const [field,values] of Object.entries(options))if(b[field]!==undefined&&!values.includes(b[field] as string))throw new Error('风格设置无效，请重新选择。');
  return {kind:b.kind as SiteKind,name:b.name as string,text:b.text as string,prompt:b.prompt as string,contact:b.contact as string,image:b.image as string,headline:(b.headline as string)||'',theme:(b.theme as Brief['theme'])||'auto',layout:(b.layout as Brief['layout'])||'auto',font:(b.font as Brief['font'])||'auto'};
}
export function readDraftBackup(raw:string):Brief {
  if(raw.length>1800000)throw new Error('备份文件过大，请选择本网站导出的资料文件。');
  const data=JSON.parse(raw);
  if(data?.format==='forma-brief'&&data.version!==1)throw new Error('此备份版本暂不支持。');
  return normalizeBrief(data?.format==='forma-brief'?data.brief:data);
}
export function draftBackup(brief:Brief){return JSON.stringify({format:'forma-brief',version:1,brief:normalizeBrief(brief)},null,2);}
