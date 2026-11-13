#!/usr/bin/env python3
"""Additional recorded-receipt consistency, not live-chain authentication."""
import json,sys
from pathlib import Path

def check(packet):
    lanes=Path(packet)/"lanes"
    read=lambda name:json.loads((lanes/name/"results.json").read_bytes())
    prior=read("COMMUNITY_C007_PAIRED_POST_20261107_V1")
    run=read("COMMUNITY_C007_PAIRED_WITHDRAWAL_20261107_V2")
    assert len(prior["transactions"])==prior["local_transactions"]==15
    assert len(run["transactions"])==run["local_transactions"]==17
    for old,new,label in [(-3,-5,"control_signed_post"),
                          (-2,-3,"treatment_nft2_transfer"),
                          (-1,-2,"treatment_signed_post")]:
        a,b=prior["transactions"][old],run["transactions"][new]
        assert a["label"]==b["label"]==label
        assert a["request"]==b["request"]
        x,y=a["receipt"],b["receipt"]
        assert x["status"]==y["status"]=="0x1"
        for key in ["from","to","gasUsed","blockNumber"]:
            assert x[key]==y[key]
        assert len(x["logs"])==len(y["logs"])
        for u,v in zip(x["logs"],y["logs"]):
            for key in ["address","topics","data"]:
                assert u[key]==v[key]
    for branch in ["control","treatment"]:
        a=prior["paired_comparison"][branch]
        b=run["paired_comparison"][branch]
        for key,value in a.items():
            assert b[key]==value
    return True

if __name__=="__main__":
    assert len(sys.argv)==2
    assert check(sys.argv[1])
    print("CROSS_RUN_RECEIPT_CONSISTENCY=PASS")
    print("CONTROL_AFTER_STATE_SNAPSHOT=NOT_RETAINED")
