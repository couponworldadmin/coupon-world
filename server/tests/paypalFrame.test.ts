import test from 'node:test';import assert from 'node:assert/strict';import { paypalFrame } from '../paypalFrame';
const options={origin:'https://coupon.example',channel:'00000000-0000-0000-0000-000000000001',currency:'USD',clientId:'A'.repeat(80)};
test('PayPal has a fresh per-document CSP nonce without permitting arbitrary inline scripts',()=>{
 const first=paypalFrame(options,[options.origin]),second=paypalFrame(options,[options.origin]);assert.notEqual(first.csp,second.csp);
 const nonce=first.csp.match(/'nonce-([^']+)'/)![1];assert.ok(first.html.includes(`nonce="${nonce}"`));assert.ok(first.html.includes('data-csp-nonce'));assert.ok(!first.csp.includes("script-src 'unsafe-inline'"));assert.ok(first.csp.includes(`frame-ancestors ${options.origin}`));assert.ok(!first.html.includes('supabase'));
});
test('only an allowed canonical parent origin, real public ID and valid protocol fields are accepted',()=>{
 for(const change of [{origin:'https://attacker.example'},{origin:'https://coupon.example/path'},{channel:'<script>'},{currency:'USD&x=1'},{clientId:'test'},{clientId:'REPLACE_WITH_PAYPAL_CLIENT_ID'}])assert.throws(()=>paypalFrame({...options,...change},[options.origin]));
});
test('messages and callbacks are origin-, source- and channel-bound; SDK identity stays public',()=>{
 const {html}=paypalFrame(options,[options.origin]);assert.ok(html.includes('event.source!==parent'));assert.ok(html.includes('event.origin!==parentOrigin'));assert.ok(html.includes('event.data?.channel!==channel'));assert.ok(html.includes('parent.postMessage({channel,type,...data},parentOrigin)'));assert.ok(!html.includes('access_token'));
});
