#!/usr/bin/env bash
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
repo=$(cd "$here/../../.." && pwd)
rpc=${1:?usage: operator.sh LOOPBACK_RPC DEPLOYMENT_JSON}
manifest=${2:?supply an independently selected deployment manifest}
mapfile -t addresses < <(node --input-type=module - "$manifest" <<'JS'
import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync(process.argv[2],'utf8'));
for(const key of ['registry','posts','likes','recaw','follow']){
  if(!/^0x[0-9a-fA-F]{40}$/.test(config[key]))throw Error('Missing address: '+key);
  console.log(config[key]);
}
JS
)
[[ ${#addresses[@]} == 5 ]] || exit 1
export CAW_OPERATOR_READ_ONLY=1
children=()
cleanup(){ for pid in "${children[@]}";do kill "$pid" 2>/dev/null || true;done; }
trap cleanup EXIT
trap 'exit 130' INT TERM
start(){
  local port=$1 route=$2
  shift 2
  "$@" & children+=("$!")
  for ((i=0;i<100;i++));do
    kill -0 "${children[-1]}" || return 1
    if curl -fsS --max-time 1 "http://127.0.0.1:$port$route" >/dev/null 2>&1;then return;fi
    sleep .2
  done
  echo "Service on port $port failed to become ready" >&2; return 1
}
# Reject occupied ports so a verifier never borrows a running publisher service.
node --input-type=module - <<'JS'
import net from 'node:net';
for(let port=34735;port<=34742;port++){
  if(port===34737)continue;
  const s=net.createServer();
  await new Promise((ok,no)=>s.once('error',no).listen(port,'127.0.0.1',ok));
  await new Promise(ok=>s.close(ok));
}
JS
cd "$repo"
start 34736 /config node "$here/wallet-server.mjs" "$rpc" "${addresses[0]}"
start 34738 /config node "$here/staked-post-service.mjs" "$rpc" "${addresses[0]}" "${addresses[1]}"
start 34739 /config node "$here/like-service.mjs" "${addresses[2]}"
start 34740 /config node "$here/like-service.mjs" "${addresses[3]}" --recaw
start 34741 /config node "$here/like-service.mjs" "${addresses[4]}" --follow
start 34742 / node "$here/feed-service.mjs"
start 34735 /website.html node --input-type=module -e "import {createServer} from './server.mjs';createServer().listen(34735,'127.0.0.1')"
echo "Green portal: http://127.0.0.1:34735/website.html"
wait -n "${children[@]}"
exit 1
