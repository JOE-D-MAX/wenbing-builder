import { safeBlockImage, type BlockPage, type BlockProject, type SiteBlock } from './block-model';

type RenderHelpers = { escape: (value: string) => string; lines: (value: string) => string; action: (block: SiteBlock, project: BlockProject) => string; image: (block: SiteBlock) => string };

/** Original compositions shared with the visual editor; all user text is escaped. */
export function renderDesignContent(block: SiteBlock, _page: BlockPage, project: BlockProject, helpers: RenderHelpers): string | null {
  const { escape, lines, action, image } = helpers;
  const eyebrow = block.eyebrow ? '<p class="ed-eyebrow"><i aria-hidden="true"></i>' + escape(block.eyebrow) + '</p>' : '';
  const heading = eyebrow + '<h2 class="ed-heading">' + lines(block.title) + '</h2>';
  const copy = block.text ? '<p class="body-copy ed-copy">' + lines(block.text) + '</p>' : '';
  const button = action(block, project);
  const tags = () => block.items.length ? '<div class="ed-tags">' + block.items.map(item => '<span>' + escape(item.title) + '</span>').join('') + '</div>' : '';
  const media = '<div class="project-media ed-media">' + (safeBlockImage(block.image) ? image(block) : '<div class="ed-geometry" aria-hidden="true"><i></i><i></i><i></i><span></span></div>') + '</div>';
  switch (block.design) {
    case 'editorial-nav': {
      const links = block.items.map(item => {
        const target = project.pages.find(candidate => candidate.blocks.some(section => section.id === item.text));
        return target ? '<a href="#/' + target.id + '/' + item.text + '" data-section-link="' + item.text + '">' + escape(item.title) + '</a>' : '<span>' + escape(item.title) + '</span>';
      }).join('');
      return '<nav class="ed-nav" aria-label="网站导航"><a class="ed-brand" href="#/' + project.pages[0].id + '">' + escape(block.title || project.name) + '</a><div class="ed-nav-links">' + links + '</div>' + (button || '<span aria-hidden="true">↗</span>') + '</nav>';
    }
    case 'editorial-hero': return '<div class="ed-hero"><div class="ed-hero-copy">' + eyebrow + '<h1 tabindex="-1" class="ed-hero-title">' + lines(block.title) + '</h1>' + copy + button + '</div>' + media + '<span class="ed-scroll" aria-hidden="true">↓</span></div>';
    case 'editorial-intro': return '<div class="ed-intro"><div class="ed-intro-heading">' + heading + media + '</div><div class="ed-intro-copy"><span class="ed-round-arrow" aria-hidden="true">↗</span>' + copy + tags() + button + '</div></div>';
    case 'editorial-metrics': return '<div class="ed-section-heading">' + heading + copy + '</div><div class="ed-metric-grid">' + block.items.map(item => '<div><strong>' + escape(item.title || '—') + '</strong><span>' + lines(item.text) + '</span></div>').join('') + '</div>' + button;
    case 'editorial-timeline': return '<div class="ed-section-heading">' + heading + copy + '</div><div class="ed-timeline-list">' + block.items.map(item => '<article><i aria-hidden="true"></i><h3>' + escape(item.title) + '</h3><p class="body-copy">' + lines(item.text) + '</p><span aria-hidden="true">↗</span></article>').join('') + '</div>' + button;
    case 'editorial-project': return '<div class="ed-project">' + media + '<div class="ed-project-copy">' + heading + copy + tags() + button + '</div></div>';
    case 'editorial-steps': return '<div class="ed-section-heading">' + heading + copy + '</div><div class="ed-step-list">' + block.items.map((item, index) => '<details open><summary><span class="ed-step-marker">' + String(index + 1).padStart(2, '0') + '</span><span>' + escape(item.title) + '</span><span class="ed-plus" aria-hidden="true">+</span></summary><p class="body-copy">' + lines(item.text) + '</p></details>').join('') + '</div>' + button;
    case 'editorial-contact': return '<div class="ed-contact"><span class="ed-contact-orbit" aria-hidden="true"></span>' + heading + copy + button + (safeBlockImage(block.image) ? media : '') + '</div>';
    default: return null;
  }
}

export const DESIGN_STYLES = `
.site-block[class*="design-editorial-"]{padding:72px 32px;grid-column:1/-1;min-width:0;overflow:hidden}
.site-block[class*="design-editorial-"] .ed-heading{font-size:clamp(30px,4.4vw,62px);font-weight:750;line-height:1.12;letter-spacing:-.055em;overflow-wrap:anywhere}
.site-block[class*="design-editorial-"] .body-copy{font-size:16px;line-height:1.9}
.ed-eyebrow{display:flex;align-items:center;gap:9px;margin-bottom:24px!important;color:var(--muted);font-size:12px;line-height:1.6}
.ed-eyebrow>i{flex:none;width:6px;height:6px;border-radius:50%;background:var(--accent)}
.site-block[class*="design-editorial-"] .action{display:inline-flex;gap:30px;max-width:100%;margin-top:30px;padding:14px 23px;min-height:48px;border:1px solid var(--accent);border-radius:999px;background:var(--accent);color:var(--accent-text);font-size:14px;font-weight:600;line-height:1.4;overflow-wrap:anywhere}
.site-block[class*="design-editorial-"] .action:not(.action-unset):hover{filter:brightness(1.09)}
.ed-copy{margin-top:24px!important;max-width:680px}
.ed-media{position:relative;aspect-ratio:5/4;width:100%;height:auto;border-radius:18px;background:var(--block-secondary);overflow:hidden}
.ed-media>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ed-geometry{position:absolute;inset:0;min-height:100%;overflow:hidden;background:linear-gradient(125deg,var(--block-secondary),var(--block-bg));transition:transform .7s ease}
.ed-geometry>i{position:absolute;display:block;width:43%;height:72%;top:18%;left:23%;border-radius:44% 44% 8% 8%;border:1px solid color-mix(in srgb,var(--accent) 70%,transparent);background:linear-gradient(115deg,color-mix(in srgb,var(--accent) 28%,transparent),transparent 65%);transform:rotate(-23deg)}
.ed-geometry>i:nth-child(2){transform:rotate(12deg);left:32%;top:12%;background:color-mix(in srgb,var(--block-text) 7%,transparent)}
.ed-geometry>i:nth-child(3){transform:rotate(39deg);left:40%;top:17%;width:26%;background:color-mix(in srgb,var(--accent) 72%,var(--block-bg))}
.ed-geometry>span{position:absolute;left:8%;right:8%;bottom:10%;height:1px;background:color-mix(in srgb,var(--block-text) 22%,transparent);transform:rotate(-12deg)}
.ed-tags{display:flex;flex-wrap:wrap;gap:9px;margin-top:24px}
.ed-tags>span{padding:7px 12px;border:1px solid var(--block-border);border-radius:999px;color:var(--muted);font-size:12px;line-height:1.5}
.site-block.design-editorial-nav{padding:22px 32px;position:sticky;top:0;z-index:30;overflow:visible;border-bottom:0}
.ed-nav{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:70px;padding:12px 24px;border:1px solid var(--block-border);border-radius:999px;background:color-mix(in srgb,var(--block-bg) 82%,transparent);box-shadow:0 10px 26px #0002;backdrop-filter:blur(12px)}
.ed-brand{font-size:18px;font-weight:650;overflow-wrap:anywhere;max-width:40%}
.ed-nav-links{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:24px;font-size:13px;color:var(--muted)}
.ed-nav-links a,.ed-nav-links>span{padding:12px 0}
.ed-nav-links a:hover,.ed-nav-links a[aria-current]{color:var(--accent)}
.ed-nav>.action{margin:0!important;font-size:12px!important;padding:10px 16px!important}
.site-block.design-editorial-hero{padding:64px 32px 80px;min-height:640px;display:block}
.ed-hero{position:relative;width:100%;min-height:500px;padding-bottom:48px}
.ed-hero-copy{position:relative;z-index:1;width:72%}
.site-block .ed-hero-title{font-size:clamp(56px,8.7vw,124px);line-height:1.02;font-weight:750;letter-spacing:-.055em;overflow-wrap:anywhere}
.ed-hero-copy .ed-copy{max-width:90%}
.ed-hero>.ed-media{position:absolute;width:29%;right:0;bottom:32px;aspect-ratio:3/4;opacity:.85;transform:rotate(7deg)}
.ed-scroll{position:absolute;bottom:0;left:0;color:var(--accent);font-size:28px}
.ed-intro{display:grid;grid-template-columns:1fr 1fr;gap:7%;border-radius:24px}
.ed-intro-heading .ed-media{margin-top:38px;width:85%;aspect-ratio:1;transform:rotate(-4deg)}
.ed-intro-copy{align-self:end;padding-top:38px;padding-bottom:8px}
.ed-round-arrow{display:grid;place-items:center;width:62px;height:62px;border:1px solid var(--block-border);border-radius:50%;color:var(--accent);font-size:36px}
.ed-section-heading{margin-bottom:40px}
.ed-metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.ed-metric-grid>div{display:flex;min-width:0;flex-direction:column;justify-content:space-between;gap:26px;padding:36px 26px;min-height:205px;border:1px solid var(--block-border);border-radius:22px;background:color-mix(in srgb,var(--block-text) 3%,transparent)}
.ed-metric-grid>div:first-child{background:var(--accent);color:var(--accent-text);border-color:var(--accent)}
.ed-metric-grid strong{font-size:clamp(42px,6.5vw,90px);line-height:1;font-weight:700;letter-spacing:-.06em;overflow-wrap:anywhere}
.ed-metric-grid span{font-size:14px;line-height:1.6;overflow-wrap:anywhere}
.ed-timeline-list{padding-left:10px}
.ed-timeline-list>article{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 20px;padding:0 0 40px 34px;border-left:1px solid var(--block-border)}
.ed-timeline-list>article:last-child{padding-bottom:0;border-color:transparent}
.ed-timeline-list>article>i{position:absolute;width:11px;height:11px;left:-6px;top:8px;border:2px solid var(--accent);border-radius:50%;background:var(--block-bg)}
.ed-timeline-list h3{grid-column:1;margin:0;font-size:24px;line-height:1.5;font-weight:600;overflow-wrap:anywhere}
.ed-timeline-list .body-copy{grid-column:1;margin:6px 0 0}
.ed-timeline-list>article>span{grid-column:2;grid-row:1/3;color:var(--accent);font-size:26px}
.ed-project{display:grid;grid-template-columns:1.1fr 1fr;gap:6%;align-items:center}
.ed-project>.ed-media{aspect-ratio:4/5;min-height:100%}
.ed-project-copy{padding:12px 0;min-width:0}
.site-block .ed-project-copy .ed-heading{font-size:clamp(30px,4vw,54px)}
.ed-step-list details{border-top:1px solid var(--block-border);padding:28px 0}
.ed-step-list summary{display:grid;grid-template-columns:40px minmax(0,1fr) 28px;gap:22px;align-items:start;list-style:none;cursor:pointer;min-height:44px}
.ed-step-list summary::-webkit-details-marker{display:none}
.ed-step-marker{color:var(--accent);font-size:14px;padding-top:5px}
.ed-step-list summary>span:nth-child(2){font-size:24px;line-height:1.5;font-weight:600;overflow-wrap:anywhere}
.ed-step-list details>.body-copy{margin:10px 50px 0 62px}
.ed-plus{color:var(--muted);font-size:28px;line-height:1.3;transition:transform .25s}
.ed-step-list details:not([open]) .ed-plus{transform:rotate(0)}
.ed-step-list details[open] .ed-plus{transform:rotate(45deg)}
.ed-contact{position:relative;min-height:400px;text-align:center;overflow:hidden;padding:16px 0}
.ed-contact .ed-eyebrow{justify-content:center}
.site-block .ed-contact .ed-heading{position:relative;font-size:clamp(44px,7vw,102px);max-width:90%;margin:auto}
.ed-contact .ed-copy{position:relative;max-width:75%;margin-left:auto;margin-right:auto}
.ed-contact .action{position:relative;margin-top:34px}
.ed-contact .ed-media{max-width:300px;margin:35px auto 0}
.ed-contact-orbit{position:absolute;width:70%;aspect-ratio:1;border:1px solid color-mix(in srgb,var(--accent) 15%,transparent);border-radius:50%;left:15%;top:-38%;pointer-events:none}
.ed-contact-orbit:after{content:"";position:absolute;inset:13%;border:inherit;border-radius:inherit}
@media(hover:hover) and (pointer:fine){.fx-zoom:hover .ed-geometry{transform:scale(1.04)}}
@media(max-width:760px){
.site-block[class*="design-editorial-"]{padding:48px 20px}
.site-block.design-editorial-nav{padding:14px 12px}
.ed-nav{min-height:58px;padding:12px 15px;gap:12px;flex-wrap:wrap;border-radius:24px}
.ed-brand{font-size:15px}.ed-nav-links{gap:4px 14px;font-size:11px}.ed-nav>.action{min-height:36px}
.site-block.design-editorial-hero{padding:48px 20px 58px;min-height:560px}
.ed-hero{min-height:450px}.ed-hero-copy{width:85%}
.site-block .ed-hero-title{font-size:clamp(48px,10vw,76px)}
.ed-hero>.ed-media{width:27%;right:0;bottom:28px;opacity:.5}
.site-block[class*="design-editorial-"] .body-copy{font-size:14px}
.ed-intro{gap:22px}.ed-intro-heading .ed-media{margin-top:25px}
.site-block .ed-intro .ed-heading{font-size:clamp(24px,5.8vw,42px)}
.ed-round-arrow{width:44px;height:44px;font-size:26px}
.ed-metric-grid{gap:10px}.ed-metric-grid>div{padding:22px 12px;min-height:155px;gap:20px;border-radius:16px}
.ed-metric-grid strong{font-size:clamp(30px,8vw,54px)}.ed-metric-grid span{font-size:11px}
.ed-timeline-list h3{font-size:21px}.ed-timeline-list>article{padding-left:25px;padding-bottom:30px}
.ed-project{grid-template-columns:1fr;gap:28px}.ed-project>.ed-media{aspect-ratio:4/3}
.ed-step-list summary{grid-template-columns:26px minmax(0,1fr) 22px;gap:14px}
.ed-step-list summary>span:nth-child(2){font-size:20px}.ed-step-list details>.body-copy{margin:8px 0 0 40px}
.ed-contact{min-height:320px}.site-block .ed-contact .ed-heading{font-size:clamp(36px,8vw,60px)}
.ed-contact .ed-copy{max-width:90%}
}
@media(max-width:420px){.ed-intro{grid-template-columns:1fr;gap:24px}.ed-intro-heading .ed-media{width:65%;margin-inline:auto}.ed-intro-copy{padding-top:0}.ed-nav-links{gap:3px 10px}.ed-metric-grid{gap:7px}.ed-metric-grid>div{padding:18px 9px}}
@media(prefers-reduced-motion:reduce){.fx-zoom:hover .ed-geometry{transform:none}}
`;

/** Independent overlays avoid competing with the spotlight effect's pseudo-element. */
export const CURTAIN_STYLES = `
.curtain-shutters{position:absolute;inset:0;z-index:5;pointer-events:none;overflow:hidden}.curtain-shutters:before,.curtain-shutters:after{content:"";position:absolute;top:0;bottom:0;width:50.1%;background:var(--accent)}.curtain-shutters:before{left:0;transform:translateX(-101%);border-right:1px solid var(--block-border)}.curtain-shutters:after{right:0;background:color-mix(in srgb,var(--accent) 88%,var(--block-bg));transform:translateX(101%);border-left:1px solid var(--block-border)}.curtain-pending>.curtain-shutters:before,.curtain-pending>.curtain-shutters:after{transform:translateX(0)}.curtain-entered>.curtain-shutters:before{animation:block-curtain-left 1.35s cubic-bezier(.2,.65,.3,1) both}.curtain-entered>.curtain-shutters:after{animation:block-curtain-right 1.35s cubic-bezier(.2,.65,.3,1) both}@keyframes block-curtain-left{from{transform:translateX(0)}to{transform:translateX(-101%)}}@keyframes block-curtain-right{from{transform:translateX(0)}to{transform:translateX(101%)}}@media(prefers-reduced-motion:reduce){.curtain-shutters{display:none}}
`;

export const CURTAIN_SCRIPT = String.raw`(()=>{const reduce=matchMedia('(prefers-reduced-motion: reduce)');if(reduce.matches||!('IntersectionObserver'in window))return;const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.remove('curtain-pending');entry.target.classList.add('curtain-entered');observer.unobserve(entry.target)}}),{threshold:.04});document.querySelectorAll('.fx-curtain').forEach(block=>{block.classList.add('curtain-pending');observer.observe(block)});reduce.addEventListener?.('change',()=>{if(!reduce.matches)return;observer.disconnect();document.querySelectorAll('.curtain-pending').forEach(block=>block.classList.remove('curtain-pending'))})})();`;

