# STEP 16: Roads, Walls, Gates & Defensive Turrets

## Goal
Implement infrastructure and fortifications:
1. Roads: Tile overlay reducing path movement cost to 1 (vs 3-5 for raw terrain), making logistics significantly faster.
2. Walls & Gates: Walls block movement completely (cost ∞); Gates allow friendly units to pass.
3. Turrets: Automated defensive watchtowers with attack radius and ballistic animations.

## Acceptance Criteria
- Road placement tool with dynamic auto-tiling/connections
- Units naturally prioritize walking on connected road networks
- Wall tiles block pathfinding unless passing through a Gate
- Turrets engage wild intruders/threats within range

## Files Created/Updated:
- `src/core/Grid.ts`: Road flags and connectivity
- `src/core/Pathfinding.ts`: Weighted terrain & road path optimization
- `src/content/buildings.ts`: `wall`, `gate`, `turret`
