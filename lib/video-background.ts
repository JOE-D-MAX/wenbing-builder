import { cleanBackgroundVideo, getBlockAppearance, type SiteBlock } from './block-model';

function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

/** The source stays inert until this block is visible and playback is permitted. */
export function renderVideoBackground(block: SiteBlock): string {
  const video = cleanBackgroundVideo(block.backgroundVideo);
  if (block.kind === 'embed' || getBlockAppearance(block).background !== 'video' || !video) return '';
  return '<div class="block-video-layer" aria-hidden="true"><video id="background-video:' + escapeAttribute(block.id) + '" data-background-video data-src="' + escapeAttribute(video.src) + '"' + (video.paused ? ' data-paused="true"' : '') + (video.poster ? ' poster="' + escapeAttribute(video.poster) + '"' : '') + ' muted loop playsinline preload="none" tabindex="-1"></video><span class="block-video-shade" style="opacity:' + video.dim + '"></span></div><button type="button" class="block-video-toggle" data-video-toggle aria-controls="background-video:' + escapeAttribute(block.id) + '" aria-pressed="false">播放背景视频</button>';
}

export const VIDEO_BACKGROUND_STYLES = `
.block-video-layer{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}.block-video-layer>video{display:block;width:100%;height:100%;object-fit:cover;object-position:center}.block-video-shade{position:absolute;inset:0;background:#000;pointer-events:none}.block-video-layer.video-failed{display:none}.site-block>.block-video-toggle{position:absolute;right:14px;bottom:12px;z-index:3;min-height:44px;min-width:44px;padding:9px 13px;border:1px solid #ffffff70;border-radius:5px;background:#111d;color:#fff;font-size:12px;line-height:1.4;cursor:pointer;touch-action:manipulation}.site-block>.block-video-toggle:hover{background:#111}.site-block>.block-video-toggle:disabled{cursor:default;opacity:.7}.site-block>.block-video-toggle:focus-visible{outline:2px solid #fff;outline-offset:3px}
`;

/** Visibility and user intent drive playback. No animation loop or external script. */
export const VIDEO_BACKGROUND_SCRIPT = String.raw`(()=>{'use strict';
const videos=Array.from(document.querySelectorAll('[data-background-video]'));
if(!videos.length)return;
const reduce=matchMedia('(prefers-reduced-motion: reduce)'),connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
const states=videos.map(video=>({video,block:video.closest('.site-block'),button:video.closest('.site-block')?.querySelector('[data-video-toggle]'),layer:video.parentElement,visible:false,intent:video.dataset.paused==='true'?'pause':'auto',pending:false,failed:false,blocked:false}));
const allowed=s=>s.visible&&!document.hidden&&!s.block?.closest('[hidden]')&&!s.failed&&s.intent!=='pause'&&!s.blocked&&(s.intent==='play'||(!reduce.matches&&!connection?.saveData));
const paint=s=>{if(!s.button)return;const playing=!s.video.paused&&!s.video.ended;s.button.textContent=s.failed?'视频不可用':playing?'暂停背景视频':'播放背景视频';s.button.setAttribute('aria-pressed',String(playing));s.button.disabled=s.failed};
const syncOne=s=>{if(!allowed(s)){s.video.pause();paint(s);return}if(!s.video.paused||s.pending){paint(s);return}if(!s.video.getAttribute('src'))s.video.src=s.video.dataset.src;s.video.muted=true;s.pending=true;let attempt;try{attempt=s.video.play()}catch{attempt=Promise.reject(new Error('Playback unavailable'))}Promise.resolve(attempt).then(()=>{s.pending=false;if(!allowed(s))s.video.pause();paint(s)},()=>{s.pending=false;if(allowed(s))s.blocked=true;paint(s)})};
const sync=()=>states.forEach(syncOne);
states.forEach(s=>{s.video.muted=true;s.video.addEventListener('play',()=>paint(s));s.video.addEventListener('pause',()=>paint(s));s.video.addEventListener('error',()=>{s.failed=true;s.video.pause();s.layer?.classList.add('video-failed');paint(s)});s.button?.addEventListener('click',()=>{if(s.failed)return;s.intent=!s.video.paused||s.pending?'pause':'play';s.blocked=false;syncOne(s)});paint(s)});
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{const state=states.find(s=>s.block===entry.target);if(state){state.visible=entry.isIntersecting;syncOne(state)}})},{threshold:.01});states.forEach(s=>{if(s.block)observer.observe(s.block)})}else{const measure=()=>{states.forEach(s=>{const box=s.block?.getBoundingClientRect();s.visible=!!box&&box.bottom>0&&box.top<window.innerHeight&&box.right>0&&box.left<window.innerWidth});sync()};window.addEventListener('scroll',measure,{passive:true});window.addEventListener('resize',measure,{passive:true});window.addEventListener('hashchange',measure);measure()}
document.addEventListener('visibilitychange',sync);window.addEventListener('hashchange',sync);window.addEventListener('pagehide',()=>states.forEach(s=>s.video.pause()));reduce.addEventListener?.('change',sync);connection?.addEventListener?.('change',sync);
})();`;
