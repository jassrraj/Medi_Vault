import { BrowserProvider, Contract, keccak256, toUtf8Bytes } from 'ethers';

const contractAddress = import.meta.env.VITE_EHR_CONTRACT_ADDRESS;
const abi = [
  'function registerRecord(string ipfsCid, bytes32 encryptedContentHash) returns (uint256)',
  'function grantAccess(uint256 recordId, address clinician)',
  'function revokeAccess(uint256 recordId, address clinician)',
];

export const connectWallet = async () => {
  if (!window.ethereum) throw new Error('Install MetaMask to connect a blockchain wallet');
  const provider = new BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts', []);
  return (await provider.getSigner()).getAddress();
};

export const registerRecordOnChain = async (ipfsCid, recordHash) => {
  if (!contractAddress) throw new Error('VITE_EHR_CONTRACT_ADDRESS is not configured');
  if (!window.ethereum) throw new Error('Install MetaMask to register the record on-chain');
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new Contract(contractAddress, abi, signer);
  const hash = recordHash?.startsWith('0x') ? recordHash : keccak256(toUtf8Bytes(recordHash));
  const transaction = await contract.registerRecord(ipfsCid, hash);
  const receipt = await transaction.wait();
  const registeredEvent = receipt.logs
    .map((log) => {
      try { return contract.interface.parseLog(log); } catch { return null; }
    })
    .find((event) => event?.name === 'RecordRegistered');
  if (!registeredEvent) throw new Error('Blockchain registration completed without a record ID');
  return { transactionHash: transaction.hash, blockchainRecordId: Number(registeredEvent.args.recordId) };
};

export const grantRecordAccess = async (recordId, clinicianAddress) => {
  if (!contractAddress) throw new Error('VITE_EHR_CONTRACT_ADDRESS is not configured');
  if (!window.ethereum) throw new Error('Install MetaMask to update record permissions');
  if (!recordId || !clinicianAddress) throw new Error('Record ID and clinician wallet address are required');
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new Contract(contractAddress, abi, signer);
  const transaction = await contract.grantAccess(Number(recordId), clinicianAddress);
  await transaction.wait();
  return transaction.hash;
};

export const revokeRecordAccess = async (recordId, clinicianAddress) => {
  if (!contractAddress) throw new Error('VITE_EHR_CONTRACT_ADDRESS is not configured');
  if (!window.ethereum) throw new Error('Install MetaMask to update record permissions');
  if (!recordId || !clinicianAddress) throw new Error('Record ID and clinician wallet address are required');
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new Contract(contractAddress, abi, signer);
  const transaction = await contract.revokeAccess(Number(recordId), clinicianAddress);
  await transaction.wait();
  return transaction.hash;
};
