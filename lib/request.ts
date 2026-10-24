import { setting } from './runtime';

const localHost=(hostname:string)=>['localhost','127.0.0.1','[::1]'].includes(hostname);
export function publicOrigin(){
 const configured=setting('FORMA_PUBLIC_ORIGIN');if(!configured)return null;
 let url:URL;try{url=new URL(configured);}catch{throw new Error('FORMA_PUBLIC_ORIGIN must be a valid origin.');}
 if(url.username||url.password||url.pathname!=='/'||url.search||url.hash||(url.protocol!=='https:'&&!(url.protocol==='http:'&&localHost(url.hostname))))throw new Error('FORMA_PUBLIC_ORIGIN must be HTTPS without a path, query or credentials.');
 return url.origin;
}
export function requestOrigin(request:Request){
 const configured=publicOrigin();if(configured)return configured;
 const url=new URL(request.url);
 if(!localHost(url.hostname)||!['http:','https:'].includes(url.protocol))throw new Error('请配置正式网站的 FORMA_PUBLIC_ORIGIN。');
 return url.origin;
}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
export async function readBody(request:Request,max=6000000){
 const expected=requestOrigin(request),origin=request.headers.get('origin');if((origin&&origin!==expected)||request.headers.get('sec-fetch-site')==='cross-site')throw new Error('请求来源不正确。');
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error('请求格式不正确。');
 if(Number(request.headers.get('content-length')||0)>max)throw new Error('文件过大，请压缩图片。');
 const reader=request.body?.getReader();if(!reader)throw new Error('缺少内容。');let length=0;const chunks:Uint8Array[]=[];
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();throw new Error('文件过大，请压缩图片。')}chunks.push(value)}
 const data=new Uint8Array(length);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}return JSON.parse(new TextDecoder().decode(data));
}
