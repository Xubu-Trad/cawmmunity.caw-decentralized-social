// Research evaluation for reviewed source only. node:vm is NOT a sandbox.
import vm from 'node:vm';
import {createHash} from 'node:crypto';

function reject(code = 'CAPTURED_GRAPH_REJECTED') {
  throw Object.assign(new Error(code), {code});
}

export function requireResearchRuntime() {
  if (process.version !== 'v24.22.1' ||
      typeof vm.SourceTextModule !== 'function' ||
      typeof vm.SyntheticModule !== 'function') reject('CAPTURED_RUNTIME_UNSUPPORTED');
}

// This lower-level entrypoint deliberately has no source-authority admission.
// Exported for authored linker controls; use captureFixture for pinned inputs.
export async function executeReviewedGraph(sources, edges, entry, exportName, args) {
  requireResearchRuntime();
  try {
    if (!(sources instanceof Map) || sources.size < 1 || sources.size > 5 ||
        !sources.has(entry) || !Array.isArray(args) ||
        typeof exportName !== 'string' ||
        JSON.stringify([...sources.keys()].sort()) !== JSON.stringify(Object.keys(edges).sort())) reject();
    let total = 0;
    const context = vm.createContext({Buffer}, {codeGeneration:{strings:false, wasm:false}});
    const modules = new Map();
    const crypto = new vm.SyntheticModule(['createHash'], function () {
      this.setExport('createHash', algorithm => {
        if (algorithm !== 'sha256') reject();
        return createHash('sha256');
      });
    }, {context, identifier:'HOST:createHash'});
    for (const [id, source] of sources) {
      if (typeof source !== 'string' || !source.length || Buffer.byteLength(source) > 65536) reject();
      total += Buffer.byteLength(source);
      if (total > 327680) reject();
      const module = new vm.SourceTextModule(source, {
        context, identifier:id,
        importModuleDynamically() { reject('CAPTURED_DYNAMIC_IMPORT_REJECTED'); },
      });
      const requested = [...new Set(module.dependencySpecifiers)].sort();
      if (JSON.stringify(requested) !== JSON.stringify(Object.keys(edges[id]).sort())) reject();
      modules.set(id, module);
    }
    const root = modules.get(entry);
    await root.link((specifier, referrer, extra) => {
      if (Object.keys(extra.attributes ?? {}).length ||
          !Object.hasOwn(edges[referrer.identifier], specifier)) reject();
      const target = edges[referrer.identifier][specifier];
      if (target === 'HOST:createHash' && specifier === 'node:crypto') return crypto;
      if (!modules.has(target)) reject();
      return modules.get(target);
    });
    await root.evaluate({timeout:1000});
    if (typeof root.namespace[exportName] !== 'function') reject();
    context.__entry = root.namespace[exportName];
    context.__args = args;
    // Bounds synchronous invocation as well as top-level evaluation. Async hangs
    // still require the external process deadline; this is not hostile-code isolation.
    new vm.Script('__result = __entry(...__args)').runInContext(context, {timeout:1000});
    return structuredClone(await context.__result);
  } catch (error) {
    if (error?.code === 'CAPTURED_DYNAMIC_IMPORT_REJECTED') throw error;
    reject();
  }
}
