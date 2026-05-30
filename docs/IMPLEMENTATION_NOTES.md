# Implementation notes

This package uses the provided dnd5e system archive only as a structural reference for packaging conventions:

- root `system.json`
- root ES module
- root CSS
- `templates/actors` and `templates/items`
- language files
- documentTypes in the manifest

No dnd5e source code, art, templates or game content were copied.

The VtM data model is based on the project documents for VtM Revised Session Companion and the JSON character sheet mapping.

## 0.2.7-dev

Dice rolls now apply the worst checked health level as a wound penalty. The actor sheet computes the active penalty from `system.health`, subtracts it from the base pool, clamps the final pool to at least 1 die, and blocks rolls when `incapacitated` is checked.
