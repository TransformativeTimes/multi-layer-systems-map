import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js"

////////////////////////////////////////////////////////////////////////////////
// region Three.js setup
////////////////////////////////////////////////////////////////////////////////


// Scene setup
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x171717)

// Get canvas container
const container = document.getElementById('canvas-container') || document.body

// Camera setup
// PERSPECTIVE CAMERA
const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.1, 1000)

// ORTHOGRAPHIC CAMERA
//const camera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, 1, 1000 );

camera.position.set(0, 180, 50)
camera.lookAt(1, 1, 1)

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(container.clientWidth, container.clientHeight)
container.appendChild(renderer.domElement)

// Post-processing setup
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 0.3, 0.2, 0.0002))

// OrbitControls setup
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.enablePan = false

controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN,
}




////////////////////////////////////////////////////////////////////////////////
// region Lighting
////////////////////////////////////////////////////////////////////////////////

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.9)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9)
directionalLight.position.set(10, 10, 5)
scene.add(directionalLight)


////////////////////////////////////////////////////////////////////////////////
// region Global Variables
////////////////////////////////////////////////////////////////////////////////


// Raycaster for click detection
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

// Global variable to track the current popup
let nodePopup = null
let currentlyHighlightedSphere = null
let currentlyHoveredSphere = null
let isHoveringLiElement = false

// Tooltip element for hover
let sphereTooltip = null


// navigation container
const navContainer = document.createElement('div')
navContainer.classList.add('nav-container')

const playBtn = document.createElement('div')
playBtn.classList.add('play-btn', 'playing')
navContainer.appendChild(playBtn)


// Animation control variables

let animPlaying = true;

let isUserControlling = false
let lastInteractionTime = 0
let animationTimeout
let animationStartTime = 0
let accumulatedTime = 0
let userCameraAngle = 0
let userCameraRadius = 25
let userCameraY = 10
let cameraTarget = new THREE.Vector3(0, 0, 0)



// Array to store sphere meshes with their data
const spheres = []

// Active tags state management
const activeTags = new Set()
let sphereRadius = 0.25

// Array to store connection lines
const connections = []


////////////////////////////////////////////////////////////////////////////////
// region Rendering nodes
////////////////////////////////////////////////////////////////////////////////



// Function to calculate the bounding box of all spheres
function calculateBoundingBox() {
  if (spheres.length === 0) return null

  const box = new THREE.Box3()
  spheres.forEach((sphere) => {
    const sphereBox = new THREE.Box3().setFromObject(sphere)
    box.expandByPoint(sphereBox.min)
    box.expandByPoint(sphereBox.max)
  })

  return box
}

// Function to fit camera to show all layers
function fitCameraToLayers() {
  const boundingBox = calculateBoundingBox()
  if (!boundingBox) return

  const center = boundingBox.getCenter(new THREE.Vector3())
  const size = boundingBox.getSize(new THREE.Vector3())

  // Calculate the maximum dimension
  const maxDim = Math.max(size.x, size.y, size.z)

  // Calculate distance needed based on field of view
  const fov = camera.fov * (Math.PI / 180)
  const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.5 // Add 50% padding

  // Position camera to look at the center from a good angle
  camera.position.set(
    center.x + distance * 0.7,
    center.y + distance * 0.25, // adjust up and down camera angles
    center.z + distance * 0.7
  )

  camera.lookAt(center)

  // Update animation variables to match the new camera position
  userCameraAngle = Math.atan2(camera.position.z - center.z, camera.position.x - center.x)
  userCameraRadius = Math.sqrt((camera.position.x - center.x) ** 2 + (camera.position.z - center.z) ** 2)
  userCameraY = camera.position.y

  // Update orbit controls target and store it for animation
  controls.target.copy(center)
  cameraTarget.copy(center)
  controls.update()
}

// Function to check if a position is too close to existing spheres
function isPositionValid(newPosition, existingSpheres, minDistance = 2) {
  for (const sphere of existingSpheres) {
    const distance = newPosition.distanceTo(sphere.position)
    if (distance < minDistance) {
      return false
    }
  }
  return true
}

// Function to generate a valid position that doesn't overlap
function generateValidPosition(existingSpheres, yPosition = 0, maxAttempts = 100) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const position = new THREE.Vector3((Math.random() - 0.5) * 15, yPosition, (Math.random() - 0.5) * 15)

    if (isPositionValid(position, existingSpheres)) {
      return position
    }
  }

  // Fallback: return a position even if it might be close to others
  return new THREE.Vector3((Math.random() - 0.5) * 15, yPosition, (Math.random() - 0.5) * 15)
}


////////////////////////////////////////////////////////////////////////////////
// region Connections between nodes
////////////////////////////////////////////////////////////////////////////////

// Function to create a bezier curve between two points
function createBezierCurve(startPos, endPos, layerSpacing = 10) {
  // Adjust start and end points to sphere surface (top/bottom)
  const adjustedStart = new THREE.Vector3(
    startPos.x,
    startPos.y - sphereRadius, // Top of source sphere
    startPos.z
  )

  const adjustedEnd = new THREE.Vector3(
    endPos.x,
    endPos.y + sphereRadius, // Bottom of target sphere
    endPos.z
  )

  // Calculate control points with specific positioning
  const controlPoint1 = new THREE.Vector3(adjustedStart.x, adjustedStart.y - layerSpacing * 0.4, adjustedStart.z)

  const controlPoint2 = new THREE.Vector3(adjustedEnd.x, adjustedEnd.y + layerSpacing * 0.4, adjustedEnd.z)

  // Create the bezier curve
  const curve = new THREE.CubicBezierCurve3(adjustedStart, controlPoint1, controlPoint2, adjustedEnd)

  return curve
}

// Function to create connection lines between spheres
function createConnections(data) {
  const layerSpacing = 10 // Same as defined in loadData function

  data.connections.forEach((connection) => {
    // Find the source and target spheres
    const sourceSphere = spheres.find((sphere) => sphere.userData.id === connection.source)
    const targetSphere = spheres.find((sphere) => sphere.userData.id === connection.target)

    if (sourceSphere && targetSphere) {
      // Create bezier curve with layer spacing
      const curve = createBezierCurve(sourceSphere.position, targetSphere.position, layerSpacing)

      // Create geometry from curve
      const points = curve.getPoints(50) // 50 points for smooth curve
      const geometry = new THREE.BufferGeometry().setFromPoints(points)

      // Create material for the line
      const material = new THREE.LineBasicMaterial({
        color: 0x76e3ab,
        opacity: 0.2,
        transparent: true,
        linewidth: 2,
      })

      // Create the line
      const line = new THREE.Line(geometry, material)
      line.userData = connection

      // Add to scene and connections array
      scene.add(line)
      connections.push(line)
    }
  })
}


////////////////////////////////////////////////////////////////////////////////
// region Hover Interaction
////////////////////////////////////////////////////////////////////////////////

// Function to check if a sphere is connected to the highlighted sphere
function isConnectedToHighlighted(sphere) {
  if (!currentlyHighlightedSphere) return false
  
  if (sphere === currentlyHighlightedSphere) return true
  
  return connections.some((connection) => {
    return (connection.userData.source === currentlyHighlightedSphere.userData.id && connection.userData.target === sphere.userData.id) ||
           (connection.userData.target === currentlyHighlightedSphere.userData.id && connection.userData.source === sphere.userData.id)
  })
}

// Function to reset all sphere colors and opacity to original state
function resetAllSphereColors() {
  spheres.forEach((sphere) => {
    sphere.material.emissive.setHex(0xffffff)
    sphere.material.color.set(0xffffff)
    sphere.material.opacity = 1
    sphere.material.transparent = false
  })
  
  // Reset connection opacity
  connections.forEach((connection) => {
    connection.material.opacity = 0.2
  })
  
  currentlyHighlightedSphere = null
}

// Function to handle node hover effects (works with both spheres and li elements)
function handleNodeHover(nodeData, mouseX, mouseY, showTooltipFlag = true) {
  // Find the corresponding sphere
  const hoveredSphere = spheres.find(sphere => sphere.userData.id === nodeData.id)
  
  if (!hoveredSphere) return

  // Reset previously hovered sphere if it's different and not currently highlighted
  if (currentlyHoveredSphere && currentlyHoveredSphere !== hoveredSphere && currentlyHoveredSphere !== currentlyHighlightedSphere) {
    // Determine the correct reset color based on whether a sphere is clicked
    const resetColor = currentlyHighlightedSphere && !isConnectedToHighlighted(currentlyHoveredSphere) ? 0x464D52 : 0xffffff
    currentlyHoveredSphere.material.emissive.setHex(resetColor)
    currentlyHoveredSphere.material.color.set(resetColor)
  }

  // Apply hover effect to new sphere (only if it's not already highlighted)
  if (hoveredSphere && hoveredSphere !== currentlyHighlightedSphere) {
    hoveredSphere.material.emissive.setHex(0x9FF2C8)
    hoveredSphere.material.color.set(0x9FF2C8)
  }

  currentlyHoveredSphere = hoveredSphere
  
  // Show tooltip only if requested
  if (showTooltipFlag) {
    showTooltip(hoveredSphere, mouseX, mouseY)
  }
}

// Function to handle sphere hover effects (legacy wrapper for backward compatibility)
function handleSphereHover(hoveredSphere, mouseX, mouseY) {
  handleNodeHover(hoveredSphere.userData, mouseX, mouseY)
}

// Function to reset hover effects
function resetHoverEffects() {
  if (currentlyHoveredSphere && currentlyHoveredSphere !== currentlyHighlightedSphere) {
    // Determine the correct reset color based on whether a sphere is clicked
    const resetColor = currentlyHighlightedSphere && !isConnectedToHighlighted(currentlyHoveredSphere) ? 0x464D52 : 0xffffff
    currentlyHoveredSphere.material.emissive.setHex(resetColor)
    currentlyHoveredSphere.material.color.set(resetColor)
  }
  currentlyHoveredSphere = null
  
  // Hide tooltip
  hideTooltip()
}

// Function to create and show tooltip
function showTooltip(sphere, mouseX, mouseY) {
  if (!sphereTooltip) {
    sphereTooltip = document.createElement('p')
    sphereTooltip.className = 'sphere-tooltip'
    sphereTooltip.style.position = 'fixed'
    sphereTooltip.style.pointerEvents = 'none'
    sphereTooltip.style.zIndex = '1000'
    document.body.appendChild(sphereTooltip)
  }
  
  sphereTooltip.textContent = sphere.userData.title
  sphereTooltip.style.left = mouseX + 10 + 'px'
  sphereTooltip.style.top = mouseY - 25 + 'px'
  sphereTooltip.style.display = 'block'
}

// Function to hide tooltip
function hideTooltip() {
  if (sphereTooltip) {
    sphereTooltip.style.display = 'none'
  }
}






////////////////////////////////////////////////////////////////////////////////
// region Loading data
////////////////////////////////////////////////////////////////////////////////

// Load and process data
async function loadData() {
  try {
    // Read the data.json file
    const response = await fetch("assets/data/template-data-2.json")
    const data = await response.json()

    // Create layer Y position mapping
    const layerYPositions = {}
    let layerSpacing = 10 // Distance between layers

    // Calculate total height and center offset
    const maxOrder = Math.max(...data.layers.map((layer) => layer.order))
    const totalHeight = maxOrder * layerSpacing
    const centerOffset = totalHeight * 0.5

    data.layers.forEach((layer) => {
      layerYPositions[layer.id] = -layer.order * layerSpacing + centerOffset
    })

    // Create spheres for each node
    const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 32, 16)

    data.nodes.forEach((node) => {
      // Create material with emissive color for bloom effect
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(0xffffff),
        emissive: new THREE.Color(0xffffff),
      })

      // Create sphere mesh
      const sphere = new THREE.Mesh(sphereGeometry, material)

      // Get the Y position for this node's layer
      const layerY = layerYPositions[node.layerId] || 0

      // Generate a valid position that doesn't overlap with existing spheres
      const validPosition = generateValidPosition(spheres, layerY)
      sphere.position.copy(validPosition)

      // Remove render order modifications since we don't want spheres on top of each other
      // sphere.renderOrder = 1000
      // sphere.material.depthTest = false

      // Store the node data with the sphere
      sphere.userData = node

      // Add to scene and array
      scene.add(sphere)
      spheres.push(sphere)
    })

    // Create connections between spheres
    createConnections(data)

    // Fit camera to show all layers after loading
    fitCameraToLayers()

    navigation(data)

  } catch (error) {
    console.error("Error loading data:", error)
  }
}


////////////////////////////////////////////////////////////////////////////////
// region Navigation
////////////////////////////////////////////////////////////////////////////////



// Function to update sphere visibility based on active tags
function updateSphereVisibility() {
  spheres.forEach(sphere => {
    const nodeTags = sphere.userData.tags || []
    
    if (activeTags.size === 0) {
      // If no tags are active, show all spheres
      sphere.visible = true
    } else {
      // Check if sphere has any active tag
      const hasActiveTag = nodeTags.some(tag => activeTags.has(tag))
      sphere.visible = hasActiveTag
    }
  })
  
  // Also update connection visibility
  connections.forEach(connection => {
    const sourceSphere = spheres.find(sphere => sphere.userData.id === connection.userData.source)
    const targetSphere = spheres.find(sphere => sphere.userData.id === connection.userData.target)
    
    // Show connection only if both spheres are visible
    connection.visible = sourceSphere?.visible && targetSphere?.visible
  })
  
  // Update nodesList items visibility based on active tags
  document.querySelectorAll('.layer-container ul li').forEach(li => {
    // Find the corresponding sphere to get node data
    const nodeTitle = li.textContent.trim()
    const correspondingSphere = spheres.find(sphere => sphere.userData.title === nodeTitle)
    
    if (correspondingSphere) {
      const nodeTags = correspondingSphere.userData.tags || []
      
      if (activeTags.size === 0) {
        // If no tags are active, show all li elements
        li.style.display = 'block'
      } else {
        // Check if node has any active tag
        const hasActiveTag = nodeTags.some(tag => activeTags.has(tag))
        li.style.display = hasActiveTag ? 'block' : 'none'
      }
    }
  })
}

// Function to toggle tag active state
function toggleTag(tag, tagElement) {
  if (activeTags.has(tag)) {
    activeTags.delete(tag)
    tagElement.classList.remove('active')
  } else {
    activeTags.add(tag)
    tagElement.classList.add('active')
  }
  
  updateSphereVisibility()
}

function navigation(data) {

  // Draw all layers

  const layersWrap = document.createElement('div')
  layersWrap.classList.add('layers-wrap')


  data.layers.forEach(layer => {

    const layerContainer = document.createElement('div')
    layerContainer.classList.add('layer-container')

    let layerTitle = document.createElement('h2')

    layerTitle.innerHTML = `${layer.name}`

    layerContainer.appendChild(layerTitle)

    // Add click event to toggle active class on layerContainer
    layerTitle.addEventListener('click', () => {
      if (layerContainer.classList.contains('active')) {
        // If already active, just remove the active class
        layerContainer.classList.remove('active')
      } else {
        // Remove active class from all layer containers
        document.querySelectorAll('.layer-container').forEach(container => {
          container.classList.remove('active')
        })
        
        // Add active class to the clicked layerContainer
        layerContainer.classList.add('active')
      }
    })

    const nodesList = document.createElement('ul')
    
    data.nodes
      .filter(node => node.layerId === layer.id)
      .forEach(node => {
        const li = document.createElement('li')
        li.textContent = node.title
        li.style.cursor = 'pointer'
        
        // Add click event listener to trigger the same functionality as sphere clicks
        li.addEventListener('click', () => {
          if (li.classList.contains('active')) {
            li.classList.remove('active')
            // Reset sphere colors and close popup when deactivating
            if (nodePopup) {
              nodePopup.remove()
              nodePopup = null
            }
            resetAllSphereColors()
          } else {
            handleNodeSelection(node)
            // Remove active class from all li elements in all nodesLists
            document.querySelectorAll('.layer-container ul li').forEach(liItem => {
              liItem.classList.remove('active')
            })
            li.classList.add('active')
          }
        })
        
        // Add hover event listeners to trigger sphere hover effects
        li.addEventListener('mouseenter', (event) => {
          isHoveringLiElement = true
          handleNodeHover(node, event.clientX, event.clientY, false)
        })
        
        li.addEventListener('mouseleave', () => {
          isHoveringLiElement = false
          resetHoverEffects()
        })
        
        nodesList.appendChild(li)
      })

    layerContainer.appendChild(nodesList)
    layersWrap.appendChild(layerContainer)

    

  })







  // Draw all tags

  const tagsUl = document.createElement('ul')
  tagsUl.classList.add('tags-container')

  const uniqueTags = new Set()
  
  data.nodes.forEach(node => {
    if (node.tags && Array.isArray(node.tags)) {
      node.tags.forEach(tag => {
        uniqueTags.add(tag)
      })
    }
  })
  
  uniqueTags.forEach(tag => {
    let li = document.createElement('li')
    li.innerHTML = tag
    li.classList.add('tag-item')
    
    // Add click event listener to toggle tag
    li.addEventListener('click', () => {
      toggleTag(tag, li)
    })

    tagsUl.appendChild(li)
  })


  
  document.body.appendChild(navContainer)
  navContainer.appendChild(layersWrap)
  navContainer.appendChild(tagsUl)
}





////////////////////////////////////////////////////////////////////////////////
// region Mouse click events
////////////////////////////////////////////////////////////////////////////////

// Function to handle node selection (used by both sphere clicks and li clicks)
function handleNodeSelection(nodeData) {
  // Find the corresponding sphere
  const clickedSphere = spheres.find(sphere => sphere.userData.id === nodeData.id)
  
  if (!clickedSphere) return

  // Find the corresponding li element
  const correspondingLi = document.querySelector(`.layer-container ul li[data-node-id="${nodeData.id}"]`) ||
                         Array.from(document.querySelectorAll('.layer-container ul li')).find(li => 
                           li.textContent.trim() === nodeData.title
                         )

  // Check if the node is currently active
  const isCurrentlyActive = correspondingLi && correspondingLi.classList.contains('active')

  if (isCurrentlyActive) {
    // If currently active, deactivate
    if (correspondingLi) {
      correspondingLi.classList.remove('active')
    }
    
    // Remove existing popup if it exists
    if (nodePopup) {
      nodePopup.remove()
      nodePopup = null
    }
    
    // Reset sphere colors
    resetAllSphereColors()
    return
  }

  // Remove existing popup if it exists
  if (nodePopup) {
    nodePopup.remove()
    nodePopup = null
  }

  // Reset all sphere colors first
  resetAllSphereColors()

  // Remove active class from all li elements
  document.querySelectorAll('.layer-container ul li').forEach(liItem => {
    liItem.classList.remove('active')
  })

  // Add active class to the corresponding li element
  if (correspondingLi) {
    correspondingLi.classList.add('active')
  }

  // Find all connected spheres
  const connectedSphereIds = new Set()
  connectedSphereIds.add(clickedSphere.userData.id) // Include the clicked sphere
  
  connections.forEach((connection) => {
    if (connection.userData.source === clickedSphere.userData.id) {
      connectedSphereIds.add(connection.userData.target)
    }
    if (connection.userData.target === clickedSphere.userData.id) {
      connectedSphereIds.add(connection.userData.source)
    }
  })

  // Change color of unconnected spheres to red
  spheres.forEach((sphere) => {
    if (!connectedSphereIds.has(sphere.userData.id)) {
      sphere.material.emissive.setHex(0x464D52)
      sphere.material.color.set(0x464D52)
    }
  })

  // Reduce opacity of connections not involving the clicked sphere
  connections.forEach((connection) => {
    if (connection.userData.source !== clickedSphere.userData.id && 
        connection.userData.target !== clickedSphere.userData.id) {
      connection.material.opacity = 0.02
    }
  })

  // Highlight the clicked sphere and store reference
  clickedSphere.material.emissive.setHex(0x6FD4A0)
  clickedSphere.material.color.set(0x6FD4A0)
  currentlyHighlightedSphere = clickedSphere

  // Create new popup
  nodePopup = document.createElement("div")
  nodePopup.className = "node-popup"

  nodePopup.innerHTML = `
    <div class="close-btn"></div>
    <h1>${clickedSphere.userData.title}</h1>
    <p>${clickedSphere.userData.description}</p>

  `
  if (clickedSphere.userData.tags && Array.isArray(clickedSphere.userData.tags)) {
    const ul = document.createElement("ul")

    clickedSphere.userData.tags.forEach((tag) => {
      const li = document.createElement("li")
      li.textContent = tag
      ul.appendChild(li)
    })

    nodePopup.appendChild(ul)
  }

  document.body.appendChild(nodePopup)

  // Add close button functionality
  const closeBtn = nodePopup.querySelector(".close-btn")
  closeBtn.addEventListener("click", () => {
    nodePopup.remove()
    nodePopup = null
    // Reset sphere colors when popup closes
    resetAllSphereColors()
    // Remove active class from li elements when popup closes
    if (correspondingLi) {
      correspondingLi.classList.remove('active')
    }
  })
}

// Mouse click handler
function onMouseClick(event) {
  // Calculate mouse position in normalized device coordinates
  const rect = container.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1

  // Update raycaster
  raycaster.setFromCamera(mouse, camera)

  // Check for intersections
  const intersects = raycaster.intersectObjects(spheres)

  if (intersects.length > 0) {
    const clickedSphere = intersects[0].object
    handleNodeSelection(clickedSphere.userData)
  } 
  // else {
  //   // Clicked on canvas but not on any sphere - close popup if it exists
  //   if (nodePopup) {
  //     nodePopup.remove()
  //     nodePopup = null
  //     // Reset sphere colors when popup closes
  //     resetAllSphereColors()
  //   }
  // }
}

// Mouse move handler for hover effects
function onMouseMove(event) {
  // Calculate mouse position in normalized device coordinates
  const rect = container.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1

  // Update raycaster
  raycaster.setFromCamera(mouse, camera)

  // Check for intersections
  const intersects = raycaster.intersectObjects(spheres)

  if (intersects.length > 0) {
    const hoveredSphere = intersects[0].object
    handleSphereHover(hoveredSphere, event.clientX, event.clientY)
    container.style.cursor = 'pointer'
  } else {
    // No sphere is being hovered, reset hover effects only if not hovering li element
    if (!isHoveringLiElement) {
      resetHoverEffects()
    }
    container.style.cursor = 'default'
  }
}

// Add event listeners
renderer.domElement.addEventListener("click", onMouseClick)
window.addEventListener("mousemove", onMouseMove)

// Camera control event listeners
controls.addEventListener("start", () => {
  isUserControlling = true
  clearTimeout(animationTimeout)
})

controls.addEventListener("end", () => {
  lastInteractionTime = Date.now()
  animationTimeout = setTimeout(() => {
    // Calculate the current angle, radius, and Y position based on camera position relative to target
    const targetX = cameraTarget.x
    const targetZ = cameraTarget.z
    userCameraAngle = Math.atan2(camera.position.z - targetZ, camera.position.x - targetX)
    userCameraRadius = Math.sqrt((camera.position.x - targetX) * (camera.position.x - targetX) + (camera.position.z - targetZ) * (camera.position.z - targetZ))
    userCameraY = camera.position.y
    animationStartTime = Date.now()
    // Only reset accumulated time if animation is playing, preserve it if paused
    if (animPlaying) {
      accumulatedTime = 0
    }
    isUserControlling = false
  }, 0) // Time to restart the camera rotation animation
})


////////////////////////////////////////////////////////////////////////////////
// region Window resize and Fullscreen
////////////////////////////////////////////////////////////////////////////////

// Handle window resize
function onWindowResize() {
  // Update canvas container width based on fullscreen state
  if (isFullscreen) {
    canvasContainer.style.width = 'calc(100vw - 20px)'
  } else {
    canvasContainer.style.width = 'calc(100vw - 300px)'
  }
  
  // Wait for DOM to update before reading new dimensions
  requestAnimationFrame(() => {
    const width = container.clientWidth
    const height = container.clientHeight
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
    composer.setSize(width, height)
  })
}
window.addEventListener("resize", onWindowResize)


// Fullscreen toggle functionality
let isFullscreen = false
const canvasContainer = document.getElementById('canvas-container')

function toggleFullscreen() {
  if (isFullscreen) {
    // Return to normal view
    canvasContainer.style.width = 'calc(100vw - 300px)'
    canvasContainer.style.display = 'block'
    isFullscreen = false

    navContainer.style.display = 'flex'
  } else {
    // Go to fullscreen
    canvasContainer.style.width = 'calc(100vw - 20px)'
    canvasContainer.style.display = 'block'
    isFullscreen = true

    navContainer.style.display = 'none'
  }

  const width = canvasContainer.clientWidth
  const height = canvasContainer.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
  composer.setSize(width, height)

}

// Add keyboard event listener for 'f' key and spacebar
document.addEventListener('keydown', (event) => {
  if (event.key === 'f' || event.key === 'F') {
    toggleFullscreen()
  } else if (event.key === ' ') {
    event.preventDefault() // Prevent default spacebar behavior (page scroll)
    
    // Toggle animation state - same logic as play button
    if(animPlaying){
      // Pausing - capture current accumulated time
      if (!isUserControlling) {
        const currentTime = (Date.now() - animationStartTime) * 0.0001
        accumulatedTime += currentTime
      }
      animPlaying = false
      playBtn.classList.remove('playing')
      playBtn.classList.add('paused')
    } else {
      // Resuming - capture current camera position and reset accumulated time
      const targetX = cameraTarget.x
      const targetZ = cameraTarget.z
      userCameraAngle = Math.atan2(camera.position.z - targetZ, camera.position.x - targetX)
      userCameraRadius = Math.sqrt((camera.position.x - targetX) * (camera.position.x - targetX) + (camera.position.z - targetZ) * (camera.position.z - targetZ))
      userCameraY = camera.position.y
      animationStartTime = Date.now()
      accumulatedTime = 0  // Reset accumulated time to start fresh from current position
      animPlaying = true
      
      playBtn.classList.remove('paused')
      playBtn.classList.add('playing')
    }
  }
})



////////////////////////////////////////////////////////////////////////////////
// region Animation
////////////////////////////////////////////////////////////////////////////////


playBtn.addEventListener('click', function() {

  if(animPlaying){
    // Pausing - capture current accumulated time
    if (!isUserControlling) {
      const currentTime = (Date.now() - animationStartTime) * 0.0001
      accumulatedTime += currentTime
    }
    animPlaying = false;
        this.classList.remove('playing');
    this.classList.add('paused');


  } else {
    // Resuming - capture current camera position and reset accumulated time
    const targetX = cameraTarget.x
    const targetZ = cameraTarget.z
    userCameraAngle = Math.atan2(camera.position.z - targetZ, camera.position.x - targetX)
    userCameraRadius = Math.sqrt((camera.position.x - targetX) * (camera.position.x - targetX) + (camera.position.z - targetZ) * (camera.position.z - targetZ))
    userCameraY = camera.position.y
    animationStartTime = Date.now()
    accumulatedTime = 0  // Reset accumulated time to start fresh from current position
    animPlaying = true;

    this.classList.remove('paused');
    this.classList.add('playing');
  }
  
  
});



function animate() {
  requestAnimationFrame(animate)

  controls.update()

  // Camera animation - rotate around target when user is not controlling
  if(animPlaying){
      if (!isUserControlling) {
        const currentSessionTime = (Date.now() - animationStartTime) * 0.0001
        const totalTime = accumulatedTime + currentSessionTime
        const currentAngle = userCameraAngle + totalTime * 0.5
        camera.position.x = cameraTarget.x + Math.cos(currentAngle) * userCameraRadius
        camera.position.z = cameraTarget.z + Math.sin(currentAngle) * userCameraRadius
        camera.position.y = userCameraY
        camera.lookAt(cameraTarget)
    }
  } 

  composer.render()
}



// Initialize
loadData()
animate()
