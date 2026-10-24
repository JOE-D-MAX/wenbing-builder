'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

type VideoSource = { src: string; poster?: string; dim: number; paused?: boolean };
type DataConnection = EventTarget & { saveData?: boolean };

function allowedVideoSource(src: string) {
  return /^https?:\/\//i.test(src) || /^\/(?!\/)/.test(src) || /^data:video\/(?:mp4|webm);base64,/i.test(src);
}

/** A decorative, silent video layer. Its playback follows the editor's preview controls. */
export function BackgroundVideo({ video, playing = true, small = false }: { video: VideoSource; playing?: boolean; small?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const wrapper = useRef<HTMLSpanElement>(null);
  const [failed, setFailed] = useState(false);
  const [mediaSrc, setMediaSrc] = useState('');
  const src = allowedVideoSource(video.src) ? video.src : '';
  const dim = Number.isFinite(video.dim) ? Math.min(.85, Math.max(0, video.dim)) : .35;

  useEffect(() => { setFailed(false); setMediaSrc(''); }, [src]);

  useEffect(() => {
    const node = ref.current;
    const container = wrapper.current;
    if (!node || !container || !src || failed) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: DataConnection }).connection;
    let visible = false;
    let active = false;
    let disposed = false;
    const sync = () => {
      const limited = motion.matches || connection?.saveData;
      const shouldPlay = visible && playing && !video.paused && !document.hidden && !limited;
      if (limited) setMediaSrc('');
      if (!shouldPlay) {
        active = false;
        node.pause();
        return;
      }
      // Attaching src only on first visible playback prevents offscreen cards from downloading metadata.
      if (node.getAttribute('src') !== src) { setMediaSrc(src); return; }
      if (active) return;
      active = true;
      // Browsers may block autoplay or lack a codec; leave the poster visible in that case.
      try {
        const attempt = node.play();
        if (attempt) attempt.then(() => {
          if (disposed || !active) node.pause();
        }).catch(() => { active = false; });
      } catch { active = false; }
    };
    const observer = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); sync(); }, { threshold: .04 })
      : undefined;
    if (observer) observer.observe(container);
    else { visible = true; sync(); }
    document.addEventListener('visibilitychange', sync);
    node.addEventListener('loadedmetadata', sync);
    motion.addEventListener('change', sync);
    connection?.addEventListener('change', sync);
    return () => {
      disposed = true;
      active = false;
      observer?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      node.removeEventListener('loadedmetadata', sync);
      motion.removeEventListener('change', sync);
      connection?.removeEventListener('change', sync);
      node.pause();
    };
  }, [src, playing, video.paused, failed]);

  if (!src) return null;
  return <span ref={wrapper} className={`bs-background-video${small ? ' is-small' : ''}`} style={{ '--video-dim': dim } as CSSProperties} aria-hidden="true">
    {video.poster && <img className="bs-background-video-poster" src={video.poster} alt="" loading="lazy" />}
    {!failed && <video ref={ref} key={src} src={mediaSrc === src ? mediaSrc : undefined} poster={video.poster} muted loop playsInline preload="metadata" tabIndex={-1} disablePictureInPicture onError={() => setFailed(true)} />}
    <span className="bs-background-video-shade" />
  </span>;
}
