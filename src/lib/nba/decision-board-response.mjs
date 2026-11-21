// Preserve the JSON contract, including every evidence row on busy slates.
export function boardResponse(board, acceptEncoding='') {
  const bytes=new TextEncoder().encode(JSON.stringify(board));
  let offset=0;
  const stream=new ReadableStream({pull(controller){
    if(offset>=bytes.length){controller.close();return;}
    const end=Math.min(bytes.length,offset+65536);
    controller.enqueue(bytes.subarray(offset,end));offset=end;
  }});
  const gzip=acceptEncoding.split(',').some(token=>{
    const [encoding,params='']=token.trim().toLowerCase().split(';');
    return encoding==='gzip' && (!params.trim() || /^q\s*=\s*(?:1(?:\.0*)?|0?\.\d+)$/.test(params.trim())&&Number(params.split('=')[1])>0);
  });
  const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Accept-Encoding'});
  if(gzip){headers.set('Content-Encoding','gzip');return new Response(stream.pipeThrough(new CompressionStream('gzip')),{headers});}
  return new Response(stream,{headers});
}
