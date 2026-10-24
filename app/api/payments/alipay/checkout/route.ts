import { commerceConfig, guest, ownedOrder, refreshOrder } from '@/lib/commerce';
import { paymentUrl, PAYMENT_WINDOW_MS } from '@/lib/alipay';
import { requestOrigin, json } from '@/lib/request';

export const dynamic='force-dynamic';

export async function GET(request:Request) {
  const origin=requestOrigin(request);
  const source=request.headers.get('origin');
  if((source&&source!==origin)||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'请从本站订单页面进入付款。'},403);
  const id=new URL(request.url).searchParams.get('order');
  if(!id||!/^F[a-f0-9]{30}$/.test(id))return json({error:'订单编号无效。'},400);
  const redirect=(url:string)=>new Response(null,{status:303,headers:{Location:url,'Cache-Control':'no-store','Referrer-Policy':'no-referrer',Vary:'User-Agent, Cookie'}});
  const back=(reason?:string)=>redirect(`${origin}/checkout?order=${encodeURIComponent(id)}${reason?'&payment='+reason:''}`);
  const owner=guest(request);
  if(!owner.exists)return back();
  let order;
  try {order=await ownedOrder(id,owner.hash);}catch{return back();}
  if(order.state==='paid')return back();
  const c=commerceConfig();
  if(!c.ready)return back('unavailable');
  // Never redirect to another payment attempt when the preceding payment cannot be checked.
  try {order=await refreshOrder(order);}catch{return back('unverified');}
  if(order.state==='paid')return back();
  if(order.state!=='pending'||Date.now()>=order.created_at+PAYMENT_WINDOW_MS)return back('expired');
  const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(request.headers.get('user-agent')||'');
  try {return redirect(paymentUrl(c.config,order,mobile&&c.mobilePayment?'wap':'page'));}
  catch{return back('unavailable');}
}
