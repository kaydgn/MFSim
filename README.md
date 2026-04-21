# MFSim - Arac Performans Simulasyonu

Browser-based vehicle performance simulation application built with pure HTML, CSS, and JavaScript.

## Features

- Engine brake simulation and analysis
- PCHIP spline interpolation for data curves
- RK45 numerical solver for differential equations
- Energy balance calculations
- Interactive UI with undo/redo support
- Project save/load functionality
- PWA support for offline use

## Getting Started

Open `index.html` in a modern browser, or visit the [live demo](https://kaydgn.github.io/mfsim/).

## Development

```bash
npm install            # Install dependencies
npm run build          # Generate monolithic MFSim_Code.html
npm test               # Run unit tests
npm run test:e2e       # Run E2E tests (requires Chromium)
npm run test:all       # Run all tests
```

## Project Structure

- `index.html` — Main entry point (modular version)
- `js/` — JavaScript modules
- `css/` — Stylesheets
- `tests/` — Unit and E2E tests
- `MFSim_Code.html` — Auto-generated single-file build (do not edit manually)

## License

MIT License. See [LICENSE](LICENSE) for details.
