const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function compile(source,context){const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;context.exports={};vm.runInNewContext(code,context);return context.exports;}
function helper(name,context){const source=fs.readFileSync('src/lib/supabase.ts','utf8');const tree=ts.createSourceFile('supabase.ts',source,ts.ScriptTarget.Latest,true);return compile(tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name).getText(tree),context)[name];}
test('failed redemption never falls back to another financial route and retries reuse identity',async()=>{
 const requests=[];let fail=true;
 const fn=helper('markCouponUsedById',{validateCouponById:async()=>({coupon_id:'coupon',coupon_code:'fictional',remaining_balance:0}),redeemCouponCv:async(id,request)=>{requests.push({id,request});if(fail){fail=false;throw Error('Lost response');}return {remaining_balance:0,idempotent:true};},redeemCouponAmount:()=>{throw Error('UNSAFE FALLBACK');}});
 await assert.rejects(fn('coupon','stable-request'),/Lost response/);
 assert.equal(await fn('coupon','stable-request'),'fictional');assert.deepEqual(requests,[{id:'coupon',request:'stable-request'},{id:'coupon',request:'stable-request'}]);
});
test('public scan uses the minimal preview endpoint',async()=>{
 let call;
 const fn=helper('getCouponPreview',{supabase:{rpc:async(name,args)=>{call={name,args};return {data:[{company_name:'Fictional',can_redeem:true}]};}}});
 assert.equal((await fn(' reference ')).can_redeem,true);assert.equal(call.name,'get_coupon_preview');assert.equal(call.args.p_reference,'reference');
});
test('CORS allows primary and configured origins but rejects unrelated or lookalike sites',()=>{
 const {corsHeaders}=compile(fs.readFileSync('supabase/functions/_shared/cors.ts','utf8'),{Deno:{env:{get:name=>name==='ALLOWED_ORIGINS'?'https://merchant.example':undefined}}});
 for(const origin of ['https://coupon-frontend-e8b3.onrender.com','https://merchant.example']){
  const headers=corsHeaders(new Request('https://edge.example',{headers:{Origin:origin}}));assert.equal(headers['Access-Control-Allow-Origin'],origin);assert.equal(headers.Vary,'Origin');
 }
 for(const origin of ['https://evil.example','https://coupon-frontend-e8b3.onrender.com.evil.example','null'])assert.equal(corsHeaders(new Request('https://edge.example',{headers:{Origin:origin}}))['Access-Control-Allow-Origin'],undefined);
});
