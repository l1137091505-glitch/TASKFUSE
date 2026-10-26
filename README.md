# TASKFUSE

TASKFUSE is an on-chain job dispatch board: fund a mission, collect public
submissions, select one contributor for the full reward, or reclaim the reward
after the deadline.

## Included

- Original responsive React/Vite interface.
- Wallet connection with account and network change handling.
- Solidity escrow contract with no administrator withdrawal path.
- Browser-side task fingerprints.
- Preview data when no contract address is configured.
- Vercel SPA rewrites.

## Local development

```bash
cd frontend
npm install
npm run dev
```

## Production setup

Deploy `contracts/src/TaskFuse.sol`, then add the public contract address to
Vercel:

```text
VITE_TASKFUSE_ADDRESS=0xYourContractAddress
```

Set the Vercel Root Directory to `frontend` and redeploy.

## Safety boundary

The poster alone chooses a submission. Nothing forces a fair payout. A poster
can reclaim the reward after the deadline if it has not been awarded. This code
has not been professionally audited; test with small values first.

