import { guest,ownedOrder,fulfill,storage } from '@/lib/commerce';
import { makeZip,deploymentFiles } from '@/lib/archive';
import { json } from '@/lib/request';
export async function GET(request:Request){
  try {const g=guest(request);if(!g.exists)return json({error:'请在下单浏览器领取。'},403);
    const order=await ownedOrder(new URL(request.url).searchParams.get('id'),g.hash);
    if(order.state!=='paid')return json({error:'付款确认后才能下载完整设计。'},402);
    await fulfill(order);const file=await storage().bucket.get(`sites/${order.site_key}.html`);if(!file)throw new Error('文件暂不可用。');
    return new Response(makeZip(deploymentFiles(await file.text())),{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="forma-website.zip"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return json({error:'无法访问订单文件，请使用下单浏览器。'},403);}
}
