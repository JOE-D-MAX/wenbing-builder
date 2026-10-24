import { getStorage, setting } from '../lib/runtime.ts';

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

// Checks the persistent directory and applies checked migrations before listening.
getStorage().close();
console.info('[wenbing] Persistent storage and migrations are ready.');
