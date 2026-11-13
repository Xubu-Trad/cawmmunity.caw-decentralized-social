import unittest
from receipt_poll import INDEXING_ERROR,ReceiptIndexingPending,rpc_result,wait_for_receipt

TX='0x'+'11'*32
GOOD={'transactionHash':TX,'status':'0x1'}
def result(value):return {'jsonrpc':'2.0','id':1,'result':value}
def error(value=INDEXING_ERROR):return {'jsonrpc':'2.0','id':1,'error':dict(value)}


class ReceiptPollTests(unittest.TestCase):
    def test_exact_indexing_error_is_receipt_only(self):
        with self.assertRaises(ReceiptIndexingPending):rpc_result('eth_getTransactionReceipt',error())
        for method in ['eth_sendRawTransaction','eth_getBlockByNumber','eth_chainId']:
            with self.subTest(method=method),self.assertRaisesRegex(RuntimeError,'RPC_ERROR'):
                rpc_result(method,error())

    def test_changed_indexing_error_fails(self):
        for changed in [{**INDEXING_ERROR,'code':-32001},{**INDEXING_ERROR,'code':-32000.0},{**INDEXING_ERROR,'message':'other'},
                        {k:v for k,v in INDEXING_ERROR.items()if k!='data'},
                        {**INDEXING_ERROR,'data':'other'},{**INDEXING_ERROR,'extra':True}]:
            with self.subTest(error=changed),self.assertRaisesRegex(RuntimeError,'RPC_ERROR'):
                rpc_result('eth_getTransactionReceipt',error(changed))

    def test_null_result_stays_distinct(self):
        self.assertIsNone(rpc_result('eth_getTransactionReceipt',result(None)))

    def test_bad_envelopes_fail(self):
        for envelope in [None,{}, {'jsonrpc':'2.0','id':True,'result':None},
                         {'jsonrpc':'2.0','id':2,'result':None},
                         {'jsonrpc':'1.0','id':1,'result':None},
                         {'jsonrpc':'2.0','id':1}, {**error(),'result':None}]:
            with self.subTest(response=envelope),self.assertRaises(RuntimeError):
                rpc_result('eth_getTransactionReceipt',envelope)

    def test_indexing_then_null_then_matching_receipt(self):
        answers=iter([error(),result(None),result(GOOD)]);trace=[];sleeps=[]
        def call(method,params):
            self.assertEqual(params,[TX]);return rpc_result(method,next(answers))
        self.assertEqual(wait_for_receipt(call,TX,trace,sleep=sleeps.append),GOOD)
        self.assertEqual([x['outcome']for x in trace],['indexing_pending','not_mined','mined'])
        self.assertEqual([x['attempt']for x in trace],[1,2,3])
        self.assertEqual(sleeps,[.1,.1])

    def test_exact_indexing_retries_are_bounded(self):
        trace=[];sleeps=[]
        def call(method,params):return rpc_result(method,error())
        with self.assertRaisesRegex(RuntimeError,'RECEIPT_TIMEOUT'):
            wait_for_receipt(call,TX,trace,sleep=sleeps.append)
        self.assertEqual(len(trace),100);self.assertEqual(len(sleeps),99)
        self.assertEqual({x['outcome']for x in trace},{'indexing_pending'})

    def test_null_retries_are_bounded(self):
        trace=[]
        with self.assertRaisesRegex(RuntimeError,'RECEIPT_TIMEOUT'):
            wait_for_receipt(lambda *_:None,TX,trace,attempts=3,sleep=lambda _:None)
        self.assertEqual(len(trace),3);self.assertEqual({x['outcome']for x in trace},{'not_mined'})

    def test_other_error_stops_immediately(self):
        trace=[]
        def call(method,params):return rpc_result(method,error({'code':-32000,'message':'other'}))
        with self.assertRaisesRegex(RuntimeError,'RPC_ERROR'):
            wait_for_receipt(call,TX,trace,sleep=lambda _:self.fail('must not retry'))
        self.assertEqual([x['outcome']for x in trace],['error'])

    def test_wrong_hash_revert_and_malformed_receipts_fail(self):
        for receipt in [{**GOOD,'transactionHash':'0x'+'22'*32},{**GOOD,'status':'0x0'},
                        {**GOOD,'status':1}, {}, False, '0x1']:
            trace=[]
            with self.subTest(receipt=receipt),self.assertRaisesRegex(RuntimeError,'RECEIPT_HASH_OR_STATUS'):
                wait_for_receipt(lambda *_:receipt,TX,trace,sleep=lambda _:self.fail('must not retry'))
            self.assertEqual([x['outcome']for x in trace],['rejected_receipt'])

    def test_attempt_limit_cannot_be_widened(self):
        for attempts in [0,101,True,1.0]:
            with self.subTest(attempts=attempts),self.assertRaisesRegex(ValueError,'RECEIPT_ATTEMPT_LIMIT'):
                wait_for_receipt(lambda *_:self.fail('must not query'),TX,[],attempts=attempts)


if __name__=='__main__':unittest.main()
