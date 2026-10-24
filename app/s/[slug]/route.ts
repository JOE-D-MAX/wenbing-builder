import { storage } from '@/lib/commerce';
export async function GET(request:Request){
  const slug=new URL(request.url).pathname.split('/').filter(Boolean).pop()||'';
  if(!/^[a-f0-9]{36}$/.test(slug))return new Response('网站不存在',{status:404});
  const {db,bucket}=storage();
  const order=await db.prepare("SELECT id FROM orders WHERE site_key=? AND state='paid' AND published_at IS NOT NULL").bind(slug).first();
  if(!order)return new Response('网站尚未发布',{status:404,headers:{'Cache-Control':'no-store'}});
  const file=await bucket.get(`sites/${slug}.html`);if(!file)return new Response('网站暂不可用',{status:503});
  return new Response(file.body,{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public,max-age=60','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"sandbox allow-popups; default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"}});
}
