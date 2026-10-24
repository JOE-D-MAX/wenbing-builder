"use client";
import { StudioLanguageSwitch, useStudioI18n } from './studio-i18n';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { ArrowUpRight, ArrowRight, Check, ImagePlus, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react';
import type { SitePreviewDialogProps } from '@/components/studio/site-preview-dialog';
import { normalizeBrief, draftBackup, readDraftBackup, type Brief } from '@/lib/studio';
import { DesignControls } from '@/components/studio/design-controls';
import { withRequestTimeout, secureRandomUUID, decodeUploadImage, type DecodedImage } from '@/lib/client-compat';
import './manual-studio.css';
import { continueWithBlocks } from '@/lib/block-transfer';

type Kind='personal'|'business'|'restaurant';
type Preview={name:string;kind:Kind;layout:string;theme:string;sectionCount:number};
const types:{value:Kind;label:string;en:string}[]=[{value:'restaurant',label:'餐厅 / 小店',en:'LOCAL BUSINESS'},{value:'personal',label:'个人 / 作品集',en:'PERSONAL WEBSITE'},{value:'business',label:'品牌 / 工作室',en:'BRAND & STUDIO'}];
const examples:Record<Kind,Brief>={
 restaurant:{kind:'restaurant',name:'青屿小馆',text:'介绍：一间安静的季节餐桌，用新鲜食材和简单烹饪留住食物本来的味道。\n菜单：香草烤鸡 ¥68｜迷迭香与当日时蔬；菌菇烩饭 ¥48｜当季菌菇与芝士；柠檬气泡水 ¥22｜鲜榨柠檬与细腻气泡',prompt:'墨绿，菜单画册，衬线字体',contact:'地址：杭州市西湖区（示例地址）\n营业时间：周二至周日 11:00—21:00',image:''},
 personal:{kind:'personal',name:'林远 / LIN',text:'介绍：独立品牌与产品设计师，关注清晰的表达与真实的体验，常驻杭州，接受远程合作。\n项目：品牌设计｜让品牌拥有自己的表达；数字体验｜让每一次访问更清晰；创意咨询｜从想法到实施路径',prompt:'黑白极简，编辑留白，大标题',contact:'邮箱：hello@example.com',image:''},
 business:{kind:'business',name:'序物工作室',text:'介绍：专注日常器物的设计工作室，从材料、功能和使用习惯出发，创造实用而耐看的作品。\n服务：产品设计｜探索材料与形态；空间陈设｜为品牌空间搭配器物；定制合作｜从沟通到样品制作',prompt:'蓝色，品牌工作室，简洁现代',contact:'邮箱：studio@example.com',image:''},
};
const empty:Brief={kind:'restaurant',name:'',text:'',prompt:'墨绿，杂志感，大标题',contact:'',image:''};
const layoutNames:Record<string,string>={editorial:'编辑留白',studio:'品牌工作室',menu:'菜单画册'};
const themeNames:Record<string,string>={forest:'森林墨绿',ink:'黑白极简',blue:'深蓝商务',clay:'陶土暖调'};
async function api<T>(path:string,body?:unknown):Promise<T>{
 let r:Response,d:(T & {error?:string})|null;
 try{({response:r,data:d}=await withRequestTimeout(async signal=>{const response=await fetch(path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal});const data=await response.json().catch(()=>null) as (T & {error?:string})|null;return {response,data};}));}
 catch{throw new Error('网络暂时没有响应，资料仍保留在这里，请稍后重试。');}
 if(!d||!r.ok)throw new Error(d?.error||'服务暂时无法完成请求，请稍后重试。');return d;
}
function stored(key:string){try{return localStorage.getItem(key);}catch{return null;}}
function remember(key:string,value:string){try{localStorage.setItem(key,value);return true;}catch{return false;}}
function forget(key:string){try{localStorage.removeItem(key);}catch{}}
function saveFile(text:string,name:string){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}

function Sample({kind='restaurant',soft=false,priority=false}:{kind?:Kind;soft?:boolean;priority?:boolean}){
 const { t } = useStudioI18n();
 const ex=examples[kind];
 const imageSizes=priority?'(max-width: 560px) calc(48vw - 20px), (max-width: 800px) calc(48vw - 43px), (max-width: 1120px) calc(48vw - 69px), (min-width: 1600px) 495px, 456px':'(max-width: 560px) calc(48vw - 20px), (max-width: 1120px) 24vw, 230px';
 return <div className={'sample sample-'+kind+(soft?' soft':'')} aria-hidden="true"><div className="sample-nav"><b>{t(ex.name)}</b><span>ABOUT　 WORK　 CONTACT ↗</span></div><div className="sample-body"><span className="sample-kicker">{types.find(t=>t.value===kind)?.en}</span><h3>{kind==='restaurant'?<>{t("好好吃饭，")}<br/>{t("慢慢生活。")}</>:kind==='personal'?<>Thoughtful<br/><em>by design.</em></>:<>{t("把日常，")}<br/>{t("做得更有意思。")}</>}</h3><div className="sample-bottom"><span>{kind==='restaurant'?'FOOD · PEOPLE · MOMENTS':'IDEAS · CARE · CRAFT'}</span><i>↗</i></div></div><div className="sample-image">{kind==='restaurant'?<picture><source type="image/webp" srcSet="/sample-cafe-480.webp 480w, /sample-cafe-800.webp 800w, /sample-cafe-1200.webp 1200w" sizes={imageSizes}/><img src="/sample-cafe.jpg" width={1800} height={1200} alt="" loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} decoding="async"/></picture>:kind==='personal'?<div className="type-sculpture">Aa.</div>:<div className="object-sculpture"><i/><i/><i/></div>}</div></div>;
}

export default function ManualStudio(){
 const { t } = useStudioI18n();
 const [brief,setBrief]=useState<Brief>(empty),[preview,setPreview]=useState<Preview|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [previewHtml,setPreviewHtml]=useState(''),[previewOpen,setPreviewOpen]=useState(false),[device,setDevice]=useState<'desktop'|'mobile'>('desktop');
 const [PreviewDialog,setPreviewDialog]=useState<ComponentType<SitePreviewDialogProps>|null>(null);
 const [draftLoaded,setDraftLoaded]=useState(false),[draftStatus,setDraftStatus]=useState(''),[undo,setUndo]=useState<Brief|null>(null),[uploading,setUploading]=useState(false);
 const upload=useRef<HTMLInputElement>(null),importFile=useRef<HTMLInputElement>(null),imageRequest=useRef(0),requestKey=useRef(''),submittedBrief=useRef<Brief|null>(null),revision=useRef(0),draftInitialized=useRef(false);
 function edit(change:Partial<Brief>){
   revision.current++;
   if('image' in change){imageRequest.current++;setUploading(false);}
   setBrief(b=>({...b,...change}));setPreview(null);setPreviewHtml('');submittedBrief.current=null;requestKey.current='';setError('');setNotice('');setDraftStatus('正在保存…');
 }
 useEffect(()=>{
   if(draftInitialized.current)return;
   draftInitialized.current=true;
   const savedUndo=stored('forma-brief-undo-v1');
   if(savedUndo)try{setUndo(readDraftBackup(savedUndo));}catch{}
   let restored:Brief|null=null;
   const saved=stored('forma-brief-v3')||stored('forma-brief-v2');
   if(saved)try{restored=readDraftBackup(saved);setBrief(restored);setDraftStatus('已恢复上次填写的资料');}catch{setNotice('上次资料无法读取，可以导入已下载的资料备份。');}
    const params=new URLSearchParams(location.search);
    const example=params.get('example');
   if(example==='restaurant'||example==='personal'||example==='business'){
     const previous=restored||{...empty};
     remember('forma-brief-undo-v1',draftBackup(previous));setUndo(previous);setBrief({...examples[example]});
     setNotice('已填入所选方向的示例。原有资料仍可撤销恢复，发布前请改成自己的真实介绍。');
     window.history.replaceState(null,'','/studio/manual');
   }
   setDraftLoaded(true);
 },[]);
 useEffect(()=>{
   if(!draftLoaded)return;
   const save=()=>remember('forma-brief-v3',draftBackup(brief));
   const timer=setTimeout(()=>setDraftStatus(save()?'已自动保存在此浏览器':'浏览器空间不足，请下载资料备份'),600);
   window.addEventListener('pagehide',save);
   return()=>{clearTimeout(timer);window.removeEventListener('pagehide',save);};
 },[brief,draftLoaded]);
 async function generate(e:React.FormEvent){
   e.preventDefault();if(busy||uploading)return;setBusy(true);setError('');setNotice('');
   const version=revision.current,snapshot={...brief};
   try{
     const [d,dialog]=await Promise.all([
       api<{preview:Preview;html:string}>('/api/preview',snapshot),
       import('@/components/studio/site-preview-dialog').catch(()=>{throw new Error('预览窗口暂时无法加载，资料仍保留在这里，请稍后重试。');}),
     ]);
     if(version!==revision.current){setNotice('资料已修改，请重新生成预览。');return;}
     setPreviewDialog(()=>dialog.default);submittedBrief.current=snapshot;setPreview(d.preview);setPreviewHtml(d.html);requestKey.current=secureRandomUUID();setPreviewOpen(true);
   }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 function replaceBrief(next:Brief,message:string){remember('forma-brief-undo-v1',draftBackup(brief));setUndo({...brief});edit(normalizeBrief(next));setNotice(message);}
 function sample(kind:Kind){replaceBrief(examples[kind],'已填入演示资料，可以撤销替换。发布前请改成自己的真实介绍。');document.getElementById('create')?.scrollIntoView({behavior:'smooth'});}
 async function photo(file?:File){
   if(!file)return;const current=++imageRequest.current;setUploading(true);setError('');
   let bitmap:DecodedImage|undefined;
   try{
     if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('请上传 8 MB 内的 JPG、PNG 或 WebP 图片。');
     bitmap=await decodeUploadImage(file);if(current!==imageRequest.current)return;
     const canvas=document.createElement('canvas'),scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
     canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext('2d');if(!context)throw new Error('当前浏览器无法处理图片，请使用新版浏览器重试。');context.drawImage(bitmap.source,0,0,canvas.width,canvas.height);
     const image=canvas.toDataURL('image/jpeg',.8);if(image.length>1600000)throw new Error('图片压缩后仍过大，请选择较小图片。');
     if(current===imageRequest.current)edit({image});
   }catch(e){if(current===imageRequest.current)setError((e as Error).message||'这张图片无法读取，请换一张图片。');}
   finally{bitmap?.close();if(current===imageRequest.current)setUploading(false);if(upload.current)upload.current.value='';}
 }
 async function importDraft(file?:File){
   if(!file)return;const version=revision.current;setError('');
   try{if(file.size>1800000)throw new Error('备份文件过大，请选择文炳建站导出的资料文件。');const next=readDraftBackup(await file.text());if(version!==revision.current)throw new Error('资料正在修改，请再次选择要导入的备份。');replaceBrief(next,'资料已导入，你可以继续调整或生成预览。');}
   catch(e){setError(e instanceof SyntaxError?'文件不是有效的资料备份，请选择文炳建站导出的 JSON 文件。':(e as Error).message);}
   finally{if(importFile.current)importFile.current.value='';}
 }
   function downloadPreview(){
    if(!preview||!previewHtml){setError('请先生成网站预览。');return;}
    const url=URL.createObjectURL(new Blob([previewHtml],{type:'text/html;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=(preview.name||'website')+'.html';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
 function openBlocks(){try{continueWithBlocks(previewHtml,preview?.name||'我的模板网站');}catch(reason){setPreviewOpen(false);setError(reason instanceof Error?reason.message:'暂时无法打开模块工作区。');}}
 return <main className="manual-studio">
  <header className="site-nav manual-studio-nav">
   <a className="brand" href="/" aria-label={t("文炳建站首页")}><BrandMark/>{t("文炳建站")}<span>Wenbing</span></a>
   <div className="manual-header-actions"><a className="nav-cta" href="/studio/api">{t("切换 API 创作")}<ArrowUpRight size={16}/></a><StudioLanguageSwitch/>
  </div>
  </header>
  <div className="manual-block-entry section-wrap"><span>{t("想自由搭配背景、配色和动效？")}</span><a href="/studio/blocks">{t("打开模块拼搭")}<ArrowUpRight size={16}/></a></div>
  <section id="create" className="create-section">
   <div className="create-heading section-wrap"><div><p className="eyebrow">YOUR NEXT CHAPTER</p><h1>{t("下一个网站，关于你。")}</h1><p>{t("填入一些细节，看见你的第一个版本。")}</p></div><span className="guest-badge"><ShieldCheck size={17}/>{t("无需登录 · 免费预览")}</span></div>
   <div className="builder section-wrap">
    <form className="brief-form" onSubmit={generate}>
     <div className="form-heading"><span>{t("从你的故事开始")}</span><small>YOUR BRIEF</small></div>
     <fieldset><legend>{t("你要制作什么网站？")}</legend><div className="kind-tabs">{types.map(item=><button type="button" key={item.value} className={brief.kind===item.value?'active':''} aria-pressed={brief.kind===item.value} onClick={()=>edit({kind:item.value})}>{t(item.label.split(' / ')[0])}</button>)}</div></fieldset>
     <label>{t("名称")}<input required value={brief.name} maxLength={80} placeholder={t("例如：青屿小馆 / 林远设计")} onChange={e=>edit({name:e.target.value})}/></label>
     <label>{t("首页标题")}<span>{t("选填")}</span><input value={brief.headline||''} maxLength={160} placeholder={t("例如：好好吃饭，慢慢生活。")} onChange={e=>edit({headline:e.target.value})}/><small>{t("留空时使用网站名称作为首页标题。")}</small></label>
     <label>{t("介绍一下你自己或你的生意")}<textarea required minLength={8} maxLength={6000} rows={5} value={brief.text} onChange={e=>edit({text:e.target.value})} placeholder={t('介绍：你做什么，有什么特点…\n服务：名称｜简短说明；名称｜简短说明\n也可以填写菜单、项目或作品。')}/><small>{t("介绍可分段填写，服务、菜单或项目最多 12 项。用“｜”分隔名称和说明。")}</small></label>
     <label>{t("你希望它是什么感觉？")}<textarea rows={2} maxLength={600} value={brief.prompt} onChange={e=>edit({prompt:e.target.value})} placeholder={t("例如：黑白极简，编辑留白，大标题")}/></label><div className="prompt-chips">{['墨绿，菜单画册','黑白，编辑留白','蓝色，商务网格'].map(p=><button type="button" key={p} onClick={()=>edit({prompt:p,theme:'auto',layout:'auto',font:'auto'})}>{t(p)}</button>)}</div>
     <DesignControls brief={brief} onChange={edit}/>
     <label>{t("联系方式")}<span>{t("选填")}</span><textarea rows={2} maxLength={1000} value={brief.contact} onChange={e=>edit({contact:e.target.value})} placeholder={t('地址：…\n邮箱：… / 电话：… / 营业时间：…')}/></label>
     <input type="file" ref={upload} hidden accept="image/jpeg,image/png,image/webp" onChange={e=>void photo(e.target.files?.[0])}/><button type="button" className="upload-box" onClick={()=>upload.current?.click()}>{brief.image?<img src={brief.image} alt={t("已选择的介绍图片")}/>:<ImagePlus size={23}/>}<span><strong>{t(uploading?'图片处理中…':brief.image?'图片已准备好 · 点击替换':'加入一张自己的图片')}</strong><small>{t("门店、作品或肖像 · JPG / PNG / WebP · 8 MB 内")}</small></span><PlusIcon/></button>{brief.image&&<button type="button" className="remove-image" onClick={()=>edit({image:''})}>{t("移除图片")}</button>}
     <button className="btn dark full" disabled={busy||uploading}>{busy||uploading?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>} {t(uploading?'正在处理图片…':busy?'正在生成模板预览…':'免费生成网站预览')} <ArrowRight size={18}/></button><p className="form-note">{t("生成后可下载 HTML 文件，自行部署到任意静态托管。")}</p>
     <div className="draft-toolbar"><button type="button" onClick={()=>saveFile(draftBackup(brief),'文炳建站-网站资料.json')}>{t("下载资料")}</button><button type="button" onClick={()=>importFile.current?.click()}>{t("导入资料")}</button><button type="button" onClick={()=>sample(brief.kind)}>{t("填入示例")}</button><button type="button" onClick={()=>replaceBrief({...empty,kind:brief.kind},'已清空填写资料，可以撤销。')}>{t("清空资料")}</button></div><input type="file" ref={importFile} hidden accept=".json,application/json" onChange={e=>void importDraft(e.target.files?.[0])}/><p className="draft-status" role="status">{t(draftStatus)}<span>{t("· 资料备份请自行保管")}</span></p>{undo&&<div className="draft-undo"><span>{t("上一次替换前的资料还在。")}</span><button type="button" onClick={()=>{edit(undo);setUndo(null);forget('forma-brief-undo-v1');setNotice('已恢复替换前的资料。');}}>{t("撤销替换")}</button></div>}
    </form>
    <aside className="preview-aside"><div className="preview-top"><span>{t("你的网站预览")}</span><span className="live-dot"/><small>{t(preview?'免费预览已就绪':'等待你的故事')}</small></div>{preview?<><div className="template-frame"><iframe title={t("你的模板网站预览")} srcDoc={previewHtml} sandbox="" referrerPolicy="no-referrer"/><span>{t("PREVIEW / 尚未发布")}</span></div><div className="preview-controls"><button className="btn outline" onClick={()=>setPreviewOpen(true)}>{t("放大预览")}<ArrowUpRight size={16}/></button><button className="btn dark" onClick={downloadPreview}>{t("下载网站")}<ArrowRight size={16}/></button></div></>:<div className="locked-preview"><Sample kind={brief.kind} soft/><div className="lock-overlay"><span className="lock-circle"><Sparkles size={25}/></span><h3>{t("一个好故事，")}<br/>{t("就是一个好开始。")}</h3><p>{t("填入介绍，免费生成你的完整页面。")}<br/>{t("换个配色，或者再加一张图片。")}</p></div></div>}<div className="preview-foot"><span>{preview?t(themeNames[preview.theme] || preview.theme)+' · '+t(layoutNames[preview.layout] || preview.layout):t('先预览，满意再发布')}</span><span>DESKTOP + MOBILE</span></div><div className="preview-tips"><span><Check size={14}/>{t("完整页面预览")}</span><span><Check size={14}/>{t("资料自动保存")}</span><span><Check size={14}/>{t("电脑手机适配")}</span></div></aside>
   </div>
   {error&&<p className="feedback error" role="alert">{t(error)}</p>}{notice&&<p className="feedback" role="status">{t(notice)}</p>}
  </section>

  {PreviewDialog&&<PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} name={preview?.name||''} html={previewHtml} device={device} onDeviceChange={setDevice} onDownload={downloadPreview} onCustomize={openBlocks}/>}
 </main>;
}

function BrandMark(){return <svg className="brand-mark" width="29" height="29" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 22.5L9 9.5L16 23L23 9.5L28 22.5" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M11.5 17L16 8L20.5 17" stroke="#7795ee" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;}
function PlusIcon(){return <span aria-hidden="true" className="plus-icon">+</span>;}
