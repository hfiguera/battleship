import * as THREE from "three"

const CELL = 1.15
const HALF = 5 * CELL
const FLIGHT = 680
const BEAT = 400

function parseCell(label) {
  const col = label.charCodeAt(0) - 65
  const row = Number(label.slice(1))
  return {col, row}
}

function originFor(side) {
  return side === "yours" ? -6.6 : 6.6
}

function point(originX, label) {
  const {col, row} = parseCell(label)
  return new THREE.Vector3(originX + (col - 4.5) * CELL, 0, (row - 5.5) * CELL)
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext("2d"), width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function waterTexture() {
  return canvasTexture(512, 512, (ctx, size) => {
    const wash = ctx.createLinearGradient(0, 0, size, size)
    wash.addColorStop(0, "#2f93d6")
    wash.addColorStop(0.45, "#1b74c4")
    wash.addColorStop(1, "#1564b4")
    ctx.fillStyle = wash
    ctx.fillRect(0, 0, size, size)

    for (let i = 0; i < 90; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const radius = 10 + Math.random() * 36
      const blob = ctx.createRadialGradient(x, y, 0, x, y, radius)
      blob.addColorStop(0, "rgba(210, 245, 255, 0.34)")
      blob.addColorStop(1, "rgba(210, 245, 255, 0)")
      ctx.fillStyle = blob
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

function causticTexture() {
  const texture = canvasTexture(256, 256, (ctx, size) => {
    ctx.clearRect(0, 0, size, size)
    ctx.strokeStyle = "rgba(230, 250, 255, 0.55)"
    ctx.lineWidth = 2
    for (let i = 0; i < 18; i++) {
      ctx.beginPath()
      let x = Math.random() * size
      let y = Math.random() * size
      ctx.moveTo(x, y)
      for (let step = 0; step < 4; step++) {
        x += -30 + Math.random() * 60
        y += -30 + Math.random() * 60
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  })
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(3, 3)
  return texture
}

function radialTexture(stops) {
  return canvasTexture(64, 64, (ctx) => {
    const paint = ctx.createRadialGradient(32, 34, 2, 32, 32, 30)
    for (const [offset, color] of stops) paint.addColorStop(offset, color)
    ctx.fillStyle = paint
    ctx.fillRect(0, 0, 64, 64)
  })
}

function flatLabel(text, width, height, font) {
  const texture = canvasTexture(width, height, (ctx) => {
    ctx.fillStyle = "#ffffff"
    ctx.font = font
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(text, width / 2, height / 2)
  })
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width / height, 1),
    new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false})
  )
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

function steel(color) {
  return new THREE.MeshStandardMaterial({color, roughness: 0.42, metalness: 0.62})
}

function addMesh(group, geometry, material, position) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  if (position) mesh.position.set(position.x, position.y, position.z)
  group.add(mesh)
  return mesh
}

function makeShip(name, length) {
  const group = new THREE.Group()
  const hull = steel(0xa7b0b8)
  const deck = steel(0x6d767e)
  const gun = steel(0xd5dbe0)
  const boot = steel(0x3e4650)
  // Centered on the occupied squares. A small gap at each end keeps the
  // hull inside those squares and leaves the grid lines readable.
  const span = length * CELL * 0.9
  const half = span / 2
  const beam =
    name === "carrier" ? CELL * 0.58 : name === "submarine" ? CELL * 0.26 : name === "destroyer" ? CELL * 0.32 : CELL * 0.4

  if (name === "submarine") {
    const radius = 0.13
    const body = addMesh(group, new THREE.CapsuleGeometry(radius, span - radius * 2, 6, 12), hull)
    body.rotation.z = Math.PI / 2
    body.position.y = 0.18
    addMesh(group, new THREE.BoxGeometry(0.06, 0.04, beam * 1.15), deck, {x: half * 0.5, y: 0.18, z: 0})
    addMesh(group, new THREE.BoxGeometry(0.06, 0.04, beam * 0.95), deck, {x: -half * 0.55, y: 0.18, z: 0})
    addMesh(group, new THREE.BoxGeometry(0.05, 0.16, 0.03), deck, {x: -half + 0.06, y: 0.22, z: 0})
    const sailW = Math.min(0.24, span * 0.16)
    addMesh(group, new THREE.BoxGeometry(sailW, 0.24, 0.15), deck, {x: 0, y: 0.36, z: 0})
    addMesh(group, new THREE.BoxGeometry(sailW * 0.7, 0.045, 0.16), gun, {x: 0, y: 0.4, z: 0})
    addMesh(group, new THREE.BoxGeometry(0.12, 0.07, 0.11), gun, {x: 0.02, y: 0.5, z: 0})
    addMesh(group, new THREE.CylinderGeometry(0.028, 0.028, 0.24, 6), gun, {x: 0.06, y: 0.58, z: 0.03})
    addMesh(group, new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6), gun, {x: -0.02, y: 0.54, z: -0.03})
    return group
  }

  const bowLen = Math.min(CELL * 0.52, span * 0.26)
  const bodyLen = span - bowLen
  const bodyX = -half + bodyLen / 2
  const bow = addMesh(group, new THREE.ConeGeometry(beam * 0.5, bowLen, 4), hull)
  bow.rotation.z = -Math.PI / 2
  bow.position.set(half - bowLen / 2, 0.15, 0)
  addMesh(group, new THREE.BoxGeometry(bodyLen, 0.16, beam), hull, {x: bodyX, y: 0.15, z: 0})
  addMesh(group, new THREE.BoxGeometry(bodyLen * 0.98, 0.035, beam * 1.04), boot, {x: bodyX, y: 0.08, z: 0})
  addMesh(group, new THREE.BoxGeometry(bodyLen * 0.9, 0.03, beam * 0.82), deck, {x: bodyX, y: 0.245, z: 0})
  addRails(group, bodyLen * 0.84, beam * 0.42, 0.28, gun, bodyX)

  const stern = -half + span * 0.14
  const mid = -half + span * 0.48
  const fore = half - bowLen - span * 0.06

  if (name === "carrier") {
    const deckW = Math.min(beam * 1.12, CELL * 0.78)
    addMesh(group, new THREE.BoxGeometry(span * 0.92, 0.05, deckW), deck, {x: 0, y: 0.29, z: 0})
    addMesh(group, new THREE.BoxGeometry(span * 0.8, 0.015, 0.05), gun, {x: 0, y: 0.325, z: 0})
    addMesh(group, new THREE.BoxGeometry(span * 0.1, 0.02, deckW * 0.42), boot, {x: span * 0.24, y: 0.33, z: 0})
    addMesh(group, new THREE.BoxGeometry(span * 0.1, 0.02, deckW * 0.42), boot, {x: -span * 0.3, y: 0.33, z: 0})
    for (const x of [-span * 0.22, span * 0.02, span * 0.2]) addPlane(group, x, -deckW * 0.16, gun)
    const islandZ = deckW * 0.28
    addMesh(group, new THREE.BoxGeometry(span * 0.12, 0.28, 0.18), gun, {x: -span * 0.08, y: 0.47, z: islandZ})
    addMesh(group, new THREE.BoxGeometry(span * 0.07, 0.09, 0.13), hull, {x: -span * 0.08, y: 0.64, z: islandZ})
    addMesh(group, new THREE.CylinderGeometry(0.045, 0.055, 0.16, 7), deck, {x: -span * 0.03, y: 0.6, z: islandZ})
    addMesh(group, new THREE.CylinderGeometry(0.02, 0.02, 0.34, 6), gun, {x: -span * 0.12, y: 0.72, z: islandZ})
    addMesh(group, new THREE.BoxGeometry(0.2, 0.025, 0.025), gun, {x: -span * 0.12, y: 0.86, z: islandZ})
    addDish(group, -span * 0.08, 0.74, islandZ, gun)
    const crane = addMesh(group, new THREE.BoxGeometry(span * 0.14, 0.025, 0.025), gun, {
      x: span * 0.02,
      y: 0.52,
      z: islandZ * 0.55
    })
    crane.rotation.z = 0.4
  } else if (name === "battleship") {
    addMesh(group, new THREE.BoxGeometry(span * 0.16, 0.2, beam * 0.55), deck, {x: mid, y: 0.36, z: 0})
    addMesh(group, new THREE.BoxGeometry(span * 0.08, 0.08, beam * 0.4), gun, {x: mid, y: 0.48, z: 0})
    addMesh(group, new THREE.CylinderGeometry(0.05, 0.065, 0.16, 7), deck, {x: mid - span * 0.1, y: 0.38, z: 0})
    addTurret(group, fore, gun, 0.32, 1)
    addTurret(group, stern, gun, 0.32, 0.9)
    addSecondary(group, mid - span * 0.16, beam * 0.32, gun)
    addSecondary(group, mid - span * 0.16, -beam * 0.32, gun)
    addBoat(group, mid + span * 0.14, beam * 0.34, hull)
    addBoat(group, mid + span * 0.14, -beam * 0.34, hull)
    addMesh(group, new THREE.CylinderGeometry(0.02, 0.02, 0.38, 6), gun, {x: mid, y: 0.64, z: 0})
    addMesh(group, new THREE.BoxGeometry(0.18, 0.025, 0.025), gun, {x: mid, y: 0.8, z: 0})
    addDish(group, mid, 0.72, 0, gun)
  } else if (name === "cruiser") {
    addMesh(group, new THREE.BoxGeometry(span * 0.16, 0.18, beam * 0.5), deck, {x: mid, y: 0.35, z: 0})
    addMesh(group, new THREE.BoxGeometry(span * 0.07, 0.07, beam * 0.36), gun, {x: mid, y: 0.46, z: 0})
    addMesh(group, new THREE.CylinderGeometry(0.04, 0.05, 0.14, 7), deck, {x: mid - span * 0.1, y: 0.36, z: 0})
    addTurret(group, fore, gun, 0.32, 0.85)
    addTurret(group, stern, gun, 0.3, 0.55)
    addSecondary(group, mid - span * 0.18, beam * 0.3, gun)
    addSecondary(group, mid - span * 0.18, -beam * 0.3, gun)
    addBoat(group, mid + span * 0.14, beam * 0.32, hull)
    addBoat(group, mid + span * 0.14, -beam * 0.32, hull)
    addMesh(group, new THREE.CylinderGeometry(0.018, 0.018, 0.32, 6), gun, {x: mid, y: 0.58, z: 0})
    addDish(group, mid, 0.66, 0, gun)
  } else {
    addMesh(group, new THREE.BoxGeometry(span * 0.18, 0.14, beam * 0.48), deck, {x: mid, y: 0.31, z: 0})
    addMesh(group, new THREE.CylinderGeometry(0.032, 0.04, 0.1, 6), deck, {x: mid - span * 0.08, y: 0.32, z: 0})
    addTurret(group, fore, gun, 0.3, 0.65)
    addTurret(group, stern, gun, 0.28, 0.45)
    addBoat(group, mid + span * 0.08, beam * 0.28, hull)
    addCharges(group, -half + span * 0.08, gun)
    addMesh(group, new THREE.CylinderGeometry(0.016, 0.016, 0.26, 5), gun, {x: mid, y: 0.48, z: 0})
    addDish(group, mid, 0.56, 0, gun)
  }

  return group
}

function addRails(group, length, offset, y, material, x) {
  addMesh(group, new THREE.BoxGeometry(length, 0.025, 0.025), material, {x, y, z: offset})
  addMesh(group, new THREE.BoxGeometry(length, 0.025, 0.025), material, {x, y, z: -offset})
}

function addBoat(group, x, z, material) {
  addMesh(group, new THREE.BoxGeometry(0.22, 0.05, 0.08), material, {x, y: 0.31, z})
}

function addPlane(group, x, z, material) {
  addMesh(group, new THREE.BoxGeometry(0.28, 0.03, 0.06), material, {x, y: 0.35, z})
  addMesh(group, new THREE.BoxGeometry(0.08, 0.02, 0.24), material, {x: x + 0.02, y: 0.37, z})
}

function addDish(group, x, y, z, material) {
  addMesh(group, new THREE.CylinderGeometry(0.07, 0.07, 0.02, 8), material, {x, y, z})
}

function addSecondary(group, x, z, material) {
  addMesh(group, new THREE.CylinderGeometry(0.045, 0.055, 0.06, 6), material, {x, y: 0.3, z})
  addMesh(group, new THREE.BoxGeometry(0.14, 0.028, 0.028), material, {x: x + 0.08, y: 0.32, z})
}

function addCharges(group, x, material) {
  for (const z of [-0.07, 0.07]) {
    const can = addMesh(group, new THREE.CylinderGeometry(0.045, 0.045, 0.08, 8), material, {x, y: 0.29, z})
    can.rotation.z = Math.PI / 2
  }
}

function addTurret(group, x, material, y, scale) {
  addMesh(group, new THREE.CylinderGeometry(0.11 * scale, 0.14 * scale, 0.09 * scale, 8), material, {x, y, z: 0})
  const barrel = 0.26 * scale
  const thick = 0.04 * scale
  addMesh(group, new THREE.BoxGeometry(barrel, thick, thick), material, {
    x: x + barrel * 0.42,
    y: y + 0.03 * scale,
    z: 0.05 * scale
  })
  addMesh(group, new THREE.BoxGeometry(barrel, thick, thick), material, {
    x: x + barrel * 0.42,
    y: y + 0.03 * scale,
    z: -0.05 * scale
  })
}

function makeMissile(trailMap) {
  const group = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.055, 0.5, 8),
    steel(0xe7ebef)
  )
  body.rotation.x = -Math.PI / 2
  group.add(body)

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 8), steel(0xfff6ea))
  nose.rotation.x = -Math.PI / 2
  nose.position.z = -0.32
  group.add(nose)

  const trail = new THREE.Sprite(
    new THREE.SpriteMaterial({map: trailMap, transparent: true, depthWrite: false})
  )
  trail.position.z = 0.55
  trail.scale.set(1.5, 0.32, 1)
  group.add(trail)
  return group
}

function scorch() {
  const tile = new THREE.Mesh(
    new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.92),
    new THREE.MeshBasicMaterial({color: 0xe10600, transparent: true, opacity: 0.92})
  )
  tile.rotation.x = -Math.PI / 2
  tile.position.y = 0.035
  return tile
}

export default {
  mounted() {
    this.ships = []
    this.fx = []
    this.queue = []
    this.arming = false
    this.holdUntil = 0
    this.burning = new Set()
    this.concealAdmiral = true
    this.orbit = {theta: 0.16, phi: 0.78, radius: 36}

    this.waterMap = waterTexture()
    this.causticMap = causticTexture()
    this.fireMap = radialTexture([
      [0, "rgba(255, 244, 210, 1)"],
      [0.28, "rgba(255, 150, 20, 0.95)"],
      [0.62, "rgba(210, 30, 0, 0.55)"],
      [1, "rgba(0, 0, 0, 0)"]
    ])
    this.smokeMap = radialTexture([
      [0, "rgba(220, 220, 220, 0.7)"],
      [0.45, "rgba(90, 90, 90, 0.45)"],
      [1, "rgba(0, 0, 0, 0)"]
    ])
    this.trailMap = radialTexture([
      [0, "rgba(255, 220, 120, 1)"],
      [0.4, "rgba(255, 70, 0, 0.7)"],
      [1, "rgba(0, 0, 0, 0)"]
    ])
    this.sharedMaps = new Set([this.waterMap, this.causticMap, this.fireMap, this.smokeMap, this.trailMap])

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000000)

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 180)
    this.placeCamera()

    this.renderer = new THREE.WebGLRenderer({antialias: true})
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.el.appendChild(this.renderer.domElement)

    this.scene.add(new THREE.AmbientLight(0xd5e4f5, 0.95))
    this.scene.add(new THREE.HemisphereLight(0x9fd0ff, 0x0b2340, 0.45))
    const sun = new THREE.DirectionalLight(0xfff8ee, 1.7)
    sun.position.set(-8, 16, 10)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -20
    sun.shadow.camera.right = 20
    sun.shadow.camera.top = 16
    sun.shadow.camera.bottom = -16
    sun.shadow.camera.near = 2
    sun.shadow.camera.far = 40
    sun.shadow.bias = -0.0004
    this.scene.add(sun)

    this.root = new THREE.Group()
    this.scene.add(this.root)

    this.resize = () => this.fit()
    this.resize()
    window.addEventListener("resize", this.resize)
    this.bindOrbit()
    this.frame = requestAnimationFrame(() => this.draw())

    this.handleEvent("setup", (board) => this.build(board))
    this.handleEvent("shot", (shot) => this.incoming(shot))
    this.handleEvent("fleet", ({conceal}) => {
      this.concealAdmiral = conceal === true
      this.applyFleet()
    })
    this.pushEvent("board_ready", {})
  },

  destroyed() {
    cancelAnimationFrame(this.frame)
    window.removeEventListener("resize", this.resize)
    this.renderer.dispose()
  },

  placeCamera() {
    const {theta, phi, radius} = this.orbit
    this.camera.position.set(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.cos(theta)
    )
    this.camera.lookAt(0, 0, 0)
  },

  bindOrbit() {
    const el = this.renderer.domElement
    el.style.touchAction = "none"
    el.style.cursor = "grab"

    el.addEventListener("pointerdown", (event) => {
      this.drag = {x: event.clientX, y: event.clientY, ...this.orbit}
      el.style.cursor = "grabbing"
      el.setPointerCapture(event.pointerId)
    })
    el.addEventListener("pointermove", (event) => {
      if (!this.drag) return
      this.orbit.theta = this.drag.theta - (event.clientX - this.drag.x) * 0.005
      this.orbit.phi = Math.min(1.25, Math.max(0.28, this.drag.phi + (event.clientY - this.drag.y) * 0.003))
      this.placeCamera()
    })
    const release = () => {
      this.drag = null
      el.style.cursor = "grab"
    }
    el.addEventListener("pointerup", release)
    el.addEventListener("pointercancel", release)
    el.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault()
        this.orbit.radius = Math.min(48, Math.max(14, this.orbit.radius + event.deltaY * 0.02))
        this.placeCamera()
      },
      {passive: false}
    )
  },

  fit() {
    const width = this.el.clientWidth || 800
    const height = this.el.clientHeight || 600
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.frameBoards()
  },

  frameBoards() {
    const aspect = Math.max(this.camera.aspect || 1, 0.4)
    const vFov = (this.camera.fov * Math.PI) / 180
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
    const span = 15.4
    this.orbit.radius = (span / Math.sin(Math.min(vFov, hFov) / 2)) * 0.9
    this.placeCamera()
  },

  draw() {
    this.frame = requestAnimationFrame(() => this.draw())
    const now = performance.now()
    this.causticMap.offset.x = (now * 0.00002) % 1
    this.causticMap.offset.y = (now * 0.000015) % 1
    this.fx = this.fx.filter((fx) => this.tick(fx, now))
    if (this.holdUntil && now >= this.holdUntil) {
      this.holdUntil = 0
      this.arming = false
      this.pump()
    }
    this.renderer.render(this.scene, this.camera)
  },

  tick(fx, now) {
    if (fx.kind === "missile") return this.tickMissile(fx, now)
    const age = (now - fx.born) / 1000
    if (fx.kind === "fire") {
      const pulse = 0.85 + Math.sin(now * 0.014 + fx.phase) * 0.18
      fx.object.scale.set(1.55 * pulse, 2.35 * pulse, 1)
      return true
    }
    if (fx.kind === "smoke") {
      const loop = 3.2
      const unit = (age % loop) / loop
      fx.object.position.y = 1.55 + unit * 2.4
      fx.object.material.opacity = 0.2 + (1 - unit) * 0.65
      fx.object.scale.setScalar(1.4 + unit * 1.7)
      return fx.persist || age < loop
    }
    if (fx.kind === "burst") {
      const unit = Math.min(1, age / 0.45)
      fx.object.scale.setScalar(0.4 + unit * 1.5)
      fx.object.material.opacity = 1 - unit
      if (unit < 1) return true
      this.root.remove(fx.object)
      fx.object.material.dispose()
      return false
    }
    return false
  },

  tickMissile(fx, now) {
    const t = Math.min(1, (now - fx.born) / fx.duration)
    const pos = fx.from.clone().lerp(fx.to, t)
    pos.y += Math.sin(t * Math.PI) * 1.7
    fx.object.position.copy(pos)
    const ahead = fx.from.clone().lerp(fx.to, Math.min(1, t + 0.08))
    ahead.y += Math.sin(Math.min(1, t + 0.08) * Math.PI) * 1.7
    fx.object.lookAt(ahead)
    if (t < 1) return true
    this.root.remove(fx.object)
    this.disposeNode(fx.object)
    this.impact(fx.shot)
    this.holdUntil = now + BEAT
    return false
  },

  build(board) {
    this.disposeNode(this.root)
    this.root.clear()
    this.ships = []
    this.fx = []
    this.queue = []
    this.arming = false
    this.holdUntil = 0
    this.burning = new Set()
    this.addBoard(this.root, -6.6, "YOUR FLEET")
    this.addBoard(this.root, 6.6, "ADMIRAL'S FLEET")
    for (const ship of board.yours || []) this.addShip(this.root, "yours", ship)
    for (const ship of board.theirs || []) this.addShip(this.root, "theirs", ship)
    for (const shot of board.shots || []) this.impact(shot)
    for (const ship of this.ships) {
      const burning = ship.cells.every((label) => this.burning.has(`${ship.side}:${label}`))
      if (burning) this.sink(ship)
    }
    this.applyFleet()
  },

  applyFleet() {
    for (const ship of this.ships) {
      const struck = ship.cells.some((label) => this.burning.has(`${ship.side}:${label}`))
      ship.group.visible = ship.side !== "theirs" || !this.concealAdmiral || struck
    }
  },

  addBoard(group, originX, title) {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(CELL * 10, CELL * 10),
      new THREE.MeshStandardMaterial({map: this.waterMap, roughness: 0.28, metalness: 0.08})
    )
    water.rotation.x = -Math.PI / 2
    water.position.set(originX, 0, 0)
    water.receiveShadow = true
    group.add(water)

    const shine = new THREE.Mesh(
      new THREE.PlaneGeometry(CELL * 10, CELL * 10),
      new THREE.MeshBasicMaterial({
        map: this.causticMap,
        transparent: true,
        opacity: 0.28,
        depthWrite: false
      })
    )
    shine.rotation.x = -Math.PI / 2
    shine.position.set(originX, 0.02, 0)
    group.add(shine)

    const lines = []
    for (let i = 0; i <= 10; i++) {
      const offset = (i - 5) * CELL
      lines.push(originX - HALF, 0.03, offset, originX + HALF, 0.03, offset)
      lines.push(originX + offset, 0.03, -HALF, originX + offset, 0.03, HALF)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3))
    group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color: 0xffffff})))

    const heading = flatLabel(title, 768, 112, "700 52px sans-serif")
    heading.position.set(originX, 0.04, -HALF - 0.85)
    heading.scale.set(0.82, 0.82, 1)
    group.add(heading)

    for (let col = 0; col < 10; col++) {
      const marker = flatLabel(String.fromCharCode(65 + col), 128, 128, "700 78px sans-serif")
      marker.scale.set(0.5, 0.5, 1)
      marker.position.set(originX + (col - 4.5) * CELL, 0.04, HALF + 0.48)
      group.add(marker)
    }

    const numbersOnRight = originX > 0
    for (let row = 1; row <= 10; row++) {
      const marker = flatLabel(String(row), 128, 128, "700 72px sans-serif")
      marker.scale.set(0.48, 0.48, 1)
      marker.position.set(originX + (numbersOnRight ? HALF + 0.5 : -HALF - 0.5), 0.04, (row - 5.5) * CELL)
      group.add(marker)
    }
  },

  addShip(group, side, ship) {
    const cells = ship.cells.map(parseCell)
    const horizontal = cells.every((cell) => cell.row === cells[0].row)
    const col = cells.reduce((sum, cell) => sum + cell.col, 0) / cells.length
    const row = cells.reduce((sum, cell) => sum + cell.row, 0) / cells.length
    const mesh = makeShip(ship.name, ship.cells.length)
    if (!horizontal) mesh.rotation.y = Math.PI / 2
    mesh.position.set(originFor(side) + (col - 4.5) * CELL, 0, (row - 5.5) * CELL)
    group.add(mesh)
    this.ships.push({side, name: ship.name, cells: ship.cells, group: mesh, sunk: false})
  },

  incoming(shot) {
    if (!shot.coordinate || shot.result === "invalid" || shot.result === "over") return
    this.queue.push(shot)
    this.pump()
  },

  pump() {
    if (this.arming || this.queue.length === 0) return
    this.arming = true
    this.launch(this.queue.shift())
  },

  launch(shot) {
    const at = point(originFor(shot.side), shot.coordinate)
    const from = at.clone()
    from.x += shot.side === "yours" ? 5.2 : -5.2
    from.y = 1.4
    from.z -= 3.4
    const missile = makeMissile(this.trailMap)
    missile.position.copy(from)
    this.root.add(missile)
    this.fx.push({
      kind: "missile",
      object: missile,
      from,
      to: at.clone().setY(0.4),
      born: performance.now(),
      duration: FLIGHT,
      shot
    })
  },

  impact(shot) {
    if (!shot.coordinate || shot.result === "invalid" || shot.result === "over") return
    const side = shot.side
    const at = point(originFor(side), shot.coordinate)
    if (shot.result !== "hit") {
      this.splash(at)
      return
    }

    this.burst(at, true)

    this.burn(side, shot.coordinate, false)
    const ship = this.ships.find((entry) => entry.side === side && entry.cells.includes(shot.coordinate))
    if (shot.sunk === "yes" && ship) this.sink(ship)
    this.applyFleet()
  },

  burn(side, label, persistSmoke) {
    const key = `${side}:${label}`
    const at = point(originFor(side), label)
    if (!this.burning.has(key)) {
      this.burning.add(key)
      const tile = scorch()
      tile.position.x = at.x
      tile.position.z = at.z
      this.root.add(tile)

      const fire = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.fireMap,
          transparent: true,
          depthWrite: false,
          depthTest: false
        })
      )
      fire.position.set(at.x, 1.4, at.z)
      fire.scale.set(1.55, 2.35, 1)
      fire.renderOrder = 3
      this.root.add(fire)
      this.fx.push({kind: "fire", object: fire, born: performance.now(), phase: Math.random() * 6})
    }

    if (!persistSmoke) return
    for (const delay of [0, 1500]) {
      const smoke = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.smokeMap,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          opacity: 0.75
        })
      )
      smoke.position.set(at.x, 1.55, at.z)
      smoke.scale.setScalar(1.5)
      smoke.renderOrder = 2
      this.root.add(smoke)
      this.fx.push({kind: "smoke", object: smoke, born: performance.now() - delay, persist: true})
    }
  },

  sink(ship) {
    if (ship.sunk) return
    ship.sunk = true
    ship.group.traverse((child) => {
      if (!child.isMesh || !child.material || !child.material.color) return
      child.material.color.multiplyScalar(0.32)
      child.material.emissive = new THREE.Color(0x4a140c)
      child.material.emissiveIntensity = 0.55
    })
    ship.group.rotation.z += ship.group.rotation.y === 0 ? 0.14 : 0
    ship.group.rotation.x += ship.group.rotation.y !== 0 ? 0.14 : 0
    for (const label of ship.cells) this.burn(ship.side, label, true)
  },

  splash(at) {
    const marker = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 20),
      new THREE.MeshBasicMaterial({color: 0x3c78ff})
    )
    marker.rotation.x = -Math.PI / 2
    marker.position.set(at.x, 0.045, at.z)
    this.root.add(marker)

    const foam = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 14, 14),
      new THREE.MeshBasicMaterial({color: 0xf7fbff})
    )
    foam.position.set(at.x, 0.1, at.z)
    this.root.add(foam)
  },

  burst(at, hit) {
    const flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: hit ? this.fireMap : this.trailMap,
        transparent: true,
        depthWrite: false
      })
    )
    flash.position.set(at.x, 0.6, at.z)
    this.root.add(flash)
    this.fx.push({kind: "burst", object: flash, born: performance.now()})
  },

  disposeNode(node) {
    node.traverse((child) => {
      if (child.geometry) child.geometry.dispose()
      const materials = child.material ? [].concat(child.material) : []
      for (const material of materials) {
        if (material.map && !this.sharedMaps.has(material.map)) material.map.dispose()
        material.dispose()
      }
    })
  }
}
