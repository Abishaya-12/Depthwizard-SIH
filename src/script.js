import * as THREE from 'three'

const DEFAULTS = { width: 14, depth: 14, segments: 160 }

function terrainHeight(x, z) {
    const crater = Math.exp(-((x + 2.3) ** 2 + (z - 0.8) ** 2) * 0.18)
    const ridge = Math.sin(x * 1.1) * 0.32 + Math.cos(z * 1.4) * 0.24
    const detail = Math.sin(x * 3.8 + z) * Math.cos(z * 3.2) * 0.12
    return (ridge + detail - crater * 0.9) * 1.8
}

function buildTerrainGeometry(options) {
    const geometry = new THREE.PlaneGeometry(options.width, options.depth, options.segments, options.segments)
    const positions = geometry.attributes.position
    for (let index = 0; index < positions.count; index += 1) {
        positions.setZ(index, terrainHeight(positions.getX(index), positions.getY(index)))
    }
    positions.needsUpdate = true
    geometry.computeVertexNormals()
    return geometry
}

export function createTerrainEngine(container, config = {}) {
    const options = { ...DEFAULTS, ...config }
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#050b14')
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100)
    camera.position.set(8, 7, 9)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.replaceChildren(renderer.domElement)
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'

    const terrain = new THREE.Mesh(
        buildTerrainGeometry(options),
        new THREE.MeshStandardMaterial({ color: '#6bc8d8', roughness: 0.82, metalness: 0.05, wireframe: config.wireframe ?? false }),
    )
    terrain.rotation.x = -Math.PI / 2
    scene.add(terrain)

    const grid = new THREE.GridHelper(options.width, 28, '#16879a', '#0d3745')
    grid.position.y = -1.7
    scene.add(grid)
    const sun = new THREE.DirectionalLight('#c3f5ff', 3.2)
    sun.position.set(4, 8, 5)
    scene.add(sun, new THREE.AmbientLight('#1a5260', 1.8))

    const path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-5, 2.5, 5), new THREE.Vector3(-2, 2, 2),
        new THREE.Vector3(1, 2.3, 0), new THREE.Vector3(3, 2.1, -2),
        new THREE.Vector3(5, 2.8, -5),
    ])
    const pathLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(path.getPoints(80)),
        new THREE.LineBasicMaterial({ color: '#00e5ff', transparent: true, opacity: 0.8 }),
    )
    pathLine.position.y = 0.15
    scene.add(pathLine)

    const drone = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }))
    scene.add(drone)
    let frameId = 0
    let destroyed = false
    let autoRotate = config.mode !== 'flythrough'
    let speed = 0.04
    let progress = 0
    let orbit = 0

    function resize() {
        const width = Math.max(container.clientWidth, 1)
        const height = Math.max(container.clientHeight, 1)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height, false)
    }

    function render() {
        if (destroyed) return
        if (config.mode === 'flythrough' && autoRotate) {
            progress = (progress + speed * 0.001) % 1
            const point = path.getPointAt(progress)
            camera.position.lerp(point.clone().add(new THREE.Vector3(0, 1.8, 0)), 0.08)
            camera.lookAt(path.getPointAt((progress + 0.015) % 1))
            drone.position.copy(point)
        } else if (config.mode !== 'flythrough' && autoRotate) {
            orbit += 0.0025
            camera.position.set(Math.cos(orbit) * 10, 7, Math.sin(orbit) * 10)
            camera.lookAt(0, 0, 0)
        }
        renderer.render(scene, camera)
        frameId = window.requestAnimationFrame(render)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()
    render()

    return {
        scene, camera, renderer, terrain, path,
        update(next = {}) {
            if (typeof next.autoRotate === 'boolean') autoRotate = next.autoRotate
            if (typeof next.speed === 'number') speed = Math.max(0, next.speed)
            if (typeof next.wireframe === 'boolean') terrain.material.wireframe = next.wireframe
            if (typeof next.displacementScale === 'number') terrain.scale.y = next.displacementScale
        },
        destroy() {
            destroyed = true
            window.cancelAnimationFrame(frameId)
            resizeObserver.disconnect()
            terrain.geometry.dispose()
            terrain.material.dispose()
            pathLine.geometry.dispose()
            pathLine.material.dispose()
            renderer.dispose()
            container.replaceChildren()
        },
    }
}

const legacyCanvas = document.querySelector('canvas.webgl')
if (legacyCanvas?.parentElement) createTerrainEngine(legacyCanvas.parentElement, { mode: 'viewer' })