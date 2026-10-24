import { getStorage, setting } from '../lib/runtime.ts';
import { paymentConfigIssues } from '../lib/alipay.ts';

// Refuse a production boot with an ambiguous callback/cookie origin.
if (process.env.NODE_ENV === 'production') {
  const origin = setting('FORMA_PUBLIC_ORIGIN');
  let valid = false;
  try {
    const url = new URL(origin);
    valid = url.protocol === 'https:' && url.origin === origin && !url.username && !url.password;
  } catch {}
  if (!valid) throw new Error('FORMA_PUBLIC_ORIGIN must be the exact public HTTPS origin, without a trailing slash.');
}

if(setting('FORMA_SALES_ENABLED')==='true'){
  const issues=paymentConfigIssues({appId:setting('ALIPAY_APP_ID'),sellerId:setting('ALIPAY_SELLER_ID'),privateKey:setting('ALIPAY_PRIVATE_KEY'),publicKey:setting('ALIPAY_PUBLIC_KEY'),origin:setting('FORMA_PUBLIC_ORIGIN')});
  if(issues.length)throw new Error('Payment settings are incomplete or invalid: '+issues.join(', '));
}

// Checks the persistent directory and applies checked migrations before listening.
getStorage().close();
console.info('[wenbing] Persistent storage and migrations are ready.');
