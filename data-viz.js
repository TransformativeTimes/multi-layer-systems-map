import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Scene setup
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x222222)

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 10, 20)
camera.lookAt(0, 0, 0)

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

// OrbitControls setup
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.enablePan = false

controls.touches = {
	ONE: THREE.TOUCH.ROTATE,
	TWO: THREE.TOUCH.DOLLY_PAN
}

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.9)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9)
directionalLight.position.set(10, 10, 5)
scene.add(directionalLight)

// Array to store sphere meshes with their data
const spheres = []

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
function generateValidPosition(existingSpheres, maxAttempts = 100) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const position = new THREE.Vector3(
      (Math.random() - 0.5) * 15,
      0,
      (Math.random() - 0.5) * 15
    )
    
    if (isPositionValid(position, existingSpheres)) {
      return position
    }
  }
  
  // Fallback: return a position even if it might be close to others
  return new THREE.Vector3(
    (Math.random() - 0.5) * 15,
    0,
    (Math.random() - 0.5) * 15
  )
}

// Raycaster for click detection
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

// Load and process data
async function loadData() {
  try {
    // Read the data.json file
    const response = await fetch("data.json")
    const data = await response.json()

    // Create spheres for each node
    const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 16)

    data.nodes.forEach((node, index) => {
      // Create material with random color
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(0xffffff),
      })

      // Create sphere mesh
      const sphere = new THREE.Mesh(sphereGeometry, material)

      // Generate a valid position that doesn't overlap with existing spheres
      const validPosition = generateValidPosition(spheres)
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

  } catch (error) {
    console.error("Error loading data:", error)
    // Fallback: create spheres with sample data
    createFallbackSpheres()
  }
}

// Fallback function if file reading fails
function createFallbackSpheres() {
  const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 16)

  for (let i = 1; i <= 10; i++) {
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color(Math.random(), Math.random(), Math.random()),
    })

    const sphere = new THREE.Mesh(sphereGeometry, material)

    // Generate a valid position that doesn't overlap with existing spheres
    const validPosition = generateValidPosition(spheres)
    sphere.position.copy(validPosition)

    // Remove render order modifications since we don't want spheres on top of each other
    // sphere.renderOrder = 1000
    // sphere.material.depthTest = false

    sphere.userData = { title: `This is the node #${i}.` }

    scene.add(sphere)
    spheres.push(sphere)
  }

  console.log("Using fallback data - created 10 spheres")
}

// Mouse click handler
function onMouseClick(event) {
  // Calculate mouse position in normalized device coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

  // Update raycaster
  raycaster.setFromCamera(mouse, camera)

  // Check for intersections
  const intersects = raycaster.intersectObjects(spheres)

  if (intersects.length > 0) {
    const clickedSphere = intersects[0].object
    console.log("Clicked sphere data:", clickedSphere.userData)

    // Visual feedback - make sphere briefly glow
    const originalEmissive = clickedSphere.material.emissive.getHex()
    clickedSphere.material.emissive.setHex(0xffffff)
    setTimeout(() => {
      clickedSphere.material.emissive.setHex(originalEmissive)
    }, 200)
  }
}

// Add event listener
window.addEventListener("click", onMouseClick)

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}
window.addEventListener("resize", onWindowResize)

// Animation loop
function animate() {
  requestAnimationFrame(animate)

  // Update controls
  controls.update()

  // Slowly rotate all spheres
  spheres.forEach((sphere) => {
    sphere.rotation.y += 0.01
  })

  renderer.render(scene, camera)
}

// Initialize
loadData()
animate()
