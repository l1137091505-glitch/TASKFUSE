import { BrowserProvider, Contract, JsonRpcProvider, formatEther, keccak256, parseEther, toUtf8Bytes, type JsonRpcSigner } from "ethers";

export const BOT_CHAIN = {
  chainId: 677, chainIdHex: "0x2a5", name: "BOT Chain Mainnet",
  rpcUrl: "https://rpc.botchain.ai", explorer: "https://scan.botchain.ai",
  currency: { name: "BOT", symbol: "BOT", decimals: 18 },
};

export const CONTRACT_ADDRESS = (import.meta.env.VITE_TASKFUSE_ADDRESS ?? "").trim();
export const FUSE_ABI = [
  "function bountyCount() view returns (uint256)",
  "function getBounty(uint256) view returns ((address poster,address winner,uint128 reward,uint64 createdAt,uint64 deadline,uint16 submissionCount,uint8 status,bytes32 taskHash,string title))",
  "function getSubmissions(uint256) view returns ((address contributor,uint64 submittedAt,bytes32 proofHash,string note)[])",
  "function openBounty(string title,bytes32 taskHash,uint64 duration) payable returns (uint256)",
  "function submit(uint256 bountyId,string note,bytes32 proofHash)",
  "function award(uint256 bountyId,uint256 submissionId)",
  "function reclaim(uint256 bountyId)",
] as const;

export type Submission = { contributor: string; submittedAt: number; proofHash: string; note: string };
export type Bounty = {
  id: number; poster: string; winner: string; reward: bigint; createdAt: number; deadline: number;
  submissionCount: number; status: number; taskHash: string; title: string; category?: string;
  summary?: string; demo?: boolean; submissions?: Submission[];
};

const now = Math.floor(Date.now() / 1000);
export const DEMO_BOUNTIES: Bounty[] = [
  { id: 18, poster: "0x68A89C6D80154E4f5F0d8737c467601Ac3521a62", winner: "0x0000000000000000000000000000000000000000", reward: parseEther("8"), createdAt: now - 7200, deadline: now + 252000, submissionCount: 3, status: 1, taskHash: "0x9bb3f9874c48933a028af8858215784d127f2ce2deed56d40433abb75f49a2a1", title: "Map the validator onboarding journey", category: "Research", summary: "Turn a confusing operator flow into a concise visual map.", demo: true, submissions: [
    { contributor: "0x8F7b5724e46dbE31578c85a5E5c9a2387b951aE4", submittedAt: now - 3000, proofHash: "0x68a2500ffbfa54b9a8372e84580e643fb9498889f70929cab9d3379cfcdaebfe", note: "Journey map, friction log, and proposed copy are ready for review." },
    { contributor: "0x3aD4B10D382Ec83C1d85e6A3bE7eA9549B75E009", submittedAt: now - 1800, proofHash: "0x0ad8ae8920e13e914946130746fab180bc574bab01738968305048870d03de07", note: "Submitted an alternate mobile-first onboarding sequence." },
  ] },
  { id: 17, poster: "0x105A684E3eAC4E274cFEb19b7A317ba9CF8C7001", winner: "0x0000000000000000000000000000000000000000", reward: parseEther("4.5"), createdAt: now - 18000, deadline: now + 68400, submissionCount: 1, status: 1, taskHash: "0x7203234df39bb540a1c667dfd07e822fe2fd69ec28f99cc9213c2b0930e0a0d1", title: "Write the incident response quickstart", category: "Writing", summary: "Create a one-page playbook for the first 30 minutes of an incident.", demo: true, submissions: [] },
  { id: 16, poster: "0x5e60289932eD65B777d95dBa88b4E554D607B8a2", winner: "0x2B247E99281F31f88f80d42cd002955CEb22F124", reward: 0n, createdAt: now - 250000, deadline: now - 10000, submissionCount: 5, status: 2, taskHash: "0xf55e9b795a1524ed09ebeaee2ea0b9c332f70ab54c9a552f93ff6090feec5144", title: "Design three explorer empty states", category: "Design", summary: "Friendly UI states for missing blocks, transactions, and accounts.", demo: true, submissions: [] },
  { id: 15, poster: "0x91B1aC2A546660182044cD7290aF8837351ACc20", winner: "0x0000000000000000000000000000000000000000", reward: parseEther("12"), createdAt: now - 3600, deadline: now + 604800, submissionCount: 0, status: 1, taskHash: "0xdfd5d4ea36ce189d64b1227daf5eaa9efc625bb42de966bef955830240242433", title: "Build a network health widget", category: "Development", summary: "A compact component showing RPC latency and chain freshness.", demo: true, submissions: [] },
];

export const readProvider = new JsonRpcProvider(BOT_CHAIN.rpcUrl);
export async function connectWallet(): Promise<{ provider: BrowserProvider; signer: JsonRpcSigner; address: string }> {
  const ethereum = (window as Window & { ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown> } }).ethereum;
  if (!ethereum) throw new Error("No EVM wallet detected. Install or open a browser wallet first.");
  try { await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BOT_CHAIN.chainIdHex }] }); }
  catch (error) {
    const code = error && typeof error === "object" && "code" in error ? Number((error as { code: unknown }).code) : 0;
    if (code !== 4902) throw error;
    await ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: BOT_CHAIN.chainIdHex, chainName: BOT_CHAIN.name, nativeCurrency: BOT_CHAIN.currency, rpcUrls: [BOT_CHAIN.rpcUrl], blockExplorerUrls: [BOT_CHAIN.explorer] }] });
  }
  const provider = new BrowserProvider(ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  return { provider, signer, address: await signer.getAddress() };
}

export function readContract() { return CONTRACT_ADDRESS ? new Contract(CONTRACT_ADDRESS, FUSE_ABI, readProvider) : null; }
export function writeContract(signer: JsonRpcSigner) { return new Contract(CONTRACT_ADDRESS, FUSE_ABI, signer); }
export function digest(value: string) { return keccak256(toUtf8Bytes(value.trim().replace(/\r\n/g, "\n"))); }
export function bot(value: bigint) { return Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 4 }); }
export function short(value: string) { return `${value.slice(0, 6)}…${value.slice(-4)}`; }
export function statusLabel(status: number, deadline: number) { if (status === 2) return "AWARDED"; if (status === 3) return "RECLAIMED"; if (Date.now() / 1000 >= deadline) return "EXPIRED"; return "OPEN"; }
export function timeLeft(deadline: number) { const seconds = deadline - Date.now() / 1000; if (seconds <= 0) return "deadline passed"; const days = Math.floor(seconds / 86400); if (days) return `${days}d left`; const hours = Math.floor(seconds / 3600); return hours ? `${hours}h left` : `${Math.max(1, Math.floor(seconds / 60))}m left`; }
export { parseEther };

