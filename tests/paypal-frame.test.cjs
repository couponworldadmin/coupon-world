const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const {randomUUID}=require('node:crypto');

function harness(disabled=false){
 const effects=[],cleanups=[],refs=[],posts=[],channel=randomUUID();let receive,creates=0,approves=0;
 const react={useRef:value=>{const ref={current:value};refs.push(ref);return ref;},useState:value=>[typeof value==='function'?value():value,()=>{}],useEffect:fn=>effects.push(fn)};
 const source=fs.readFileSync('src/components/SecurePaypalButtons.tsx','utf8').replace('import.meta.env.VITE_API_URL',JSON.stringify('https://api.example'));
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const context={exports:{},crypto:{randomUUID:()=>channel},URL,URLSearchParams,clearTimeout,window:{location:{origin:'https://coupon.example'},setTimeout,addEventListener:(_,fn)=>{receive=fn;},removeEventListener(){}},require:name=>name==='react'?react:name==='react/jsx-runtime'?{jsx:()=>null,jsxs:()=>null}:{validPaypalClientId:id=>id}};
 vm.runInNewContext(code,context);
 const clientId='A'.repeat(80);
 context.exports.SecurePaypalButtons({clientId,currency:'USD',disabled,createOrder:async()=>{creates++;return 'PAYPALORDER1';},onApprove:async()=>{approves++;}});
 const sourceWindow={postMessage:(data,origin)=>posts.push({data,origin})};refs[0].current={contentWindow:sourceWindow};
 for(const effect of effects){const cleanup=effect();if(cleanup)cleanups.push(cleanup);}
 return {send:(data,origin='https://api.example',source=sourceWindow)=>receive({data,origin,source}),channel,sourceWindow,posts,refs,counts:()=>({creates,approves}),close:()=>cleanups.forEach(fn=>fn()),clientId};
}
test('untrusted frame messages never create or approve a payment',async()=>{
 const h=harness();try{
  const data={channel:h.channel,type:'create',id:randomUUID()};
  await h.send(data,'https://attacker.example');
  await h.send(data,'https://api.example',{});
  await h.send({...data,channel:randomUUID()});
  await h.send({...data,id:'invalid'});
  assert.deepEqual(h.counts(),{creates:0,approves:0});assert.equal(h.posts.length,0);
 }finally{h.close();}
});
test('trusted retries reuse one result and target only the API origin',async()=>{
 const h=harness();try{
  const data={channel:h.channel,type:'create',id:randomUUID()};
  await Promise.all([h.send(data),h.send(data)]);
  assert.equal(h.counts().creates,1);assert.equal(h.posts.length,2);
  for(const post of h.posts){assert.equal(post.origin,'https://api.example');assert.equal(post.data.result,'PAYPALORDER1');}
  await h.send({channel:h.channel,type:'approve',id:randomUUID(),orderID:'PAYPALORDER1'});
  assert.equal(h.counts().approves,1);
 }finally{h.close();}
});
test('busy checkout prevents a new order while allowing saved-payment verification',async()=>{
 const h=harness(true);try{
  await h.send({channel:h.channel,type:'create',id:randomUUID()});
  assert.equal(h.counts().creates,0);assert.match(h.posts[0].data.error,/could not be confirmed/);
  await h.send({channel:h.channel,type:'approve',id:randomUUID(),orderID:'PAYPALORDER1'});
  assert.equal(h.counts().approves,1);
 }finally{h.close();}
});
