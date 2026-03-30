# PlanForm.AI
PlanForm.AI is a structural intelligence platform that takes a floor plan image and turns it into something you can actually work with. Upload a blueprint, and the system figures out the walls, rooms, doors, and windows, builds a 3D model from that data, recommends construction materials, and explains the reasoning behind every suggestion. The whole thing runs through a pipeline that combines computer vision, graph analysis, and a language model working together in sequence.
## Repository structure

- `client/` — React + Vite frontend
- `server/` — Node.js (Express) API server
- `cv-service/` — Python FastAPI service (computer vision utilities)
- `smart-contract/` — smart contract work (project folder)
- `data/` — local data files used by the project
- `deploy-contract.sh`, `deploy-contract.ps1` — helper scripts for contract deployment
- `package.json` — root dependencies (Stellar SDK tooling)

## Tech stack (high level)

- Frontend: React (Vite), Tailwind, Three.js (@react-three/fiber, drei), Framer Motion
- Backend: Node.js, Express, Multer, Groq SDK, Axios
- CV service: FastAPI + Uvicorn, OpenCV, NumPy, Pillow, scikit-image
- Wallet/chain: Freighter API + Stellar SDK (in root + client dependencies)

## Getting started

- ### Prerequisites

- Node.js (recommended: current LTS)
- Python 3.10+ (recommended)
- pip (or a virtual environment tool of your choice)

## Features
 
### Floor Plan Parsing
 
The computer vision service processes uploaded floor plan images using OpenCV. It separates thick wall lines from thin annotation lines, runs Hough line detection on the wall layer, merges parallel edge pairs into single centerlines, and snaps wall endpoints together at junctions.
 
### Door and Window Detection
 
Doors are detected by looking for quarter-circle arc shapes in the thin annotation layer. Windows are detected from parallel line pairs or hollow rectangular contours. Both are then matched against wall gaps to confirm their positions.
 
### Graph-Based Spatial Reasoning
 
Wall segments are converted into a graph where nodes are wall endpoints and edges carry wall metadata including a stable wall ID. Gap detection runs over this graph to find collinear segments with openings between them.
 
### 3D Model Viewer
 
The parsed layout feeds directly into a Three.js scene rendered inside the browser. Walls are extruded to height, doors are shown as transparent gaps with a door leaf, and windows are rendered with a translucent glass panel.
 
### Material Recommendations
 
A scoring system evaluates every material in a catalog of roughly a hundred options against the structural requirements of each wall segment. The span of each segment determines whether it is a partition wall, load-bearing wall, long span, or beam.
 
### AI Explanation and Chat
 
After analysis, the system sends the recommendations to Groq and asks for a plain-language explanation covering the project summary, element-by-element reasoning, and key tradeoffs. A floating chat widget lets you ask follow-up questions about the plan.
 
### Blockchain Registry
 
Results can be stored on the Stellar testnet through a Soroban smart contract. Connecting a Freighter wallet lets you register a blueprint with a hashed record of the materials, room count, area, and cost estimate.
### Coordinate Overlay
 
The CV service generates an annotated version of the uploaded image with wall endpoint coordinates marked directly on the plan. This is saved alongside the original and shown in the layout viewer as an alternative view, which makes it easier to cross-reference the 3D model with the original drawing.
