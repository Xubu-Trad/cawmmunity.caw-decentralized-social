# PR16 receipt response envelope review

FACT — At `aba275b8239289ed63de331961207c6a13f47f41`, the genuine pair passes. Replacing only `deposit_2.receipt0`'s successful null response with a JSON-RPC error (and updating its raw response consistently) also returns exit 0. No original evidence was changed. The comparator uses `.get("result") is None`, conflating missing results and successful null results.

INFERENCE — Its bounded allowance for pending receipt polls does not distinguish a service failure from a successful pending response. This is an evidence-comparison gap, not proof of a contract fault, invalid historical execution or fabricated reproduction.

IDEA — The attached proposed patch requires receipt response envelopes to contain `result` and no `error` before comparison can pass. It preserves legitimate null polling. If future runs intentionally tolerate transport errors, they need an explicit separately reported policy, rather than silently classifying them as successful null polls.

Validation: all existing 19 regression cases pass with the proposed patch. Four additional cases pass their expectations: genuine pair accepted; error without result, error plus null result, and absent result rejected. No EVM, RPC, new independent host or persistence experiment was run. The patch is proposed, not applied to WD-27's branch or accepted as merged.

To reproduce, obtain PR16 at the exact commit above, then run:

```text
python3 evidence/pr16-receipt-envelope-20261112/test-pr16-receipt-envelope.py PATH_TO_PINNED_REPRODUCTION_DIRECTORY NEW_OUTPUT_DIRECTORY
```

The script creates a temporary patched comparator, uses the pinned traces without altering them, and emits the patch and regression report. It requires Python 3.10+ and permission to create temporary symlinks. It does not acquire or execute blockchain clients.

The earlier label, RPC identity, capture-hash and receipt comparison corrections remain acknowledged. Independent persistence recovery remains pending on another operator's environment; this review does not extend the same-host recovery claim.
