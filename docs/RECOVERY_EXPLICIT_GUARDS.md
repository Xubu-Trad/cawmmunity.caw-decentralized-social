# Recovery checks under optimized Python

FACT — The prior recovery wrapper used Python assertions for service cleanup, interruption window, restart isolation, recovered history, proof acceptance and scope. Python optimization can disable those assertions. A mock cleanup failure is accepted by the original wrapper under `python -O`, with a success summary written.

The wrapper now uses explicit conditional failures for those same six checks. No acceptance requirement is relaxed. Fourteen mock process-boundary cases pass: a valid fixture and six rejected conditions, each with ordinary and optimized Python. Rejected cases must not write a reproduction summary. The fixtures do not launch clients or constitute an actual recovery run.

Run `python3 integration/peer-sync/test-explicit-guards.py integration/peer-sync/reproduce-persistence.py` on Linux with Python 3.10+. The test uses temporary mock driver and node executables and preserves original research evidence.

The existing download procedure is deliberately pinned to the previous experiment revision. This change does not silently rewrite its manifest or invalidate its recorded ordinary-Python results. Before another independent run, refresh and verify the acquisition manifest to include this corrected wrapper. Until that update is published, do not use optimized Python or a PYTHONOPTIMIZE environment setting with the old pinned procedure. Other verifier scripts also require an optimization-boundary review before a general optimized-runtime compatibility claim.

Independent operator recovery and authenticated public-chain finality remain unproven. This is a runner portability correction, not a new client recovery result.
