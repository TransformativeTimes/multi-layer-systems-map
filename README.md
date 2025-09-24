# Multi-Layer Systems Map

An interactive 3D visualization tool for exploring multi-layered system relationships. Navigate through different layers and filter data to understand complex system dynamics and connections.

### Features

- **Multi-layer visualization**: Navigate between different system layers
- **Interactive nodes**: Click and explore interconnected system elements
- **Tag-based filtering**: Filter and organize information using the tags system
- **3D environment**: Immersive Three.js-powered visualization
- **Custom data**: Edit the data.json file to view your own data
- **Responsive design**: Works across desktop and mobile devices
<br><br>

## How to use

### Interact with the nodes
- Click on nodes to view detailed descriptions 
- Hover over nodes to see connection highlights
- Use mouse/touch controls to rotate and zoom the 3D view

### Keyboard shortcuts

- **Space**: Play/pause rotation animation
- **ESC**: Close opened nodes and layers
- **F**: Toggle between fullscren mode
- **Number keys**: Navigate between layers
<br><br>

## Setup

### Prerequisites
- Node.js (for development)
- Modern web browser with WebGL support

### Installation
Start by cloning this repo, then open it with your terminal and install the deppendencies and start a local server for development.

```bash
npm install
npm run dev
```

### Build your data.json file

The visualization reads from `public/data/data.json`. Structure your data with:

- **layers**: Define temporal or conceptual layers with `id`, `name`, and `order`
- **nodes**: System elements with `id`, `layerId`, `title`, `description`, and `tags`
- **connections**: Relationships between nodes with `source`, `target`
- **tags**: Categories for filtering and grouping nodes

### Load your data

Replace the sample data in `public/data/data.json` with your own system data following the same JSON structure.


### Build the production version with:

Finally, create/update the `dist` folder to be ready for deployment.

```bash
npm run build 
```
<br><br>

## Technologies

- **Three.js**: 3D graphics and visualization
- **Vite**: Build tool and development server
- **Vanilla JavaScript**: Core application logic
- **SCSS**: Styling and responsive design