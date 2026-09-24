# Perfourmer M4L

A Max for Live sequencer for the Vermona Perfourmer MKII: interlocking, polymetric, evolving patterns across four voices.

Requires Ableton Live 12.2+ (Max 9).

## Development

- `npm install` at the repo root installs the lint tooling and a pre-commit hook that lints staged JS/TS files.
- `npm run lint` lints everything.
- Engine: `cd engine && npm install && npm test`; `npm run build` bundles it to `max/pf4-engine.js`.
- Devices: `python3 max/build_devices.py` regenerates `max/PF4 Hub.amxd` and `max/PF4 Voice.amxd`.
