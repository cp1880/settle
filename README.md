# Hex/Isometric Colony Simulator

An isometric medieval colony and supply chain management game built with React, HTML5 Canvas, TypeScript, and Tailwind CSS.

## Features

- **Procedural Isometric World**: Dynamic elevation, rivers, forests, and mineral deposits (stone, iron ore, coal, timber).
- **Supply Chains & Production**: Harvest raw materials, refine wood into planks and ore into steel, craft tools, weapons, and provisions.
- **Logistics & Road Networks**: Dynamic A* pathfinding over dirt and paved road networks for haulers and workers.
- **Settlement Management**: Manage food, tools, housing, military barracks, and trade.
- **Natural Resource Depletion & Inspection**: Interactive node inspector for finite quarries and timber groves with worker dispatching.
- **Local Persistence**: Save and load colony states locally in your browser.

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation & Local Run
```bash
# Install dependencies
npm install

# Start local development server (runs on http://localhost:3000)
npm run dev

# Build production bundle
npm run build
```

## GitHub Workflows

- **CI Build (`.github/workflows/build.yml`)**: Automatically lints TypeScript and verifies build on pull requests and pushes to `main`.
- **Release & Live Browser Demo (`.github/workflows/release.yml`)**: Builds the standalone client package, creates a GitHub Release zip artifact when a tag (`v*.*.*`) is pushed, and automatically deploys the live working game to **GitHub Pages** for instant browser play.

## License
MIT
