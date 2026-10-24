// Original procedural motion, generated locally. No third-party video, photograph, text or identity.
// Development-only: requires ffmpeg with libvpx-vp9. Committed media is ready to use without ffmpeg.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'public', 'media');
mkdirSync(destination, { recursive: true });
const windowsFfmpeg = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'ffmpeg', 'ffmpeg.exe');
const ffmpeg = process.env.FFMPEG_PATH || (existsSync(windowsFfmpeg) ? windowsFfmpeg : 'ffmpeg');
const video = path.join(destination, 'background-demo.webm');
const poster = path.join(destination, 'background-demo.jpg');
// Periodic centres return to their starting position after three seconds for a seamless loop.
const near = 'exp(-((X/W-(0.35+0.15*sin(2*PI*T/3)))^2+(Y/H-(0.46+0.15*cos(2*PI*T/3)))^2)/0.045)';
const far = 'exp(-((X/W-(0.7+0.17*cos(2*PI*T/3)))^2+(Y/H-(0.6+0.17*sin(2*PI*T/3)))^2)/0.055)';
const filter = `format=gbrp,geq=r='9+120*${near}+19*${far}':g='17+150*${near}+75*${far}':b='23+46*${near}+105*${far}',format=yuv420p`;
function run(args) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ffmpeg failed (${result.status})`);
}
run(['-f', 'lavfi', '-i', 'color=c=black:s=480x270:r=24:d=3', '-vf', filter, '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-deadline', 'good', '-cpu-used', '4', '-metadata', 'comment=Original procedural abstract background', video]);
run(['-i', video, '-frames:v', '1', '-q:v', '3', poster]);
console.log(`Generated background demo: ${statSync(video).size} bytes; poster: ${statSync(poster).size} bytes.`);
