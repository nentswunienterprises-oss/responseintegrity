# Contributor UI Template MVP

## Purpose
This MVP reuses the existing affiliate UI as the first contributor interface so the contributor model can be validated quickly without waiting for full backend refactors.

## What Was Implemented
Contributor routes now point to reusable wrappers over current affiliate pages.

Routes added:

- /contributor/landing
- /contributor/gateway
- /contributor/contributor/home
- /contributor/contributor/tracking
- /contributor/contributor/updates

Current behavior:

- contributor pages render the existing affiliate experience
- existing data sources and API behavior remain unchanged
- this is a template-alias phase, not yet a universal contributor engine

## Why This Is Useful
- enables immediate UX testing for contributor flows
- prevents duplicated UI while architecture evolves
- keeps migration risk low by preserving existing affiliate functionality

## Next Upgrade Steps
1. Replace affiliate labels with contributor language:
   - Affiliate -> Contributor
   - Affiliate Code -> Production Link
   - Leads/Closes -> Pipeline stages
   - Commission -> Production Reward

2. Add contributor typing and ownership:
   - person
   - campaign
   - school
   - community
   - QR/flyer

3. Add contributor ownership split UI at creation.

4. Add dual pipeline toggle:
   - Student Production
   - Specialist Production

5. Keep rewards enabled for student pipeline and disabled for specialist pipeline in MVP.

6. Replace affiliate-specific endpoints with universal contributor endpoints after data model migration.

## Migration Principle
UI first, engine second.

Use this template phase to validate interaction model and terminology, then migrate backend models and attribution logic without redesigning the frontend shell.
