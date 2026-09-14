import * as THREE from 'three'

const DEFAULTS = { width: 14, depth: 14, segments: 160 }

function defaultTerrainHeight(x, z) {
    const crater = Math.exp(-((x + 2.3) ** 2 + (z - 0.8) ** 2) * 0.18)
    const ridge = Math.sin(x * 1.1) * 0.32 + Math.cos(z * 1.4) * 0.24
    const detail = Math.sin(x * 3.8 + z) * Math.cos(z * 3.2) * 0.12
    return (ridge + detail - crater * 0.9) * 1.8
}

function getHeightFromImage(image, width, height, segments) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(2, width)
    canvas.height = Math.max(2, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const values = []

    for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
            const index = (y * canvas.width + x) * 4
            const r = data[index]
            const g = data[index + 1]
            const b = data[index + 2]
            values.push({
                brightness: (r + g + b) / 765,
                red: r / 255,
                max: Math.max(r, g, b),
                min: Math.min(r, g, b),
            })
        }
    }

    const heightValues = new Float32Array((segments + 1) * (segments + 1))
    for (let y = 0; y <= segments; y += 1) {
        for (let x = 0; x <= segments; x += 1) {
            const sx = Math.min(canvas.width - 1, Math.floor((x / segments) * canvas.width))
            const sy = Math.min(canvas.height - 1, Math.floor((y / segments) * canvas.height))
            const pixel = values[sy * canvas.width + sx]
            const saturation = (pixel.max - pixel.min) / Math.max(pixel.max, 1)
            // Colorized DEMs use red for high elevations; grayscale DEMs use luminance.
            const sample = saturation > 0.15 ? pixel.red : pixel.brightness
            heightValues[y * (segments + 1) + x] = sample * 0.9
        }
    }

    const smoothedHeights = new Float32Array(heightValues.length)
    const side = segments + 1
    for (let y = 0; y <= segments; y += 1) {
        for (let x = 0; x <= segments; x += 1) {
            let total = 0
            let count = 0
            for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                    const sampleX = Math.max(0, Math.min(segments, x + offsetX))
                    const sampleY = Math.max(0, Math.min(segments, y + offsetY))
                    total += heightValues[sampleY * side + sampleX]
                    count += 1
                }
            }
            smoothedHeights[y * side + x] = total / count
        }
    }
    return smoothedHeights
}

function buildTerrainGeometry(options) {
    const geometry = new THREE.PlaneGeometry(options.width, options.depth, options.segments, options.segments)
    const positions = geometry.attributes.position
    const heightValues = options.heightValues || null

    for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index)
        const y = positions.getY(index)
        const value = heightValues && index < heightValues.length ? heightValues[index] : defaultTerrainHeight(x, y)
        positions.setZ(index, value)
    }
    positions.needsUpdate = true
    geometry.computeVertexNormals()
    return geometry
}

function applyHeightMap(terrain, imageSrc, options, onApplied) {
    if (!imageSrc) return

    const image = new Image()
    image.onload = () => {
        const heightValues = getHeightFromImage(image, 256, 256, options.segments)
        if (!heightValues) return

        if (terrain.geometry) terrain.geometry.dispose()
        terrain.geometry = buildTerrainGeometry({ ...options, heightValues })
        terrain.geometry.computeVertexNormals()
        terrain.geometry.needsUpdate = true
        onApplied?.()
    }
    image.src = imageSrc
}

export function createTerrainEngine(container, config = {}) {
    const options = { ...DEFAULTS, ...config }
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#050b14')
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100)

    const defaultCamera = {
        position: new THREE.Vector3(8, 7, 9),
        yaw: 0,
        pitch: -0.35,
    }

    const flyState = {
        position: defaultCamera.position.clone(),
        velocity: new THREE.Vector3(),
        yaw: defaultCamera.yaw,
        pitch: defaultCamera.pitch,
        yawTarget: defaultCamera.yaw,
        pitchTarget: defaultCamera.pitch,
        drag: false,
        lastX: 0,
        lastY: 0,
        speed: 5.5,
        boost: 1,
        keys: {},
    }

    camera.position.copy(flyState.position)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.replaceChildren(renderer.domElement)
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'

    const terrainMaterial = new THREE.MeshStandardMaterial({
        color: '#6bc8d8',
        roughness: 0.82,
        metalness: 0.05,
        wireframe: config.wireframe ?? false,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
    })

    const terrain = new THREE.Mesh(
        buildTerrainGeometry(options),
        terrainMaterial,
    )
    terrain.rotation.x = -Math.PI / 2
    scene.add(terrain)

    const grid = new THREE.GridHelper(options.width, 28, '#16879a', '#0d3745')
    grid.position.y = -1.7
    scene.add(grid)
    const sun = new THREE.DirectionalLight('#c3f5ff', 3.2)
    sun.position.set(4, 8, 5)
    scene.add(sun, new THREE.AmbientLight('#1a5260', 1.8))
    const followLight = config.mode === 'flythrough'
        ? new THREE.PointLight('#c3f5ff', 2.4, 8)
        : null
    if (followLight) scene.add(followLight)

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

    function refreshPathHeight() {
        terrain.updateMatrixWorld(true)
        const raycaster = new THREE.Raycaster()
        const rayOrigin = new THREE.Vector3()
        const rayDirection = new THREE.Vector3(0, -1, 0)
        const clearance = 1.5

        for (const point of path.points) {
            rayOrigin.set(point.x, 100, point.z)
            raycaster.set(rayOrigin, rayDirection)
            const hit = raycaster.intersectObject(terrain, false)[0]
            if (hit) point.y = hit.point.y + clearance
        }

        pathLine.geometry.dispose()
        pathLine.geometry = new THREE.BufferGeometry().setFromPoints(path.getPoints(80))
    }

    if (config.heightMap) {
        applyHeightMap(terrain, config.heightMap, options, refreshPathHeight)
    }

    const drone = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }))
    scene.add(drone)
    let frameId = 0
    let destroyed = false
    let lastFrameTime = performance.now()
    let autoRotate = config.mode !== 'flythrough'
    let speed = 0.12
    let progress = 0
    let orbit = 0

    function setCameraPreset(name = 'reset') {
        const presets = {
            reset: { position: new THREE.Vector3(8, 7, 9), yaw: 0, pitch: -0.35 },
            front: { position: new THREE.Vector3(0, 4, 12), yaw: Math.PI, pitch: -0.2 },
            top: { position: new THREE.Vector3(0, 18, 0.1), yaw: 0, pitch: -1.45 },
            orbit: { position: new THREE.Vector3(12, 9, 12), yaw: 0.8, pitch: -0.5 },
        }

        const next = presets[name] || presets.reset
        flyState.position.copy(next.position)
        flyState.yaw = next.yaw
        flyState.pitch = next.pitch
        flyState.yawTarget = next.yaw
        flyState.pitchTarget = next.pitch
        flyState.velocity.set(0, 0, 0)
        camera.position.copy(flyState.position)
        camera.lookAt(new THREE.Vector3(
            flyState.position.x + Math.sin(flyState.yaw),
            flyState.position.y + Math.sin(flyState.pitch),
            flyState.position.z + Math.cos(flyState.yaw),
        ))
    }

    function resize() {
        const width = Math.max(container.clientWidth, 1)
        const height = Math.max(container.clientHeight, 1)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height, false)
    }

    function handleFreeFly(delta) {
        if (!container || config.mode !== 'flythrough') return

        const lookSmoothing = 1 - Math.pow(0.001, delta)
        const yawDelta = Math.atan2(
            Math.sin(flyState.yawTarget - flyState.yaw),
            Math.cos(flyState.yawTarget - flyState.yaw),
        )
        flyState.yaw += yawDelta * lookSmoothing
        flyState.pitch += (flyState.pitchTarget - flyState.pitch) * lookSmoothing

        const forward = new THREE.Vector3(Math.sin(flyState.yaw), 0, Math.cos(flyState.yaw))
        const right = new THREE.Vector3(Math.cos(flyState.yaw), 0, -Math.sin(flyState.yaw))
        const up = new THREE.Vector3(0, 1, 0)

        const move = new THREE.Vector3()
        if (flyState.keys['w'] || flyState.keys['arrowup']) move.add(forward)
        if (flyState.keys['s'] || flyState.keys['arrowdown']) move.sub(forward)
        if (flyState.keys['a'] || flyState.keys['arrowleft']) move.sub(right)
        if (flyState.keys['d'] || flyState.keys['arrowright']) move.add(right)
        if (flyState.keys['q']) move.sub(up)
        if (flyState.keys['e']) move.add(up)

        const isMoving = move.lengthSq() > 0
        const isBoosting = isMoving && Boolean(flyState.keys['shift'])
        const targetVelocity = isMoving
            ? move.normalize().multiplyScalar(flyState.speed * (isBoosting ? 2.6 : 1))
            : new THREE.Vector3()
        const movementSmoothing = 1 - Math.pow(0.001, delta)
        flyState.velocity.lerp(targetVelocity, movementSmoothing)
        flyState.position.addScaledVector(flyState.velocity, delta)

        const targetFov = isBoosting ? 59 : 48
        const nextFov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.pow(0.01, delta))
        if (Math.abs(nextFov - camera.fov) > 0.001) {
            camera.fov = nextFov
            camera.updateProjectionMatrix()
        }

        camera.position.copy(flyState.position)
        const lookTarget = new THREE.Vector3(
            flyState.position.x + Math.sin(flyState.yaw) * Math.cos(flyState.pitch),
            flyState.position.y + Math.sin(flyState.pitch),
            flyState.position.z + Math.cos(flyState.yaw) * Math.cos(flyState.pitch),
        )
        camera.lookAt(lookTarget)
        drone.position.copy(flyState.position)
        if (followLight) {
            const lookDirection = lookTarget.sub(camera.position).normalize()
            followLight.position.copy(camera.position).addScaledVector(lookDirection, 0.8)
        }
    }

    function render() {
        if (destroyed) return
        const now = performance.now()
        const delta = Math.min((now - lastFrameTime) / 1000, 0.1)
        lastFrameTime = now

        if (config.mode === 'flythrough') {
            if (autoRotate) {
                progress = (progress + speed * 0.001) % 1
                const point = path.getPointAt(progress)
                camera.position.lerp(point.clone().add(new THREE.Vector3(0, 1.8, 0)), 0.08)
                camera.lookAt(path.getPointAt((progress + 0.015) % 1))
                drone.position.copy(point)
            } else {
                handleFreeFly(delta)
            }
        } else if (autoRotate) {
            orbit += 0.0025
            camera.position.set(Math.cos(orbit) * 10, 7, Math.sin(orbit) * 10)
            camera.lookAt(0, 0, 0)
        }

        renderer.render(scene, camera)
        frameId = window.requestAnimationFrame(render)
    }

    const keyHandler = (event) => {
        const key = event.key.toLowerCase()
        if (key === 'w' || key === 'a' || key === 's' || key === 'd' || key === 'q' || key === 'e' || key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright' || key === 'shift') {
            flyState.keys[key] = event.type === 'keydown'
            if (event.type === 'keydown') event.preventDefault()
        }
    }

    const mouseDown = (event) => {
        if (config.mode !== 'flythrough') return
        flyState.drag = true
        flyState.lastX = event.clientX
        flyState.lastY = event.clientY
    }

    const mouseMove = (event) => {
        if (!flyState.drag || config.mode !== 'flythrough') return
        const dx = event.clientX - flyState.lastX
        const dy = event.clientY - flyState.lastY
        flyState.lastX = event.clientX
        flyState.lastY = event.clientY

        flyState.yawTarget -= dx * 0.0015
        flyState.pitchTarget = THREE.MathUtils.clamp(flyState.pitchTarget - dy * 0.0012, -1.45, 1.45)
    }

    const mouseUp = () => {
        flyState.drag = false
    }

    container.addEventListener('keydown', keyHandler)
    container.addEventListener('keyup', keyHandler)
    container.addEventListener('mousedown', mouseDown)
    container.addEventListener('mousemove', mouseMove)
    window.addEventListener('mouseup', mouseUp)

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()
    render()

    return {
        scene, camera, renderer, terrain, path,
        update(next = {}) {
            if (typeof next.autoRotate === 'boolean') {
                autoRotate = next.autoRotate
                pathLine.visible = autoRotate
                drone.visible = autoRotate
            }
            if (typeof next.speed === 'number') speed = Math.max(0, next.speed)
            if (typeof next.wireframe === 'boolean') terrain.material.wireframe = next.wireframe
            if (typeof next.displacementScale === 'number') terrain.scale.z = next.displacementScale
            if (next.cameraPreset) setCameraPreset(next.cameraPreset)
            if (next.resetCamera) setCameraPreset('reset')
            if (next.cameraState) {
                flyState.position.copy(next.cameraState.position || flyState.position)
                flyState.yaw = next.cameraState.yaw ?? flyState.yaw
                flyState.pitch = next.cameraState.pitch ?? flyState.pitch
                flyState.yawTarget = flyState.yaw
                flyState.pitchTarget = flyState.pitch
                flyState.velocity.set(0, 0, 0)
            }
        },
        destroy() {
            destroyed = true
            window.cancelAnimationFrame(frameId)
            resizeObserver.disconnect()
            container.removeEventListener('keydown', keyHandler)
            container.removeEventListener('keyup', keyHandler)
            container.removeEventListener('mousedown', mouseDown)
            container.removeEventListener('mousemove', mouseMove)
            window.removeEventListener('mouseup', mouseUp)
            terrain.geometry.dispose()
            terrain.material.dispose()
            pathLine.geometry.dispose()
            pathLine.material.dispose()
            if (followLight) {
                scene.remove(followLight)
                followLight.shadow.map?.dispose()
            }
            renderer.dispose()
            container.replaceChildren()
        },
    }
}

const legacyCanvas = document.querySelector('canvas.webgl')
if (legacyCanvas?.parentElement) createTerrainEngine(legacyCanvas.parentElement, { mode: 'viewer' })