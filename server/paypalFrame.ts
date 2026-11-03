import { randomBytes } from 'crypto';

export function paypalFrame(input: {origin:string;channel:string;currency:string;clientId:string}, allowedOrigins:string[]) {
  const {origin,channel,currency,clientId}=input;
  if (!allowedOrigins.includes(origin) || !/^https?:/.test(origin) || new URL(origin).origin!==origin || !/^[\da-f-]{36}$/i.test(channel) || !/^[A-Z]{3}$/.test(currency) || !/^[A-Za-z0-9_-]{21,}$/.test(clientId) || /^(test|sb|replace_with|placeholder)/i.test(clientId)) throw new Error('PayPal checkout is not configured.');
  const nonce=randomBytes(24).toString('base64');
  const json=(v:unknown)=>JSON.stringify(v).replace(/</g,'\\u003c');
  const csp=`default-src 'none'; script-src 'nonce-${nonce}' https://*.paypal.com https://*.paypalobjects.com https://*.venmo.com; style-src 'unsafe-inline' https://*.paypal.com https://*.paypalobjects.com https://*.venmo.com; font-src https://*.paypalobjects.com data:; img-src https://*.paypal.com https://*.paypalobjects.com https://*.venmo.com data:; connect-src https://*.paypal.com https://*.paypalobjects.com https://*.venmo.com; frame-src 'self' https://*.paypal.com https://*.paypalobjects.com https://*.venmo.com; base-uri 'none'; object-src 'none'; form-action https://*.paypal.com; frame-ancestors ${origin}`;
  const sdk=`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}&intent=capture&components=buttons`;
  const html=`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Secure PayPal checkout</title><style>body{margin:0;background:transparent;font-family:system-ui}#error{color:#b42318;padding:12px;font-size:14px}</style></head><body><div id="buttons"></div><p id="error" role="alert"></p>
<script nonce="${nonce}">
const parentOrigin=${json(origin)},channel=${json(channel)},pending=new Map();let buttons;
function send(type,data={}){parent.postMessage({channel,type,...data},parentOrigin);}
function request(type,data={}){return new Promise((resolve,reject)=>{const id=crypto.randomUUID();const timeout=setTimeout(()=>{pending.delete(id);reject(Error('Checkout request timed out. Verify a pending payment before retrying.'));},120000);pending.set(id,{resolve,reject,timeout});send(type,{id,...data});});}
function failure(){document.getElementById('error').textContent='PayPal is temporarily unavailable. Please return to the payment options.';send('error');}
addEventListener('message',event=>{if(event.source!==parent||event.origin!==parentOrigin||event.data?.channel!==channel)return;const data=event.data;if(data.type==='response'){const call=pending.get(data.id);if(!call)return;clearTimeout(call.timeout);pending.delete(data.id);data.error?call.reject(Error(data.error)):call.resolve(data.result);}else if(data.type==='disabled'&&buttons){data.value?buttons.disable():buttons.enable();}});
function initialize(){buttons=paypal.Buttons({style:{layout:'vertical',color:'blue',shape:'rect',label:'pay'},createOrder:()=>request('create'),onApprove:data=>request('approve',{orderID:data.orderID}),onError:failure});buttons.render('#buttons').then(()=>send('ready',{clientId:${json(clientId)}})).catch(failure);}
const sdk=document.createElement('script');sdk.src=${json(sdk)};sdk.nonce=${json(nonce)};sdk.setAttribute('data-csp-nonce',${json(nonce)});sdk.onload=initialize;sdk.onerror=failure;document.head.appendChild(sdk);
</script></body></html>`;
  return {html,csp};
}
