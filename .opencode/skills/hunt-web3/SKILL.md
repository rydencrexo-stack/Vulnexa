---
name: hunt-web3
description: Hunt smart contract and web3 vulnerabilities — Solidity bugs (reentrancy, access control, integer overflow, oracle manipulation, flash loan attacks, signature replay, front-running, governance/timelock, cross-chain bridges), DeFi protocol flaws, and web3 app bugs (private keys, wallet drainers, phishing via dApp clones). Use when auditing Solidity codebases, testing DeFi protocols, or hunting on Immunefi/Code4rena/Sherlock programs. Trigger keywords: web3, smart contract, Solidity, DeFi, reentrancy, oracle, flash loan, Immunefi, audit, EVM, cross-chain, token.
---

# Web3 / Smart Contract Hunting

Bounty platforms: Immunefi, Code4rena, Sherlock, HackerOne web3 programs. Knowledge base: [Solodit](https://solodit.cyfrin.io) — 50K+ searchable audit findings — and the [Cyfrin Solodit Audit Checklist](https://github.com/Cyfrin/audit-checklist) (370 checks, 13 categories).

## Smart Contract Vulnerability Checklist (top classes)

### 1. Reentrancy
- External calls before state updates (checks-effects-interactions violated)
- Cross-function reentrancy
- Read-only reentrancy (view function reads inconsistent state)
- ERC777 / callbacks-based reentrancy
- Guard: nonReentrant modifiers missing on key functions
- Test: `msg.sender.call{value: ...}` patterns, receive/fallback loops

### 2. Access Control
- Missing `onlyOwner` / `onlyRole` on admin functions
- Initialization functions callable by anyone (`initialize()` not protected)
- `tx.origin` used for authorization
- Proxy upgrade functions unprotected
- Griefing: functions anyone can call that damage users

### 3. Integer Overflow / Underflow (pre-0.8 without SafeMath)
- `balance += amount`, `balance -= amount` unchecked
- Token amounts, share calculations, fee calculations
- Zero/max/dust/first-deposit boundary behavior

### 4. Oracle Manipulation
- AMM spot price as oracle (manipulable via flash loans)
- Stale price data accepted
- Oracle failure mode (no fallback / wrong fallback)
- Price deviation tolerance too wide
- Chainlink `latestRoundData` misuse (stale rounds, zero answers)

### 5. Flash Loan Attacks
- Any protocol that relies on spot price or liquidity state vulnerable to flash-loan manipulation
- Uniswap/AAVE/Balancer flash loan to move price, drain, then repay

### 6. Signature / Authorization
- Signature replay (across chains — missing chainId in domain separator)
- Signature malleability (missing low-s check)
- EIP-712 domain separator issues
- Permit/approval replay
- Missing nonce tracking

### 7. Front-Running / MEV
- Sandwich attacks on swaps
- Transaction ordering dependence in reward/auction logic
- Commit-reveal schemes without proper enforcement

### 8. Governance / Timelock
- Governance proposals passing with too few votes
- Flash-loan votes (own tokens only during proposal, return after)
- Timelock bypass (queue + execute race)
- Malicious proposal execution (arbitrary calldata)

### 9. Cross-Chain / Bridge
- Message replay across chains
- Signature validation on bridge messages
- Relayer trust assumptions
- Fee/liquidity accounting across chains

### 10. Token Compatibility
- Fee-on-transfer / rebasing token assumptions (balance accounting breaks)
- ERC20 return value not checked
- ERC721/1155 compatibility issues
- Deflationary/inflationary tokens breaking share math

## Source-Code Grep for Solidity

```bash
# High-risk patterns
grep -rn "tx\.origin\|delegatecall\|selfdestruct\|block\.timestamp" --include="*.sol"
grep -rn "call{value\|\.call(" --include="*.sol"
grep -rn "transfer\|send" --include="*.sol"    # check return value handling
grep -rn "msg\.sender" --include="*.sol"       # audit every use
grep -rn "blockhash\|block\.number" --include="*.sol"   # randomness
grep -rn "require\|assert" --include="*.sol"   # check validation correctness
# Unchecked arithmetic (0.8+)
grep -rn "unchecked" --include="*.sol"
```

## Audit Methodology (systematic)

1. **Map the system**: contracts, inheritance trees, external surfaces, auth surfaces, state variables, write sites, value flow. Read README + docs first — understand what the protocol guarantees.
2. **Read prior findings on Solodit** for similar protocols (lending, DEX, staking, LSD, oracles).
3. **Hunt by lane** (parallel):
   - Callback liveness (reentrancy, griefing, withdrawal blockage)
   - Accounting/entitlement (stale balances, reward attribution, fee capture)
   - Semantic consistency (percent vs basis-point, decimal scaling, magic numbers)
   - Token/oracle statefulness (approval abuse, fee-on-transfer, oracle staleness)
   - Economic differential (deposit vs withdraw asymmetry, boundary behavior, incentive misalignment)
4. **Devil's Advocate**: for each candidate, trace the full call path and try to falsify it (guards, reentrancy protection, access control, by-design, economic feasibility, dry run).
5. **Prove with Foundry PoC** (write a forge test reproducing the exploit), or Echidna fuzz, Medusa, Halmos symbolic execution.

## Tools

```bash
# Static analysis
pip3 install slither-analyzer   # slither .
pip3 install aderyn            # aderyn

# Fuzzing
forge test                      # Foundry unit tests + PoC
echidna                        # property-based fuzzing
medusa                          # fuzzing

# Symbolic execution
halmos

# Real-world findings database
# Solodit: solodit.cyfrin.io (search findings by protocol/severity/tag)
# Cyfrin audit checklist: github.com/Cyfrin/audit-checklist (370 items)
```

## Web3 App/Client-Side Bugs (not just contracts)

- Private key / mnemonic exposure in JS bundles, localStorage, or error messages
- Wallet drainer scripts on fake dApp clones (phishing)
- Signature phishing (`eth_sign` vs `personal_sign` confusion)
- dApp accepts arbitrary `chainId` → replay attacks across chains
- Missing slippage protection in swap UI → sandwich loss
- RPC endpoint manipulation (user can swap provider → false balances)

## Meme Coin / Token Audits (high-value short audits)

When a program (or the user) wants a fast token safety audit — e.g. launching memecoins — this is the checklist that catches the scams/rug-pulls and the legit bugs:

### Liquidity / LP Side
- **Liquidity ownership**: If the deployer (or a wallet they can move funds to) holds LP tokens (`UniswapV2Pair.tokenOfOwnerByIndex(deployer, 0)`), they can remove ALL liquidity → full rug. Check LP tokens are burned (`balanceOf(0xdead)`) or locked in a verified locker (Team Finance / Unicrypt), and that the locker contract isn't upgradeable by the deployer.
- **Liquidity ratio**: threshold is LP tokens held by deployer (or controlled wallet) > 10% of total → High. Consider dynamic analysis too: if deployer's wallet can `removeLiquidity` at will → Critical.
- **Unbacked liquidity**: verify the pair has actual reserve token value behind it (use DEX subgraph — Uniswap v2/v3, PancakeSwap, Raydium) before trusting liquidity figures.
- **Mutable pool fees**: deployer holding any LP can set pair fee (v3) arbitrarily → grief the pool.

### Mint / Supply Side
- **Unlimited mint** (`mint` public, or `onlyOwner` mint without cap) → infinite dilution → Critical. Check `totalSupply` cap enforced in mint, and mint only from trusted/initialized roles.
- **Burn functions** that burn arbitrary user balances (not just `msg.sender`).
- **Hidden mint in `_transfer` / hooks** (fee-on-transfer that mints to a fee address on every transfer).

### Token Standard Logic
- **Fee-on-transfer assumptions**: contract with buy/sell/transfer fees that breaks balance accounting for integrations (DEX routing, airdrops) — the classic "wrong reward math" bug.
- **Rebase logic** without proper accounting — balance snapshot vs share mismatch → users can game or lose.
- **Deflationary + liquidity check**: transferring out burns and cuts liquidity → failed swaps.
- **Decimals mismatch** between token decimals and pair/price expectations (18 vs 6 vs 8) → pricing/grief bugs.

### Solana Token-2022 (SPL) specifics
- **Transfer-hook extension**: custom `transferHook` program can enforce/revert transfers — check it can't be abused to drain or brick.
- **Metadata pointers / permanent delegates**: a permanent delegate on a token = owner can transfer ANY user's balance → Critical rug vector. Check `permanentDelegate` / `authority` fields on the mint.
- **Freeze authority**: an unrenounced freeze authority can freeze all user accounts → grief. 
- **Mint authority retained** (not transferred to a multisig/zero) → mint more at will.
- **Close authority** on accounts → force-close user token accounts, destroying their balances.
- **Withdraw-withheld-authority** on transfer-fee extension → extract withheld fees.
- Verify with `spl-token display <mint>` + read the mint account layout (mintAuthority, freezeAuthority, extensions).

### Quick Facts to Verify (rug indicators)
- Liquidity burned/locked? Who holds LP?
- Mint authority alive? Freeze authority alive? Permanent delegate set?
- Any `owner` with `pause`/`setFee`/`mint`/`blacklist` powers not behind timelock?
- Token listed on a DEX with real reserves, or just "marketing" pairs with no liquidity?
- Is the router callable by anyone to drain from the pair contract?

## Severity guidance (Immunefi style)
- **Critical**: direct theft of funds (drain, infinite mint, flash-loan oracle manipulation)
- **High**: loss of user funds with some conditions, governance compromise
- **Medium**: griefing, temporary lock of funds, minor accounting errors
- **Low/Info**: code quality, gas, events, rounding