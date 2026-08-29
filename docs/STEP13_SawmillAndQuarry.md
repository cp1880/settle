# STEP 13: Sawmill & Quarry Processing Chains

## Goal
Implement two-tier processing chains:
1. Sawmill: Consumes Logs from storage and processes them into Wood planks.
2. Stone Quarry: Workers extract raw stone blocks from rocky outcrops and store them.

## Acceptance Criteria
- Sawmill worker fetches 2 logs from storehouse, operates sawmill machine, and deposits finished Wood planks
- Stone miner identifies rocky terrain tiles, mines stone blocks, and carries them to storage
- Wood and Stone inventories feed into advanced building construction costs
- Live productivity stats displayed when inspecting Sawmills and Quarries

## Files Created/Updated:
- `src/content/jobs.ts`: `sawyer` and `stone_miner` JobSpecs
- `src/core/Store.ts`: Multi-resource consumption & buffering
- `src/core/World.ts`: Building-based job assignment
