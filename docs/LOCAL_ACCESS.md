# Access the local build

The local alpha and experimental protocol are separate surfaces. The website is a simulation. The protocol command executes retained signed local fixtures through the selected witness-backed executor. It does not start a deployed CAW network, connect a wallet, or accept real funds.

## Alpha website

Use Node.js 24.20.0. From the repository root:

```text
npm start
```

Visit http://127.0.0.1:4173/website.html for the entrance or http://127.0.0.1:4173/ for Commons. The server binds to loopback only. Stop it with Ctrl+C. No package installation is needed for this frontend.

## Protocol checks

The execution experiment requires its separate pinned dependency installation. With Node 24.20.0 and pnpm 11.25.0 available, from a fresh repository root:

```text
cd experiments/execution-engine
pnpm install --frozen-lockfile --ignore-scripts
cd ../..
npm run protocol:check
```

Review the source and lockfile before installing. The install command is for a fresh checkout; this access check reused the already installed pinned dependencies and performed no new download. Do not substitute a newer lockfile/runtime to make a failure disappear.

The command runs the [13 selected-executor groups](SELECTED_EXECUTOR.md), including signed transfer/storage/revert/refund outcomes and refusal cases. A zero exit is scoped to those fixtures; production flags remain false. For one retained transaction per fresh process with explicit source digests and output file, follow [fresh-process execution](EXECUTOR_PROCESS.md). The website does not invoke this engine.

## Current local observation

The selected-executor command succeeded from the local repository tree using the existing isolated dependency installation, joined locally through a dependency-directory junction. All 13 groups passed again. The alpha entrance responded HTTP 200 on loopback and contained the expected project name. These observations prove local accessibility at that time, not browser interaction coverage, independent installation/reproduction, public deployment or continuous availability.

The Windows convenience launchers retain the existing 768 MiB available-memory startup floor, 2 GiB disk floor, pinned runtime and hard process limits. Its alpha preview expires after ten minutes and can be restarted. Generic commands above do not themselves implement that external supervisor; preserve applicable resource controls in your environment. A missing runtime, dependency directory or failed guard must be reported rather than bypassed.

Next engineering work remains strict result validation against retained input/source selections, then the unresolved loaded-code, state-root and independent recovery boundaries. Local accessibility does not close those gates.
