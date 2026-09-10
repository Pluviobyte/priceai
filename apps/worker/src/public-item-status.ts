/** Confirm business unavailability on an unknown shop's public item URL before
 * guessing a Shop API deployment. Does not follow redirects or execute HTML. */
export async function publicItemUnavailable(url:URL,signal:AbortSignal,fetchImpl:typeof fetch=fetch):Promise<string|null>{
  try{
    const response=await fetchImpl(url,{redirect:'error',headers:{accept:'application/json,text/html','user-agent':'PriceAI/0.1 (+https://priceai.io)'},signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])});
    if(!response.ok||!response.body){await response.body?.cancel();return null;}
    const reader=response.body.getReader();const parts:Uint8Array[]=[];let size=0;
    try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>65536)return null;parts.push(value);}}
    finally{await reader.cancel().catch(()=>undefined);}
    const body=JSON.parse(Buffer.concat(parts).toString());
    if(body.code===0&&typeof body.msg==='string'&&/商品.*(?:未上架|已下架|不存在)/.test(body.msg))return 'storefront_item_unavailable:'+body.msg;
  }catch{signal.throwIfAborted();}
  return null;
}
