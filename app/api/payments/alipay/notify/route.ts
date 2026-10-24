import { verifyNotification } from '@/lib/alipay';
import { commerceConfig,confirmTrade } from '@/lib/commerce';
export async function POST(request:Request){
  try {
    const reader=request.body?.getReader();if(!reader)throw new Error();let size=0,raw='';const decoder=new TextDecoder();
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32000){await reader.cancel();throw new Error();}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
    const trade=verifyNotification(new URLSearchParams(raw),commerceConfig().config);
    if(['TRADE_SUCCESS','TRADE_FINISHED'].includes(trade.trade_status||''))await confirmTrade(trade.out_trade_no||'',trade,true);
    return new Response('success',{headers:{'Content-Type':'text/plain'}});
  }catch{return new Response('failure',{status:400,headers:{'Content-Type':'text/plain'}});}
}
