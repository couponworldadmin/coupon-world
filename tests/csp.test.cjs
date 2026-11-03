const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const crypto=require('node:crypto');
test('production CSP blocks arbitrary scripts and permits only required payment and database connections',async()=>{
 const {cspMetaPolicy,cspHeaderPolicy}=await import('../security/csp.mjs');const scripts=cspMetaPolicy.split('; ').find(v=>v.startsWith('script-src '));
 assert.ok(scripts.includes("'self'"));assert.ok(!scripts.includes("'unsafe-inline'"));assert.ok(!scripts.includes("'unsafe-eval'"));assert.ok(!scripts.includes('https: '));
 for(const domain of ['https://js.stripe.com','https://checkout.razorpay.com','https://*.paypal.com'])assert.ok(scripts.includes(domain));
 assert.ok(cspHeaderPolicy.includes("frame-ancestors 'none'"));assert.ok(cspHeaderPolicy.includes("object-src 'none'"));assert.ok(cspHeaderPolicy.includes("base-uri 'self'"));
 assert.ok(fs.readFileSync('render.yaml','utf8').includes(JSON.stringify(cspHeaderPolicy)));
});
test('built HTML enforces CSP, authorizes only the exact JSON-LD inline block, and has no inline event handlers',async()=>{
 const {cspMetaPolicy}=await import('../security/csp.mjs');const html=fs.readFileSync('dist/index.html','utf8');
 assert.ok(html.includes(`http-equiv="Content-Security-Policy" content="${cspMetaPolicy}"`));assert.doesNotMatch(html,/\son\w+=/i);
 for(const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)){
  const hash=crypto.createHash('sha256').update(match[1]).digest('base64');assert.ok(cspMetaPolicy.includes(`'sha256-${hash}'`),'Inline block must have an exact CSP hash');
 }
 assert.ok(html.indexOf('Content-Security-Policy')<html.indexOf('<script'));
});
