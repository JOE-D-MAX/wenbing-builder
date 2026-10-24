import { MAX_BACKGROUND_VIDEO_BYTES, safeBackgroundVideoSrc, type BackgroundVideo } from './block-model';

/** Check local media before embedding it in a portable project. No server upload. */
export async function readBackgroundVideo(file: File): Promise<BackgroundVideo> {
  const mime = file.type || (/\.webm$/i.test(file.name) ? 'video/webm' : /\.mp4$/i.test(file.name) ? 'video/mp4' : '');
  if (!['video/mp4', 'video/webm'].includes(mime)) throw new Error('请选择 MP4 或 WebM 视频文件。');
  if (!file.size || file.size > MAX_BACKGROUND_VIDEO_BYTES) throw new Error('本机视频请控制在 2 MB 以内；较大的视频可以填写 HTTPS 视频直链。');
  const objectUrl = URL.createObjectURL(file);
  const media = document.createElement('video');
  media.muted = true; media.playsInline = true; media.preload = 'auto';
  try {
    const poster = await new Promise<string>((resolve, reject) => {
      const timer = window.setTimeout(() => finish(new Error('读取视频超时，请尝试其他 MP4 或 WebM 文件。')), 10000);
      const finish = (error?: Error, image = '') => {
        window.clearTimeout(timer); media.onloadeddata = null; media.onerror = null;
        error ? reject(error) : resolve(image);
      };
      media.onerror = () => finish(new Error('浏览器无法播放此视频，请换成 H.264 MP4 或 VP8/VP9 WebM。'));
      media.onloadeddata = () => {
        if (!media.videoWidth || !media.videoHeight) { finish(new Error('视频没有可用画面。')); return; }
        try {
          const canvas = document.createElement('canvas');
          const scale = Math.min(1, 480 / media.videoWidth);
          canvas.width = Math.max(1, Math.round(media.videoWidth * scale)); canvas.height = Math.max(1, Math.round(media.videoHeight * scale));
          canvas.getContext('2d')?.drawImage(media, 0, 0, canvas.width, canvas.height);
          finish(undefined, canvas.toDataURL('image/jpeg', .65));
        } catch { finish(); }
      };
      media.src = objectUrl;
    });
    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('读取视频失败，请重新选择。'));
      reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]+;/, `data:${mime};`));
      reader.readAsDataURL(file);
    });
    if (!safeBackgroundVideoSrc(src)) throw new Error('视频格式或大小不正确。');
    return { src, ...(poster ? { poster } : {}), dim: .35 };
  } finally {
    media.pause(); media.removeAttribute('src'); media.load(); URL.revokeObjectURL(objectUrl);
  }
}
