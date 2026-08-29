# STEP 14: Metal Mining & Weaponsmithing

## Goal
Implement deep industrial chains with multi-input recipes:
1. Coal mining & Iron ore mining from rocky seam deposits.
2. Weaponsmithing at the Smithy (combining Coal + Iron Ore to forge Swords & Shields).

## Acceptance Criteria
- Coal miners & Iron miners supply smelters/smithies with ores
- Multi-input recipe validation: Weaponsmith fetches Coal (2) and Iron Ore (3) to forge Swords and Shields
- Production queue toggleable between Swords and Shields
- Storehouse and Smithy inventories accurately reflect metal goods

## Files Created/Updated:
- `src/content/jobs.ts`: `coal_miner`, `iron_miner`, `weaponsmith`
- `src/content/buildings.ts`: `smithy`, `coal_mine`, `iron_mine`
- `src/core/Economy.ts`: Multi-ingredient crafting pipeline
