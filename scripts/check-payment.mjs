import { paymentConfigIssues } from '../lib/alipay.ts';

const read=key=>(process.env[key]||'').trim();
const issues=paymentConfigIssues({appId:read('ALIPAY_APP_ID'),sellerId:read('ALIPAY_SELLER_ID'),privateKey:read('ALIPAY_PRIVATE_KEY'),publicKey:read('ALIPAY_PUBLIC_KEY'),origin:read('FORMA_PUBLIC_ORIGIN')});
console.info('文炳建站 · 支付配置检查（不发起交易，不输出密钥）');
console.info('真实收款：'+(read('FORMA_SALES_ENABLED')==='true'?'开关已开启':'关闭'));
console.info('手机网站支付：'+(read('ALIPAY_WAP_PAY_ENABLED')==='true'?'已启用，需确认产品已签约':'未启用，使用电脑网站收银台'));
for(const key of ['FORMA_PUBLIC_ORIGIN','ALIPAY_APP_ID','ALIPAY_SELLER_ID','ALIPAY_PRIVATE_KEY','ALIPAY_PUBLIC_KEY'])console.info(`${issues.includes(key)?'待配置':'格式通过'}：${key}`);
console.info('此检查只验证本地格式。应用上线、支付产品签约、应用公钥绑定及真实交易仍需在支付宝验证。');
if(issues.length)process.exitCode=1;
