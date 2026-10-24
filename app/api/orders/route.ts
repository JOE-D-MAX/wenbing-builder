import { createOrder,guest,ownedOrder,refreshOrder,orderView,recoverOrder,issueReceipt } from '@/lib/commerce';
import { readBody,json } from '@/lib/request';
export async function POST(request:Request){
  try {const body=await readBody(request,1800000),g=guest(request);let order,warning:string|undefined;
    if(body.action==='create'){
      if(!g.exists)return json({error:'请允许本网站使用浏览器 Cookie 后刷新重试，以便保存订单访问凭证。'},400);
      order=await createOrder(request,body,g.hash);
    }
    else if(body.action==='status'&&g.exists)order=await ownedOrder(body.orderId,g.hash);
    else if(body.action==='recover')order=await recoverOrder(body.orderId,body.code,g.hash);
    else if(body.action==='receipt'&&g.exists)order=await issueReceipt(body.orderId,g.hash);
    else return json({error:'此浏览器没有订单访问凭证。'},403);
    if(body.action==='status'||body.action==='recover'){
      try {order=await refreshOrder(order);}
      catch {
        // Payment confirmation can succeed before publication fails. Return the
        // persisted state, and keep successful browser recovery independent of delivery.
        order=await ownedOrder(order.id,g.hash);
        warning=order.state==='paid'?'付款已确认，网站暂未完成交付。请稍后再次检查，无需重复付款。':'暂时无法确认付款状态。订单已保留，请稍后再次检查，勿重复付款。';
      }
    }
    const response=json({order:orderView(order),recoveryCode:order.recoveryCode,warning});response.headers.set('Set-Cookie',g.cookie);return response;
  }catch(e){return json({error:e instanceof Error?e.message:'订单暂不可用。'},400);}
}
