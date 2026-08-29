# STEP 15: Housing Demand, Beds & Barracks Training

## Goal
Implement colony population dynamics and military training:
1. Houses provide Beds. Colony population can only expand when available beds > population.
2. Barracks train raw Villagers equipped with forged Swords & Shields into elite Soldiers.

## Acceptance Criteria
- Town Hall checks bed capacity against current population
- Building Houses increases max population limit
- Barracks consumes 1 Villager + 1 Sword + 1 Shield to train 1 Soldier
- Soldier units can patrol boundaries and defend the colony

## Files Created/Updated:
- `src/content/buildings.ts`: `house`, `barracks`
- `src/core/World.ts`: Population growth & military training systems
