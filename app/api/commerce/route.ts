import { commerceConfig,guest } from '@/lib/commerce';
import { json } from '@/lib/request';
export async function GET(request:Request){const c=commerceConfig(),g=guest(request);const response=json({prices:c.prices,ready:c.ready,support:c.support,provider:'alipay'});response.headers.set('Set-Cookie',g.cookie);return response;}
