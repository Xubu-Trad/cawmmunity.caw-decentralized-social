const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function details(kind,record){
  const credits=record.credits.map(c=>'<li>'+escape(c.staker??c.wallet)+' · '+escape(c.amount)+' fixture CAW</li>').join('');
  const direct=record.accountCredit??record.authorCredit;
  return '<details><summary>'+escape(kind)+' receipt · block '+escape(record.block)+'</summary><p>Transaction <code>'+escape(record.hash)+'</code></p>'+
    (direct?'<p>Direct credit · '+escape(record.recipient??record.author)+' · '+escape(direct)+' fixture CAW</p>':'')+
    '<p>Staker credits</p><ul>'+credits+'</ul></details>';
}
export function renderSnapshot(feed,network,records){
  const receipt=(kind,hash)=>details(kind,records.get(kind+'/'+hash));
  const items=feed.items.map(i=>{
    const title=i.kind==='post'?i.name+' posted':i.name+' reCAWed '+i.originalName;
    const actions=Object.entries(i.actions).map(([kind,url])=>receipt(kind,url.split('#')[1])).join('');
    return '<article><h2>'+escape(title)+'</h2><blockquote>'+escape(i.body)+'</blockquote>'+receipt(i.kind,i.hash)+
      (i.kind==='recaw'?receipt('post',i.originalHash):'')+actions+'</article>';
  }).join('');
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; style-src &apos;unsafe-inline&apos;; base-uri &apos;none&apos;; form-action &apos;none&apos;"><title>Following · '+escape(feed.name)+'</title><style>html{color-scheme:dark;background:#091511;color:#dcf2e6;font:16px/1.55 system-ui}main{max-width:46rem;margin:auto;padding:2rem 1rem}h1,h2,summary{color:#97f0bf}article,footer{border-top:1px solid #456453;padding:1rem 0}summary{cursor:pointer}code,li,p{overflow-wrap:anywhere}blockquote{white-space:pre-wrap;margin:1rem 0}h2{font-size:1.2rem}</style><main><p>COMMUNITY.CAW / DISPOSABLE CHAIN</p><h1>'+escape(feed.name)+' · Following</h1><p>'+feed.items.length+' items · '+feed.following+' followed usernames</p>'+items+
    '<footer><p>The exporter checked these receipts against its local node at block '+feed.block+'. This offline copy displays those recorded results.</p><p>Block hash <code>'+escape(feed.blockHash)+'</code></p><p>Chain 1337 · genesis <code>'+escape(network.genesis)+'</code></p></footer></main></html>';
}
