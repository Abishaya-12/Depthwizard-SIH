import './style.css'
import * as THREE from 'three'
//import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as dat from 'dat.gui'

//Texture Loader
const loader = new THREE.TextureLoader()
const texture = loader.load('/texture.jpg')
const height = loader.load('/height.jpg')
const alpha = loader.load('/alpha.jpg')
// Debug
const gui = new dat.GUI()

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// Objects
const geometry = new THREE.PlaneBufferGeometry(5, 5, 256, 256)

// Materials
const material = new THREE.MeshStandardMaterial({
    color: 'gray',
    map: texture,
    displacementMap: height,
    displacementScale: 0.2,
    alphaMap: alpha,
    transparent: true,
    depthTest: false

})
const plane = new THREE.Mesh(geometry, material)
plane.rotation.x = -Math.PI * 0.5
scene.add(plane)

gui.add(plane.position, 'x').min(-3).max(3).step(0.01).name('Plane X')
gui.add(plane.position, 'y').min(-3).max(3).step(0.01).name('Plane Height')
gui.add(plane.rotation, 'x').min(-Math.PI).max(Math.PI).step(0.01).name('Plane Tilt')
gui.add(material, 'displacementScale').min(0).max(1).step(0.01).name('Displacement')

// Mesh


// Lights

const pointLight = new THREE.PointLight('#00f5af', 6, 10, 1)
pointLight.position.x = 2
pointLight.position.y = 3
pointLight.position.z = 4
scene.add(pointLight)

gui.add(pointLight, 'intensity').min(0).max(1).step(0.01).name('Light Intensity')
gui.add(pointLight.position, 'x').min(-10).max(10).step(0.01)
gui.add(pointLight.position, 'y').min(-10).max(10).step(0.01)
gui.add(pointLight.position, 'z').min(-10).max(10).step(0.01)

const col = {color: '#ffffff'}
gui.addColor(col, 'color').onChange(() => {
    pointLight.color.set(col.color)
})
/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.x = 0
camera.position.y = 3
camera.position.z = 4
camera.lookAt(0, 0, 0)

scene.add(camera)

// Controls
// const controls = new OrbitControls(camera, canvas)
// controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

/**
 * Animate
 */

document.addEventListener('mousemove', animateTerrain)

let mouseY = 0
function animateTerrain(event){
    mouseY = event.clientY
}
const clock = new THREE.Clock()

const tick = () =>
{

    const elapsedTime = clock.getElapsedTime()
    // Update Orbital Controls
    // controls.update()
    plane.rotation.z = elapsedTime * 0.5
    plane.material.displacementScale = .3 + mouseY * 0.0008

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()