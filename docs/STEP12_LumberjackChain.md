# STEP 12: Lumberjack Chain (Tree → Log → Storehouse)

## Goal
Implement the first complete gathering chain: Lumberjack units search for reachable forest tiles with trees, chop them, collect raw logs, and transport them to the nearest storehouse.

## Acceptance Criteria
- Lumberjack job spec correctly assigned to idle villagers or dedicated huts
- Pathfinder guides lumberjack to valid adjacent standing tree
- Tree cutting animation / progress with particle effects
- Tree feature is depleted/harvested into logs
- Worker carries log back to the nearest Storehouse or Town Hall
- Storehouse inventory updates with +2 logs and emits visual floating notification

## Files Created/Updated:
- `src/content/jobs.ts`: Lumberjack job definition
- `src/core/World.ts`: Tree harvesting dispatch logic
- `src/core/Unit.ts`: Gathering state transitions
