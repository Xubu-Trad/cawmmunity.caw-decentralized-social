const $=id=>document.getElementById(id);
let version=0, exampleFiles=null;
function clear(){version++;$('results').replaceChildren();$('status').textContent='';}
function line(parent,tag,text){const el=document.createElement(tag);el.textContent=text;parent.append(el);return el;}
function payouts(card,title,credits){
  line(card,'h3',title);
  const list=line(card,'ul','');
  for(const credit of credits)line(list,'li',credit.amount+' CAW · '+credit.staker);
}
async function verify(example=false){
  clear();const current=version;
  $('status').textContent='Checking receipts and block headers…';
  try{
    if(example){
      const response=await fetch('/checkpoint/example');if(!response.ok)throw Error('Example unavailable.');
      const data=await response.json();if(current!==version)return;
      exampleFiles=data.files;$('files').value='';$('pin').value=data.checkpoint;$('live').checked=false;$('height-label').hidden=true;
    }
    const selected=Array.from($('files').files);
    if(selected.reduce((size,file)=>size+file.size,0)>1048576)throw Error('Selection exceeds 1 MiB.');
    const files=exampleFiles??await Promise.all(selected.map(file=>file.text()));
    const response=await fetch('/checkpoint/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({files,checkpoint:$('pin').value,height:$('height').value,live:$('live').checked})});
    if(!response.ok)throw Error(await response.text());
    const data=await response.json();if(current!==version)return;
    $('status').textContent=data.posts.length+' verified · '+data.unresolved.length+' unresolved · checkpoint '+data.checkpoint;
    for(const item of data.posts){
      const card=line($('results'),'article','');
      line(card,'h2',item.post.name+' · '+item.membership);line(card,'blockquote',item.post.body);
      line(card,'p','Transaction '+item.post.hash);line(card,'p','Block '+item.post.blockHash);
      payouts(card,'At this checkpoint',item.post.credits);
      if(item.membership==='re-mined')payouts(card,'In the archived receipt',item.archivedCredits);
    }
    for(const item of data.unresolved){
      const card=line($('results'),'article','');line(card,'h2','Unresolved post');
      line(card,'p',item.tx);line(card,'p','Original block '+item.originalBlock);line(card,'p','No current payout verified.');
    }
  }catch(e){if(current===version)$('status').textContent=e.message;}
}
document.querySelector('form').oninput=clear;
$('files').onchange=()=>{exampleFiles=null;clear();};
$('live').onchange=()=>{$('height-label').hidden=!$('live').checked;clear();};
$('example').onclick=()=>verify(true);
document.querySelector('form').onsubmit=e=>{e.preventDefault();verify();};
fetch('/checkpoint/config').then(r=>r.json()).then(c=>{$('node-option').hidden=!c.live;}).catch(()=>{});
