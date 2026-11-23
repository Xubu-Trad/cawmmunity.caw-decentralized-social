import {renderActions} from './feed-actions.mjs';
const input=document.querySelector('#name'),items=document.querySelector('#items'),status=document.querySelector('#status');
let version=0;
function clear(){document.querySelector('#download').hidden=true;version++;items.replaceChildren();status.textContent='';}
function append(parent,tag,text){
  const el=document.createElement(tag);el.textContent=text;parent.append(el);return el;
}
async function load(name){
  clear();const current=version;status.textContent='Checking local receipts…';
  try{
    const response=await fetch('/feed/'+encodeURIComponent(name));
    if(!response.ok)throw Error(await response.text());
    const result=await response.json();if(current!==version)return;
    for(const item of result.items){
      const card=append(items,'article','');
      append(card,'h2',item.kind==='post'?item.name+' posted':item.name+' reCAWed '+item.originalName);
      append(card,'blockquote',item.body);
      append(card,'a','Verify '+(item.kind==='post'?'post':'reCAW')+' · '+item.hash).href=item.url;
      if(item.originalUrl)append(append(card,'p',''),'a','Open original post').href=item.originalUrl;
      renderActions(card,result.name,item);
    }
    const download=document.querySelector('#download');download.href='/download/'+encodeURIComponent(result.name)+'.html';download.hidden=false;
    status.textContent=result.following===0?'This username follows nobody yet.':result.items.length+' items from '+result.following+' followed usernames · checked through block '+result.block;
  }catch(e){if(current===version)status.textContent=e.message;}
}
input.oninput=clear;
document.querySelector('form').onsubmit=e=>{e.preventDefault();history.replaceState(null,'','?name='+encodeURIComponent(input.value));load(input.value);};
const initial=new URLSearchParams(location.search).get('name');
if(initial){input.value=initial;load(initial);}
