#!/usr/bin/env python3
"""Verify the native browser harness's startup error report at its normal entry point."""
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time


def controlled_browser(profile):
    mode = os.environ["TEST_CDP_CONNECTION"]

    class Discovery(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            if self.path == "/json/list":
                port = self.server.server_address[1]
                body = json.dumps([{"type":"page","webSocketDebuggerUrl":
                                    f"ws://127.0.0.1:{port}/devtools/page/test"}]).encode()
                self.send_response(200)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif mode == "404":
                self.send_error(404)
            elif mode == "close":
                self.close_connection = True
            elif mode == "timeout":
                time.sleep(20)

    with HTTPServer(("127.0.0.1", 0), Discovery) as server:
        profile.mkdir(exist_ok=True)
        (profile/"DevToolsActivePort").write_text(str(server.server_address[1])+"\n")
        server.serve_forever()


def run():
    here = Path(__file__).resolve().parent
    fixture = here.parents[1]/"evidence/console-withdrawal-20261116"
    with tempfile.TemporaryDirectory() as directory:
        work = Path(directory)
        driver = work/"test-browser"
        shutil.copyfile(__file__, driver)
        driver.chmod(0o700)
        for mode in ("404","close","timeout"):
            out = work/mode
            env = dict(os.environ, CHROME_BIN=str(driver), TEST_CDP_CONNECTION=mode)
            result = subprocess.run(["node","--experimental-websocket",here/"test-receipt-history-browser.mjs",
                                     fixture,out], env=env, capture_output=True, timeout=12)
            assert result.returncode == 1, (mode,result.returncode,result.stderr[-400:])
            report = json.loads((out/"result.json").read_text())
            assert (report["status"],report["stage"],report["completed"],report["checks"]) == (
                "NOT_RUN","CDP WebSocket connection",0,[])
            assert "CDP WebSocket" in report["error"] and "browserLog" in report
            if mode == "timeout":
                assert "timed out" in report["error"]
            print(mode, result.returncode, report["status"], report["stage"], report["error"])


if __name__ == "__main__":
    profile = next((arg.split("=",1)[1] for arg in sys.argv[1:] if arg.startswith("--user-data-dir=")), None)
    if profile:
        controlled_browser(Path(profile))
    else:
        run()
