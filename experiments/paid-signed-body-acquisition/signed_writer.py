"""Sign only the two published local test identities; never import wallet data.

The unchanged paid-action writer supplies calldata and accounting assertions.
This adapter replaces its top-level submission only. The former synthetic
deployer/relayer role uses test signer A for both simulation and submission.
ECDSA is checked against that fixed public key before the owned local node's
precompile selects recovery parity. That precompile is not an independent
endpoint, generic offline sender verifier, or proof of public-chain execution.
"""
import re
import time
import cryptography
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, utils

CRYPTOGRAPHY_VERSION = cryptography.__version__


def make_writer(base, codec):
    class SignedWriter(base.Run):
        def __init__(self, node, k, build):
            super().__init__(node, k, build)
            base.need(set(base.TEST_KEYS) == {1, 2}, 'TEST_IDENTITIES')
            self.signers = {}
            for owner, address in ((1, base.A), (2, base.B)):
                key = ec.derive_private_key(base.TEST_KEYS[owner], ec.SECP256K1())
                public = key.public_key().public_numbers()
                derived = '0x' + self.k(base.word(public.x) + base.word(public.y))[-20:].hex()
                base.need(derived == address, 'TEST_PUBLIC_KEY')
                self.signers[address] = key
            self.signed_submissions = []
            self.spent = {}

        def send(self, label, caller, to, data, success=True, error=None, returned='0x'):
            sender = base.A if caller == base.D else caller
            base.need(sender in self.signers, 'LOCAL_TEST_SIGNER_ONLY')
            tx = self.tx(sender, to, data)
            dry = self.n.rpc_raw(label + '.dry', 'eth_call', [tx, 'latest'])
            base.need(('result' in dry) == success, 'DRY_STATUS:' + label)
            if success and returned is not None:
                base.need(dry['result'] == returned, 'DRY_RETURN:' + label)
            if not success and error:
                base.need(dry['error'].get('data') == self.data(error), 'DRY_REVERT:' + label)
            nonce_hex = self.n.rpc(label + '.nonce', 'eth_getTransactionCount', [sender, 'latest'])
            base.need(type(nonce_hex) is str and re.fullmatch(r'0x(?:0|[1-9a-f][0-9a-f]{0,15})', nonce_hex), 'TX_NONCE')
            nonce = int(nonce_hex, 16)
            payload = codec.signing_payload(nonce, codec.GAS_PRICE, codec.MAX_GAS, to, 0, data)
            digest = self.k(payload)
            key = self.signers[sender]
            der = key.sign(digest, ec.ECDSA(utils.Prehashed(hashes.SHA256())))
            r, s = utils.decode_dss_signature(der)
            s = min(s, codec.SECP256K1_N - s)
            key.public_key().verify(utils.encode_dss_signature(r, s), digest,
                                    ec.ECDSA(utils.Prehashed(hashes.SHA256())))
            parity = None
            for candidate in (0, 1):
                recovery_data = '0x' + (digest + base.word(27 + candidate) + base.word(r) + base.word(s)).hex()
                recovered = self.n.rpc(label + '.tx_recover' + str(candidate), 'eth_call',
                    [self.tx(base.D, '0x' + '00' * 19 + '01', recovery_data), 'latest'])
                if recovered == '0x' + base.word(sender).hex():
                    base.need(parity is None, 'AMBIGUOUS_RECOVERY')
                    parity = candidate
            base.need(parity is not None, 'TX_RECOVERY')
            envelope = codec.encode_signed(nonce, to, data, r, s, parity)
            base.need(envelope['signing_hash'] == '0x' + digest.hex(), 'TX_SIGNING_DIGEST')
            transaction_hash = self.n.submit_signed(label + '.send', envelope['raw'])
            base.need(transaction_hash == envelope['hash'], 'SUBMITTED_RAW_HASH')
            receipt = None
            for index in range(10):
                response = self.n.rpc_raw(label + '.receipt' + str(index), 'eth_getTransactionReceipt', [transaction_hash])
                if response.get('result') is not None:
                    receipt = response['result']
                    break
                base.need('error' not in response, 'RECEIPT_ERROR')
                time.sleep(.05)
            base.need(receipt and receipt['transactionHash'] == transaction_hash
                      and receipt['status'] == ('0x1' if success else '0x0'), 'RECEIPT_STATUS:' + label)
            base.need(receipt.get('from') == sender and receipt.get('to') == to, 'RECEIPT_SENDER_METADATA')
            gas_hex = receipt.get('gasUsed')
            base.need(type(gas_hex) is str and re.fullmatch(r'0x[1-9a-f][0-9a-f]{0,5}', gas_hex), 'RECEIPT_GAS')
            gas_used = int(gas_hex, 16)
            base.need(gas_used <= codec.MAX_GAS and (success or receipt['logs'] == []), 'RECEIPT_EFFECTS')
            row = {'label': label, 'transaction': tx, 'dry_response': dry, 'receipt': receipt}
            self.rows.append(row)
            self.signed_submissions.append({'label': label, 'test_sender': sender,
                'raw': envelope['raw'], 'hash': transaction_hash, 'signing_hash': envelope['signing_hash'],
                'nonce': hex(nonce), 'chain_id': codec.CHAIN_ID,
                'block_hash': receipt['blockHash'], 'block_number': receipt['blockNumber'],
                'known_test_public_key_signature_checked': True,
                'local_precompile_parity_checked': True, 'generic_sender_verifier': False})
            self.spent[sender] = self.spent.get(sender, 0) + gas_used
            if self.spent[sender] >= 2000000:
                self.n.rpc(label + '.gas_refill', 'anvil_setBalance', [sender, '0xde0b6b3a7640000'])
                self.spent[sender] = 0
            return row

        def retire(self):
            self.rows.clear()
            self.intents.clear()
            self.deployments.clear()
            self.signers.clear()

    return SignedWriter
