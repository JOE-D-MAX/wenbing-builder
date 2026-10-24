"use client";
import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowRight, Check, LockKeyhole, Menu, X } from 'lucide-react';
import type { Brief } from '@/lib/studio';
import { LiftoffEffects } from '@/components/studio/liftoff-effects';
import { StudioLanguageSwitch, useStudioI18n } from '@/components/studio/studio-i18n';

type Kind='personal'|'business'|'restaurant';
const types:{value:Kind;label:string;en:string}[]=[{value:'restaurant',label:'餐厅 / 小店',en:'LOCAL BUSINESS'},{value:'personal',label:'个人 / 作品集',en:'PERSONAL WEBSITE'},{value:'business',label:'品牌 / 工作室',en:'BRAND & STUDIO'}];
const examples:Record<Kind,Brief>={
 restaurant:{kind:'restaurant',name:'青屿小馆',text:'介绍：一间安静的季节餐桌，用新鲜食材和简单烹饪留住食物本来的味道。\n菜单：香草烤鸡 ¥68｜迷迭香与当日时蔬；菌菇烩饭 ¥48｜当季菌菇与芝士；柠檬气泡水 ¥22｜鲜榨柠檬与细腻气泡',prompt:'墨绿，菜单画册，衬线字体',contact:'地址：杭州市西湖区（示例地址）\n营业时间：周二至周日 11:00—21:00',image:''},
 personal:{kind:'personal',name:'林远 / LIN',text:'介绍：独立品牌与产品设计师，关注清晰的表达与真实的体验，常驻杭州，接受远程合作。\n项目：品牌设计｜让品牌拥有自己的表达；数字体验｜让每一次访问更清晰；创意咨询｜从想法到实施路径',prompt:'黑白极简，编辑留白，大标题',contact:'邮箱：hello@example.com',image:''},
 business:{kind:'business',name:'序物工作室',text:'介绍：专注日常器物的设计工作室，从材料、功能和使用习惯出发，创造实用而耐看的作品。\n服务：产品设计｜探索材料与形态；空间陈设｜为品牌空间搭配器物；定制合作｜从沟通到样品制作',prompt:'蓝色，品牌工作室，简洁现代',contact:'邮箱：studio@example.com',image:''},
};
function Sample({kind='restaurant',soft=false,priority=false}:{kind?:Kind;soft?:boolean;priority?:boolean}){
 const { t }=useStudioI18n();
 const ex=examples[kind];
 const imageSizes=priority?'(max-width: 560px) calc(48vw - 20px), (max-width: 800px) calc(48vw - 43px), (max-width: 1120px) calc(48vw - 69px), (min-width: 1600px) 495px, 456px':'(max-width: 560px) calc(48vw - 20px), (max-width: 1120px) 24vw, 230px';
 return <div className={'sample sample-'+kind+(soft?' soft':'')} aria-hidden="true"><div className="sample-nav"><b>{t(ex.name)}</b><span>ABOUT　 WORK　 CONTACT ↗</span></div><div className="sample-body"><span className="sample-kicker">{types.find(item=>item.value===kind)?.en}</span><h3>{kind==='restaurant'?<>{t('好好吃饭，')}<br/>{t('慢慢生活。')}</>:kind==='personal'?<>Thoughtful<br/><em>by design.</em></>:<>{t('把日常，')}<br/>{t('做得更有意思。')}</>}</h3><div className="sample-bottom"><span>{kind==='restaurant'?'FOOD · PEOPLE · MOMENTS':'IDEAS · CARE · CRAFT'}</span><i>↗</i></div></div><div className="sample-image">{kind==='restaurant'?<picture><source type="image/webp" srcSet="/sample-cafe-480.webp 480w, /sample-cafe-800.webp 800w, /sample-cafe-1200.webp 1200w" sizes={imageSizes}/><img src="/sample-cafe.jpg" width={1800} height={1200} alt="" loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} decoding="async"/></picture>:kind==='personal'?<div className="type-sculpture">Aa.</div>:<div className="object-sculpture"><i/><i/><i/></div>}</div></div>;
}

export default function Home(){
 const { t, locale }=useStudioI18n();
 const [mobileNav,setMobileNav]=useState(false);
 useEffect(()=>{
   const params=new URLSearchParams(location.search);
   const returnedId=params.get('order');
   if(returnedId&&/^F[a-f0-9]{30}$/.test(returnedId)){location.replace('/checkout?order='+encodeURIComponent(returnedId));return;}
   const editingId=params.get('editDraft');
   if(editingId)location.replace('/studio/manual?editDraft='+encodeURIComponent(editingId));
 },[]);
 return <main>
  <header className="site-nav">
   <a className="brand" href="#" aria-label={t('文炳建站首页')}><BrandMark/>{t('文炳建站')}{locale==='zh'&&<span>Wenbing</span>}</a>
   <nav id="main-navigation" className={mobileNav?'opened':''} aria-label={t('主导航')}>
    <a href="#why" onClick={()=>setMobileNav(false)}>{t('产品优势')}</a>
    <a href="#examples" onClick={()=>setMobileNav(false)}>{t('设计灵感')}</a>
    <a href="#how" onClick={()=>setMobileNav(false)}>{t('制作流程')}</a>
   </nav>
   <a className="nav-cta" href="/studio" onClick={()=>setMobileNav(false)}>{t('免费试做')} <ArrowUpRight size={16}/></a>
   <StudioLanguageSwitch/>
   <button className="mobile-menu" aria-label={t(mobileNav?'收起导航':'展开导航')} aria-expanded={mobileNav} aria-controls="main-navigation" onClick={()=>setMobileNav(!mobileNav)}>{mobileNav?<X size={21}/>:<Menu size={21}/>}</button>
  </header>

  <section className="hero">
   <LiftoffEffects/>
   <div className="hero-content">
    <p className="hero-badge"><span className="live-dot"/> A little story. A new beginning.</p>
    <h1>{t('让你的故事，')}<br/><span className="hero-em">{t('轻盈上线。')}</span></h1>
    <p className="hero-description">{t('一家小店，一个作品集，一个独立品牌。')}<br/>{t('把你想说的，变成一个值得分享的网站。')}</p>
    <div className="hero-actions"><a href="/studio" className="btn dark">{t('开始制作')} <ArrowUpRight size={18}/></a><a href="#examples" className="btn outline">{t('探索设计')} <ArrowRight size={18}/></a></div>
    <div className="hero-notes"><span><Check size={13}/> {t('无需注册')}</span><span><Check size={13}/> {t('完整预览免费')}</span><span><Check size={13}/> {t('满意再发布')}</span></div>
   </div>
   <div className="hero-stage">
    <div className="stage-glow" aria-hidden="true"/>
    <div className="floating-page">
     <div className="browser-bar"><div className="browser-dots" aria-hidden="true"><i/><i/><i/></div><span><LockKeyhole size={11}/> qingyu.wenbing.site</span><span className="browser-label">{t('风格示例')}</span></div>
     <Sample priority/>
    </div>
    <div className="floating-note note-ready"><span className="note-icon"><Check size={17}/></span><div><strong>{t('你的故事，准备出发。')}</strong><small>Beautifully made. Yours to share.</small></div></div>
    <div className="floating-note note-style"><span className="palette-dots" aria-hidden="true"><i/><i/><i/></span><div><strong>{t('有风格，也有你的个性。')}</strong><small>{t('选配色 · 换版式 · 加入图片')}</small></div></div>
   </div>
   <p className="stage-caption">{t('一个想法，更多可能。')}<span>MADE FOR YOUR NEXT CHAPTER</span></p>
  </section>

  <div className="audience-bar"><span>{t('为每一种认真生活而设计')}</span><p>{t('独立创作者')}<i>·</i>{t('街角小店')}<i>·</i>{t('餐厅咖啡')}<i>·</i>{t('品牌工作室')}</p></div>

  <section id="why" className="why section-wrap reveal">
   <div className="section-intro"><p className="eyebrow">A SPACE OF YOUR OWN</p><h2>{t('好故事，')}<br/>{t('值得一个自己的主场。')}</h2><p>{t('把散落的介绍、作品和联系方式，')}<br/>{t('整理成一份清晰、完整的第一印象。')}</p></div>
   <div className="reason-list">{[
    ['01','一眼了解你的精彩。','菜单、服务、作品与联系方式。让第一次遇见，从完整的介绍开始。'],
    ['02','一个链接，随时分享。','发给客户，放进社交主页，或印成门店二维码。每次介绍，都有一个落点。'],
    ['03','让你的风格，被记住。','用自己的图片、色彩和排版，呈现小店的温度，也呈现作品的专业感。'],
   ].map(([n,title,body])=><article key={n}><span>{n}</span><div><h3>{t(title)}</h3><p>{t(body)}</p></div><ArrowUpRight size={22}/></article>)}</div>
  </section>

  <section id="examples" className="examples-section">
   <div className="section-top section-wrap reveal"><div><p className="eyebrow">EXPLORE THE POSSIBILITIES</p><h2>{t('不同故事，各有样子。')}</h2></div><p>{t('找到喜欢的方向，')}<br/>{t('再把它变成你的风格。')}</p></div>
   <div className="examples-grid section-wrap">{types.map((item,i)=><a key={item.value} className="example-card reveal" href={'/studio?example='+item.value} aria-label={t('用{{type}}的示例试做',{type:t(item.label)})}><div className="example-window"><div className="example-browser" aria-hidden="true"><i/><i/><i/></div><Sample kind={item.value}/><div className="example-hover"><span>{t('用这个方向试做')} <ArrowUpRight size={18}/></span></div></div><div className="example-meta"><span><small>0{i+1} / {item.en}</small>{t(item.label)}</span><span className="example-arrow"><ArrowUpRight size={20}/></span></div></a>)}</div>
   <p className="example-foot">{t('以上为风格示例。选一个方向，免费预览属于你的完整页面。')}</p>
  </section>

  <section id="how" className="how-section">
   <div className="how section-wrap reveal"><div className="how-copy"><p className="eyebrow">LESS FRICTION. MORE CREATION.</p><h2>{t('你负责介绍。')}<br/>{t('让想法，轻松落地。')}</h2><p>{t('不用从空白页面开始。')}<br/>{t('从写下第一句话，到看见完整的网站。')}</p><a href="/studio" className="btn light">{t('开始我的故事')} <ArrowUpRight size={18}/></a><div className="how-orbit" aria-hidden="true"><BrandMark/><span/><span/></div></div><ol>{[['写下你的故事','选择用途，填写介绍，加入自己的图片。'],['完整预览，随心调整','选择配色与版式，免费查看自己的完整页面。'],['满意之后，发布上线','付款确认后领取公开网址与完整源码。']].map(([title,body],i)=><li key={title}><span>0{i+1}</span><div><h3>{t(title)}</h3><p>{t(body)}</p></div><ArrowUpRight size={20}/></li>)}</ol></div>
  </section>

  <footer className="site-footer section-wrap"><a className="brand" href="#" aria-label={t('返回文炳建站首页')}><BrandMark/>{t('文炳建站')}</a><p>{t('把你的故事，带到更远的地方。')}</p><span>© {new Date().getFullYear()} Wenbing Studio</span><a href="/studio">{t('开始创作')} <ArrowUpRight size={15}/></a></footer>

 </main>;
}

function BrandMark(){return <svg className="brand-mark" width="29" height="29" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 22.5L9 9.5L16 23L23 9.5L28 22.5" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M11.5 17L16 8L20.5 17" stroke="#7795ee" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;}
