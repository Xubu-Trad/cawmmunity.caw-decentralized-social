"""Bounded receipt availability handling for the disposable local launcher."""
import time


class ReceiptIndexingPending(RuntimeError):
    pass


INDEXING_ERROR = {
    'code': -32000,
    'message': 'transaction indexing is in progress',
    'data': 'transaction indexing is in progress',
}


def rpc_result(method, response):
    if not isinstance(response, dict) or response.get('jsonrpc') != '2.0' or type(response.get('id')) is not int or response['id'] != 1:
        raise RuntimeError('RPC_ENVELOPE')
    if 'error' in response:
        error = response['error']
        if method == 'eth_getTransactionReceipt' and 'result' not in response and isinstance(error,dict) and type(error.get('code')) is int and error == INDEXING_ERROR:
            raise ReceiptIndexingPending('RECEIPT_INDEXING_PENDING')
        raise RuntimeError('RPC_ERROR: ' + repr(response['error']))
    if 'result' not in response:
        raise RuntimeError('RPC_RESULT_MISSING')
    return response['result']


def wait_for_receipt(call, tx_hash, observations, *, attempts=100, sleep=time.sleep):
    if type(attempts) is not int or not 1 <= attempts <= 100:
        raise ValueError('RECEIPT_ATTEMPT_LIMIT')
    for attempt in range(1, attempts + 1):
        entry = {'transactionHash': tx_hash, 'attempt': attempt}
        try:
            receipt = call('eth_getTransactionReceipt', [tx_hash])
        except ReceiptIndexingPending:
            entry['outcome'] = 'indexing_pending'
        except Exception:
            entry['outcome'] = 'error'
            observations.append(entry)
            raise
        else:
            if receipt is None:
                entry['outcome'] = 'not_mined'
            elif not isinstance(receipt, dict) or receipt.get('transactionHash') != tx_hash or receipt.get('status') != '0x1':
                entry['outcome'] = 'rejected_receipt'
                observations.append(entry)
                raise RuntimeError('RECEIPT_HASH_OR_STATUS')
            else:
                entry['outcome'] = 'mined'
                observations.append(entry)
                return receipt
        observations.append(entry)
        if attempt < attempts:
            sleep(.1)
    raise RuntimeError('RECEIPT_TIMEOUT')
