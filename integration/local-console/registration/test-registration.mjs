import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import solc from 'solc';
import {ContractFactory, JsonRpcProvider, id} from 'ethers';
import {createLocalRpc} from '../local-rpc.mjs';

const endpoint = process.argv[2];
const rpc = createLocalRpc(endpoint);
assert.equal(await rpc('eth_chainId', []), '0x539');
const provider = new JsonRpcProvider(endpoint);
provider.pollingInterval = 100;
const signer = await provider.getSigner();
const payer = await signer.getAddress();
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const main = 'registration/UsernameRegistration.sol';
const mock = `pragma solidity 0.8.30;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract Fixture is ERC20 {
    constructor() ERC20("Fixture","FIX") { _mint(msg.sender, 1e32); }
}`;
const build = JSON.parse(solc.compile(JSON.stringify({language:'Solidity',
    sources:{[main]:{content:read('UsernameRegistration.sol')},'Fixture.sol':{content:mock}},
    settings:{evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}
}), {import: key => ({contents:read(key === 'UsernameTerms.sol' ? '../UsernameTerms.sol' : 'node_modules/'+key)})}));
assert.deepEqual((build.errors || []).filter(e => e.severity === 'error'), []);
async function deploy(file, name, ...args) {
    const artifact = build.contracts[file][name];
    const contract = await new ContractFactory(artifact.abi, artifact.evm.bytecode.object, signer).deploy(...args);
    return contract.waitForDeployment();
}
const token = await deploy('Fixture.sol','Fixture');
const names = await deploy(main,'UsernameRegistration', await token.getAddress());
const sink = await names.SINK();
const price = 1000000n * 10n**18n;
const supply = await token.totalSupply();
const name = 'hunter01';
const tokenId = BigInt(id(name));
await assert.rejects(names.register.staticCall(name));
await (await token.approve(await names.getAddress(), price * 2n)).wait();
await assert.rejects(names.register.staticCall('Hunter01'));
await (await names.register(name)).wait();
assert.equal(await names.ownerOf(tokenId), payer);
assert.equal(await names.usernameOf(tokenId), name);
await assert.rejects(names.register.staticCall(name));
assert.equal(await token.balanceOf(sink), price);
assert.equal(await token.balanceOf(payer), supply-price);
assert.equal(await token.totalSupply(), supply);
assert.equal(await token.allowance(payer, await names.getAddress()), price);
const recipient = '0x0000000000000000000000000000000000001234';
await (await names.transferFrom(payer, recipient, tokenId)).wait();
assert.equal(await names.ownerOf(tokenId), recipient);
await assert.rejects(names.register.staticCall(name));
console.log('PASS: local registration, exact payment, unchanged supply, uniqueness, validation, allowance and NFT transfer');
await provider.destroy();
