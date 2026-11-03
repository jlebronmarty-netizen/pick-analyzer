/** Single-flight browser poller; no provider credentials and no hidden-tab traffic. */
export function createPoller({load,onData,onError,visible=()=>true,isAutomatic=()=>true,subscribe=()=>()=>{},interval=60000,now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout}){
 let stopped=false,timer=null,controller=null,inflight=false,failures=0,finished=false,last=-Infinity;
 function clear(){if(timer!==null){clearTimer(timer);timer=null;}}
 function schedule(){clear();if(!stopped&&!finished&&visible()&&isAutomatic())timer=setTimer(()=>run(false),Math.min(300000,interval*2**failures));}
 async function run(manual=false){
  if(stopped||inflight||!visible()||(!manual&&finished))return;
  if(now()-last<10000){schedule();return;}last=now();inflight=true;controller=new AbortController();
  const timeout=setTimer(()=>controller?.abort(),60000);
  try{const data=await load(controller.signal);if(stopped||controller.signal.aborted)return;failures=0;finished=data?.data?.phase==='NOT_OPEN_FOR_PREGAME';onData(data);}
  catch(e){if(!stopped&&e?.name!=='AbortError'){failures=Math.min(3,failures+1);onError(e);}}
  finally{clearTimer(timeout);inflight=false;if(!stopped)schedule();}
 }
 const unsubscribe=subscribe(()=>{clear();if(!visible())controller?.abort();else if(isAutomatic())void run(false);});
 return {start(){void run(true);},refresh(){void run(true);},configure(){schedule();},stop(){stopped=true;clear();controller?.abort();unsubscribe();}};
}
export function preserveSelection(games,current){return games.some(g=>String(g.id)===String(current))?String(current):String(games[0]?.id??'');}
