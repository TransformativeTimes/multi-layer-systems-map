# Multi-Layer Systems Visualization

An open-source interactive 3D data visualization tool for exploring complex systems.
Move between layers, filter information, and study how elements interconnect to reveal underlying system dynamics.

![Multi-Layer Systems Visualization](./doc_imgs/multi-layer-system.jpg)

### Features

- **Multi-layer visualization**: Switch between different system layers for a structured view  
- **Interactive nodes**: Click on nodes to reveal details and their connections  
- **Tag-based filtering**: Filter and organize information using tags  
- **3D environment**: Immersive Three.js-powered visualization  
- **Custom data**: Easily load your own data by editing a single JSON file  
- **Responsive design**: Works on both desktop and mobile devices  
<br><br>

## How to use

![System Element Connection](./doc_imgs/system-element-connection.jpg)

### Interact with the data
- Click on nodes to view their details and connections  
- Use the side panel to navigate through the data in a list view  
- Select tags to filter nodes in both the visualization and the side panel  
- Rotate and zoom the 3D scene using your mouse or touch controls

### Keyboard shortcuts

- **Space**: Play/pause the rotation animation
- **ESC**: Close open nodes and layers
- **F**: Toggle between fullscren mode
- **Number keys (1, 2, 3, …)**: Switch between layers
<br><br><br>

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) installed
- Modern web browser with WebGL support

### Installation

1. Clone this repository  
2. Open the folder in your terminal  
3. Install dependencies and start the local development server:

```bash
npm install
npm run dev
```

### Build your data.json file

The visualization reads from `public/data/data.json`. 
Structure your data with:

- **layers**: Define layers with `id`, `name`, and `order`
- **nodes**: Create system elements with `id`, `layerId`, `title`, `description`, and `tags`
- **connections**: Establish relationships between elements with `source`, and `target`


``` json
{
  "layers": [
    { "id": "layer_01", "name": "Layer 1", "order": 0 },
    { "id": "layer_02", "name": "Layer 2", "order": 1 }
  ],
  "nodes": [
    { "id": "n0001", "layerId": "layer_01", "title": "Node A Title", "description": "Example node A", "tags": ["tag1","tag2"] },
    { "id": "n0002", "layerId": "layer_02", "title": "Node B Title", "description": "Example node B", "tags": ["tag1","tag2"] }
  ],
  "connections": [
    { "source": "n0001", "target": "n0002" }
  ]
}
```

### Load your data

Replace the sample data in `public/data/data.json` with your own data following the same JSON structure.


### Build for Production

Generate the optimized `dist/` folder for deployment:

```bash
npm run build 
```
<br><br>

## Technologies

- **Three.js**: 3D graphics and visualization
- **Vite**: Build tool and development server
- **JavaScript**: Core application logic
- **SCSS**: Styling and responsive design