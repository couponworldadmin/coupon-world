import { useEffect, useRef, useState } from 'react';
import { validPaypalClientId } from '../lib/paymentConfiguration';

type Props={clientId:string;currency:string;disabled?:boolean;style?:unknown;createOrder:()=>Promise<string>;onApprove:(data:{orderID:string})=>Promise<void>;onError?:(error:unknown)=>void};
// PayPal's nonce-bearing scripts run on the API origin, without access to app sessions or the database.
export function SecurePaypalButtons(props:Props) {
  const frame=useRef<HTMLIFrameElement>(null);
  const [channel]=useState(()=>crypto.randomUUID());
  const [failed,setFailed]=useState(false);
  const [ready,setReady]=useState(false);
  const callbacks=useRef(props);
  useEffect(()=>{callbacks.current=props;},[props]);
  const api=new URL(import.meta.env.VITE_API_URL || 'http://localhost:4000');
  const origin=api.origin;
  const url=`${origin}/api/v1/payments/paypal/frame?${new URLSearchParams({origin:window.location.origin,currency:props.currency,channel})}`;
  useEffect(()=>{
    const requests=new Map<string,Promise<unknown>>();let active=true;
    const timeout=window.setTimeout(()=>{if(active)setFailed(true);},30000);
    const receive=async(event:MessageEvent)=>{
      if(event.source!==frame.current?.contentWindow||event.origin!==origin||event.data?.channel!==channel)return;
      const data=event.data;
      if(data.type==='ready'){
        if(data.clientId!==callbacks.current.clientId){setFailed(true);return;}
        clearTimeout(timeout);setReady(true);
        frame.current?.contentWindow?.postMessage({channel,type:'disabled',value:!!callbacks.current.disabled},origin);return;
      }
      if(data.type==='error'){setFailed(true);callbacks.current.onError?.(new Error('PayPal checkout is unavailable.'));return;}
      if(!['create','approve'].includes(data.type)||typeof data.id!=='string'||!/^[\da-f-]{36}$/i.test(data.id))return;
      if(!requests.has(data.id)){
        if(requests.size>=20)return;
        const action=async()=>{
          if(callbacks.current.disabled&&data.type==='create')throw new Error('Checkout is busy.');
          if(data.type==='create')return callbacks.current.createOrder();
          if(typeof data.orderID!=='string'||!/^[A-Z0-9]{5,100}$/.test(data.orderID))throw new Error('Invalid order reference.');
          await callbacks.current.onApprove({orderID:data.orderID});return true;
        };
        requests.set(data.id,action());
      }
      try {const result=await requests.get(data.id);if(active)frame.current?.contentWindow?.postMessage({channel,type:'response',id:data.id,result},origin);}
      catch {if(active)frame.current?.contentWindow?.postMessage({channel,type:'response',id:data.id,error:'Checkout could not be confirmed. Return to the app and verify any pending payment.'},origin);}
    };
    window.addEventListener('message',receive);
    return()=>{active=false;clearTimeout(timeout);window.removeEventListener('message',receive);};
  },[channel,origin]);
  useEffect(()=>{if(ready)frame.current?.contentWindow?.postMessage({channel,type:'disabled',value:!!props.disabled},origin);},[channel,origin,props.disabled,ready]);
  if(!validPaypalClientId(props.clientId)||failed)return <p role="status">PayPal is temporarily unavailable. Please select another payment method.</p>;
  return <div aria-busy={!ready}>{!ready&&<p role="status">Loading secure PayPal checkout…</p>}<iframe ref={frame} src={url} title="Secure PayPal checkout" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" onError={()=>setFailed(true)} style={{width:'100%',height:350,border:0,background:'transparent'}} /></div>;
}
