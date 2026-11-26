const input=document.querySelector('#name'), items=document.querySelector('#items'), status=document.querySelector('#status');
let generation=0,timer;
function reset(){
  clearTimeout(timer);generation++;items.replaceChildren();status.textContent='';
}
async function read(path){
  const response=await fetch('/checkpoint/'+path,{cache:'no-store'});
  if(!response.ok)throw Error(await response.text());
  return response.json();
}
function line(parent,tag,text){
  const el=document.createElement(tag);el.textContent=text;parent.append(el);return el;
}
function watch(name){
  reset();const active=generation;
  let head=null,remembered=new Map();
  async function refresh(){
    try{
      if(head && (await read('head')).head===head)return;
      if(active!==generation)return;
      items.replaceChildren();status.textContent='Checking follows and payout receipts…';
      const feed=await read('following/'+encodeURIComponent(name));
      if(active!==generation)return;
      const next=new Map(),cards=document.createDocumentFragment();
      for(const {post} of feed.items){
        const card=line(cards,'article',''),old=remembered.get(post.hash);
        line(card,'h2',post.name);line(card,'blockquote',post.body);line(card,'p',post.hash);
        if(old && old.blockHash!==post.blockHash)line(card,'p','Re-mined in a different block');
        line(card,'h3','Current payouts');
        for(const c of post.credits)line(card,'p',c.amount+' CAW · '+c.staker);
        next.set(post.hash,post);
      }
      let missing=0;
      for(const [hash,old] of remembered){
        if(next.has(hash)||!feed.targets.includes(old.name))continue;
        const card=line(cards,'article','');line(card,'h2','Unresolved · '+old.name);
        line(card,'p',hash);line(card,'p','No current payout verified.');
        next.set(hash,old);missing++;
      }
      items.replaceChildren(cards);remembered=next;head=feed.head;
      status.textContent=feed.items.length+' verified · '+missing+' unresolved · '+feed.targets.length+' followed · '+head;
    }catch(e){
      if(active===generation){head=null;items.replaceChildren();status.textContent=e.message+' Checking again in 5 seconds.';}
    }finally{
      if(active===generation)timer=setTimeout(refresh,5000);
    }
  }
  refresh();
}
input.oninput=reset;
document.querySelector('form').onsubmit=e=>{e.preventDefault();watch(input.value);};
