import { Call, Window } from '@wailsio/runtime';
const invoke=(method,...args)=>Call.ByName('main.NetworkService.'+method,...args);
export const native={
  subscription:(url,headers)=>invoke('FetchSubscription',url,headers),
  json:(url)=>invoke('GetJSON',url),
  dns:(host)=>invoke('ResolveHost',host),
  minimise:()=>Window.Minimise(),
  maximise:async()=> (await Window.IsMaximised())?Window.Restore():Window.Maximise(),
  close:()=>Window.Close(),
  openNode:(payload)=>invoke('OpenNodeWindow',JSON.stringify(payload)),
  nodeData:(id)=>invoke('GetNodeWindowData',id),
  clearNodeData:(id)=>invoke('CloseNodeData',id),
};
