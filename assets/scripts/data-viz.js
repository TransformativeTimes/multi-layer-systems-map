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

// Animation control variables
let isUserControlling = false
let lastInteractionTime = 0
let animationTimeout
let animationStartTime = 0
let userCameraAngle = 0
let userCameraRadius = 25
let userCameraY = 10
let cameraTarget = new THREE.Vector3(0, 0, 0)


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
// region Rendering nodes
////////////////////////////////////////////////////////////////////////////////

// Array to store sphere meshes with their data
const spheres = []
let sphereRadius = 0.25

// Array to store connection lines
const connections = []

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

// Raycaster for click detection
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

// Global variable to track the current popup
let nodePopup = null
let currentlyHighlightedSphere = null
let currentlyHoveredSphere = null

// Function to reset all sphere colors to original state
function resetAllSphereColors() {
  spheres.forEach((sphere) => {
    sphere.material.emissive.setHex(0xffffff)
    sphere.material.color.set(0xffffff)
  })
  currentlyHighlightedSphere = null
}

// Function to handle sphere hover effects
function handleSphereHover(hoveredSphere) {
  // Reset previously hovered sphere if it's different and not currently highlighted
  if (currentlyHoveredSphere && currentlyHoveredSphere !== hoveredSphere && currentlyHoveredSphere !== currentlyHighlightedSphere) {
    currentlyHoveredSphere.material.emissive.setHex(0xffffff)
    currentlyHoveredSphere.material.color.set(0xffffff)
  }

  // Apply hover effect to new sphere (only if it's not already highlighted)
  if (hoveredSphere && hoveredSphere !== currentlyHighlightedSphere) {
    hoveredSphere.material.emissive.setHex(0x9FF2C8)
    hoveredSphere.material.color.set(0x9FF2C8)
  }

  currentlyHoveredSphere = hoveredSphere
}

// Function to reset hover effects
function resetHoverEffects() {
  if (currentlyHoveredSphere && currentlyHoveredSphere !== currentlyHighlightedSphere) {
    currentlyHoveredSphere.material.emissive.setHex(0xffffff)
    currentlyHoveredSphere.material.color.set(0xffffff)
  }
  currentlyHoveredSphere = null
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



function navigation(data) {

  // Draw all layers
  const navContainer = document.createElement('div')
  navContainer.classList.add('nav-container')

  const layersUl = document.createElement('ul')
  layersUl.classList.add('layers-container')


  data.layers.forEach(layer => {

    let li = document.createElement('li')

    li.innerHTML = `${layer.name}`
    layersUl.appendChild(li)

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

    tagsUl.appendChild(li)
  })


  
  document.body.appendChild(navContainer)
  navContainer.appendChild(layersUl)
  navContainer.appendChild(tagsUl)
}





////////////////////////////////////////////////////////////////////////////////
// region Mouse click events
////////////////////////////////////////////////////////////////////////////////

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

    // Remove existing popup if it exists
    if (nodePopup) {
      nodePopup.remove()
      nodePopup = null
    }

    // Reset all sphere colors first
    resetAllSphereColors()

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
    })
  } else {
    // Clicked on canvas but not on any sphere - close popup if it exists
    if (nodePopup) {
      nodePopup.remove()
      nodePopup = null
      // Reset sphere colors when popup closes
      resetAllSphereColors()
    }
  }
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
    handleSphereHover(hoveredSphere)
  } else {
    // No sphere is being hovered, reset hover effects
    resetHoverEffects()
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
    isUserControlling = false
  }, 0) // Time to restart the camera rotation animation
})


////////////////////////////////////////////////////////////////////////////////
// region Window resize
////////////////////////////////////////////////////////////////////////////////

// Handle window resize
function onWindowResize() {
  const width = container.clientWidth
  const height = container.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
  composer.setSize(width, height)
}
window.addEventListener("resize", onWindowResize)



////////////////////////////////////////////////////////////////////////////////
// region Animation
////////////////////////////////////////////////////////////////////////////////

// Animation loop
function animate() {
  requestAnimationFrame(animate)

  // Update controls
  controls.update()

  // Camera animation - rotate around target when user is not controlling
  if (!isUserControlling) {
    const timeSinceStart = (Date.now() - animationStartTime) * 0.0001
    const currentAngle = userCameraAngle + timeSinceStart * 0.5
    camera.position.x = cameraTarget.x + Math.cos(currentAngle) * userCameraRadius
    camera.position.z = cameraTarget.z + Math.sin(currentAngle) * userCameraRadius
    camera.position.y = userCameraY
    camera.lookAt(cameraTarget)
  }


  composer.render()
}

// Initialize
loadData()
animate()
