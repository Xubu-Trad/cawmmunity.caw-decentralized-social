#!/usr/bin/env bash
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
geth=$(command -v "${GETH:-geth}")
snapshot=$(realpath "${1:?usage: replay-export.sh FEED.html HISTORY.rlp DEPLOYMENT.json}")
history=$(realpath "${2:?supply the same branch history}")
deployment=$(realpath "${3:?supply the deployment manifest}")
base=$(mktemp -d)
echo "Fresh verifier database and logs: $base"
children=()
cleanup(){ for pid in "${children[@]}";do kill -TERM "$pid" 2>/dev/null || true;done;wait || true; }
trap cleanup EXIT
trap 'exit 130' INT TERM
ready(){
  local url=$1 pid=$2
  for ((i=0;i<150;i++));do
    kill -0 "$pid" || return 1
    if curl -fsS --max-time 1 "$url" >/dev/null 2>&1;then return;fi
    sleep .2
  done
  return 1
}
# Initialize only genesis in this fresh directory. Import with normal Geth consensus checks.
common=(--datadir "$base/chain" --state.scheme hash --gcmode archive --cache 64)
net=(--nodiscover --maxpeers 0 --port 0 --ipcdisable --authrpc.port 0 --http --http.addr 127.0.0.1 --http.port 34899 --http.api eth)
if curl -s --max-time 1 http://127.0.0.1:34899 >/dev/null 2>&1;then echo 'Use a free port 34899 or an isolated network namespace.' >&2;exit 1;fi
"$geth" --dev "${common[@]}" "${net[@]}" >"$base/init.log" 2>&1 &
pid=$!;children+=("$pid")
ready http://127.0.0.1:34899 "$pid"
kill -INT "$pid"; wait "$pid";children=()
"$geth" "${common[@]}" import "$history" >"$base/import.log" 2>&1
"$geth" "${common[@]}" "${net[@]}" >"$base/geth.log" 2>&1 &
pid=$!;children+=("$pid");ready http://127.0.0.1:34899 "$pid"
bash "$here/operator.sh" http://127.0.0.1:34899 "$deployment" >"$base/portal.log" 2>&1 &
pid=$!;children+=("$pid");ready http://127.0.0.1:34735/website.html "$pid"
node "$here/verify-export.mjs" "$snapshot"
