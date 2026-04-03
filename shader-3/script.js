import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
;(function () {
	const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
	const num = (v, fb) => {
		const n = Number(v)
		return Number.isFinite(n) ? n : fb
	}
	const bool = (v, fb) => {
		if (v == null) return fb
		const s = String(v).toLowerCase()
		if (s === 'true') return true
		if (s === 'false') return false
		return fb
	}

	const E = (min, max) => min + Math.random() * (max - min)
	const randFloatSpread = s => (Math.random() - 0.5) * 2 * s

	// ---------------- Pointer (global) ----------------
	const pointerStore = new Map()
	const pointerAbs = new THREE.Vector2()
	let pointerBound = false

	const bindPointer = () => {
		if (pointerBound) return
		pointerBound = true

		const process = () => {
			for (const [elem, st] of pointerStore) {
				const rect = elem.getBoundingClientRect()
				const inside =
					pointerAbs.x >= rect.left &&
					pointerAbs.x <= rect.left + rect.width &&
					pointerAbs.y >= rect.top &&
					pointerAbs.y <= rect.top + rect.height

				st.position.x = pointerAbs.x - rect.left
				st.position.y = pointerAbs.y - rect.top
				st.nPosition.x = (st.position.x / rect.width) * 2 - 1
				st.nPosition.y = (-st.position.y / rect.height) * 2 + 1

				if (inside) {
					if (!st.hover) {
						st.hover = true
						st.onEnter(st)
					}
					st.onMove(st)
				} else if (st.hover && !st.touching) {
					st.hover = false
					st.onLeave(st)
				}
			}
		}

		const onPointerMove = e => {
			pointerAbs.x = e.clientX
			pointerAbs.y = e.clientY
			process()
		}

		const onPointerLeave = () => {
			for (const st of pointerStore.values()) {
				if (st.hover) {
					st.hover = false
					st.onLeave(st)
				}
			}
		}

		const onClick = e => {
			pointerAbs.x = e.clientX
			pointerAbs.y = e.clientY
			for (const [elem, st] of pointerStore) {
				const rect = elem.getBoundingClientRect()
				st.position.x = pointerAbs.x - rect.left
				st.position.y = pointerAbs.y - rect.top
				st.nPosition.x = (st.position.x / rect.width) * 2 - 1
				st.nPosition.y = (-st.position.y / rect.height) * 2 + 1

				const inside =
					pointerAbs.x >= rect.left &&
					pointerAbs.x <= rect.left + rect.width &&
					pointerAbs.y >= rect.top &&
					pointerAbs.y <= rect.top + rect.height

				if (inside) st.onClick(st)
			}
		}

		const touchStart = e => {
			if (!e.touches || e.touches.length === 0) return
			e.preventDefault()
			pointerAbs.x = e.touches[0].clientX
			pointerAbs.y = e.touches[0].clientY

			for (const [elem, st] of pointerStore) {
				const rect = elem.getBoundingClientRect()
				const inside =
					pointerAbs.x >= rect.left &&
					pointerAbs.x <= rect.left + rect.width &&
					pointerAbs.y >= rect.top &&
					pointerAbs.y <= rect.top + rect.height

				if (inside) {
					st.touching = true
					st.position.x = pointerAbs.x - rect.left
					st.position.y = pointerAbs.y - rect.top
					st.nPosition.x = (st.position.x / rect.width) * 2 - 1
					st.nPosition.y = (-st.position.y / rect.height) * 2 + 1

					if (!st.hover) {
						st.hover = true
						st.onEnter(st)
					}
					st.onMove(st)
				}
			}
		}

		const touchMove = e => {
			if (!e.touches || e.touches.length === 0) return
			e.preventDefault()
			pointerAbs.x = e.touches[0].clientX
			pointerAbs.y = e.touches[0].clientY
			process()
		}

		const touchEnd = () => {
			for (const st of pointerStore.values()) {
				if (st.touching) {
					st.touching = false
					if (st.hover) {
						st.hover = false
						st.onLeave(st)
					}
				}
			}
		}

		document.body.addEventListener('pointermove', onPointerMove, {
			passive: true,
		})
		document.body.addEventListener('pointerleave', onPointerLeave, {
			passive: true,
		})
		document.body.addEventListener('click', onClick, { passive: true })

		document.body.addEventListener('touchstart', touchStart, { passive: false })
		document.body.addEventListener('touchmove', touchMove, { passive: false })
		document.body.addEventListener('touchend', touchEnd, { passive: true })
		document.body.addEventListener('touchcancel', touchEnd, { passive: true })

		bindPointer._off = () => {
			document.body.removeEventListener('pointermove', onPointerMove)
			document.body.removeEventListener('pointerleave', onPointerLeave)
			document.body.removeEventListener('click', onClick)
			document.body.removeEventListener('touchstart', touchStart)
			document.body.removeEventListener('touchmove', touchMove)
			document.body.removeEventListener('touchend', touchEnd)
			document.body.removeEventListener('touchcancel', touchEnd)
		}
	}

	const Pointer = (domElement, handlers) => {
		bindPointer()
		const st = {
			position: new THREE.Vector2(),
			nPosition: new THREE.Vector2(),
			hover: false,
			touching: false,
			onEnter: () => {},
			onMove: () => {},
			onClick: () => {},
			onLeave: () => {},
			...handlers,
		}
		pointerStore.set(domElement, st)
		st.dispose = () => {
			pointerStore.delete(domElement)
			if (pointerStore.size === 0 && bindPointer._off) {
				bindPointer._off()
				pointerBound = false
			}
		}
		return st
	}

	const makeRoomEnv = renderer => {
		// PMREMGenerator існує в three, RoomEnvironment імпортуємо окремо
		const pmrem = new THREE.PMREMGenerator(renderer)
		const envScene = new RoomEnvironment()
		const env = pmrem.fromScene(envScene, 0.04).texture
		pmrem.dispose()
		envScene.dispose?.()
		return env
	}

	// ---------------- Physics ----------------
	class Physics {
		constructor(cfg) {
			this.cfg = cfg
			this.positionData = new Float32Array(cfg.count * 3)
			this.velocityData = new Float32Array(cfg.count * 3)
			this.sizeData = new Float32Array(cfg.count)
			this.center = new THREE.Vector3()
			this.reset()
			this.setSizes()
		}
		reset() {
			const { cfg, positionData } = this
			this.center.toArray(positionData, 0)
			for (let i = 1; i < cfg.count; i++) {
				const b = i * 3
				positionData[b] = randFloatSpread(2 * cfg.maxX)
				positionData[b + 1] = randFloatSpread(2 * cfg.maxY)
				positionData[b + 2] = randFloatSpread(2 * cfg.maxZ)
			}
		}
		setSizes() {
			const { cfg, sizeData } = this
			sizeData[0] = cfg.size0
			for (let i = 1; i < cfg.count; i++)
				sizeData[i] = E(cfg.minSize, cfg.maxSize)
		}
		update(dtObj) {
			const dt = dtObj.delta
			const cfg = this.cfg
			const p = this.positionData
			const v = this.velocityData
			const s = this.sizeData

			// ОДИН раз алокуємо, а не кожен кадр (це сильно зменшує лаги)
			if (!this._tmp) {
				this._tmp = {
					F: new THREE.Vector3(),
					I: new THREE.Vector3(),
					O: new THREE.Vector3(),
					B: new THREE.Vector3(),
					N: new THREE.Vector3(),
					tmp: new THREE.Vector3(),
					push: new THREE.Vector3(),
					pushV: new THREE.Vector3(),
					pushVO: new THREE.Vector3(),
				}
			}
			const { F, I, O, B, N, tmp, push, pushV, pushVO } = this._tmp

			let start = 0
			if (cfg.controlSphere0) {
				start = 1
				F.fromArray(p, 0)
				F.lerp(this.center, 0.1).toArray(p, 0)
				v[0] = 0
				v[1] = 0
				v[2] = 0
			}

			for (let i = start; i < cfg.count; i++) {
				const b = i * 3
				I.fromArray(p, b)
				B.fromArray(v, b)
				B.y -= dt * cfg.gravity * s[i]
				B.multiplyScalar(cfg.friction)
				if (B.length() > cfg.maxVelocity) B.setLength(cfg.maxVelocity)
				I.add(B)
				I.toArray(p, b)
				B.toArray(v, b)
			}

			for (let i = start; i < cfg.count; i++) {
				const b = i * 3
				I.fromArray(p, b)
				B.fromArray(v, b)
				const radius = s[i]

				for (let j = i + 1; j < cfg.count; j++) {
					const ob = j * 3
					O.fromArray(p, ob)
					N.fromArray(v, ob)
					const or = s[j]

					tmp.copy(O).sub(I)
					const dist = tmp.length()
					const sum = radius + or

					if (dist < sum) {
						const overlap = sum - dist
						push
							.copy(tmp)
							.normalize()
							.multiplyScalar(0.5 * overlap)

						pushV.copy(push).multiplyScalar(Math.max(B.length(), 1))
						pushVO.copy(push).multiplyScalar(Math.max(N.length(), 1))

						I.sub(push)
						B.sub(pushV)

						O.add(push)
						N.add(pushVO)

						I.toArray(p, b)
						B.toArray(v, b)
						O.toArray(p, ob)
						N.toArray(v, ob)
					}
				}

				if (cfg.controlSphere0) {
					F.fromArray(p, 0)
					tmp.copy(F).sub(I)
					const dist0 = tmp.length()
					const sum0 = radius + s[0]
					if (dist0 < sum0) {
						const diff = sum0 - dist0
						push.copy(tmp).normalize().multiplyScalar(diff)
						pushV.copy(push).multiplyScalar(Math.max(B.length(), 2))
						I.sub(push)
						B.sub(pushV)
					}
				}

				if (Math.abs(I.x) + radius > cfg.maxX) {
					I.x = Math.sign(I.x) * (cfg.maxX - radius)
					B.x = -B.x * cfg.wallBounce
				}

				if (cfg.gravity === 0) {
					if (Math.abs(I.y) + radius > cfg.maxY) {
						I.y = Math.sign(I.y) * (cfg.maxY - radius)
						B.y = -B.y * cfg.wallBounce
					}
				} else if (I.y - radius < -cfg.maxY) {
					I.y = -cfg.maxY + radius
					B.y = -B.y * cfg.wallBounce
				}

				const maxBoundary = Math.max(cfg.maxZ, cfg.maxSize || cfg.maxSize || 1)
				if (Math.abs(I.z) + radius > maxBoundary) {
					I.z = Math.sign(I.z) * (cfg.maxZ - radius)
					B.z = -B.z * cfg.wallBounce
				}

				I.toArray(p, b)
				B.toArray(v, b)
			}
		}
	}

	const DEFAULT = {
		count: 200,
		colors: [0x9f7bff, 0x5b2bff, 0x33c7ff],
		ambientColor: 0xffffff,
		ambientIntensity: 1,
		lightIntensity: 200,
		materialParams: {
			metalness: 0.5,
			roughness: 0.5,
			clearcoat: 1,
			clearcoatRoughness: 0.15,
		},
		minSize: 0.5,
		maxSize: 1,
		size0: 1,
		gravity: 0.5,
		friction: 0.9975,
		wallBounce: 0.95,
		maxVelocity: 0.15,
		maxX: 5,
		maxY: 5,
		maxZ: 2,
		controlSphere0: false,
		followCursor: true,
	}

	const initBallpit = el => {
		if (el._ballpitCleanup) el._ballpitCleanup()

		const cfg = {
			...DEFAULT,
			count: Math.max(1, Math.floor(num(el.dataset.count, DEFAULT.count))),
			gravity: num(el.dataset.gravity, DEFAULT.gravity),
			friction: num(el.dataset.friction, DEFAULT.friction),
			wallBounce: num(el.dataset.wallBounce, DEFAULT.wallBounce),
			followCursor: bool(el.dataset.followCursor, DEFAULT.followCursor),
		}

		el.style.touchAction = 'none'
		el.style.userSelect = 'none'
		el.style.webkitUserSelect = 'none'

		const canvas = document.createElement('canvas')
		canvas.style.width = '100%'
		canvas.style.height = '100%'
		canvas.style.display = 'block'
		el.innerHTML = ''
		el.appendChild(canvas)

		const renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: true,
			powerPreference: 'high-performance',
		})
		renderer.outputColorSpace = THREE.SRGBColorSpace
		renderer.toneMapping = THREE.ACESFilmicToneMapping

		const scene = new THREE.Scene()
		const camera = new THREE.PerspectiveCamera(15, 1, 0.1, 200)
		camera.position.set(0, 0, 20)
		camera.lookAt(0, 0, 0)

		// ENV
		const env = makeRoomEnv(renderer)
		scene.environment = env

		const amb = new THREE.AmbientLight(cfg.ambientColor, cfg.ambientIntensity)
		scene.add(amb)

		const light = new THREE.PointLight(
			cfg.colors[0] || 0xffffff,
			cfg.lightIntensity,
		)
		scene.add(light)

		const geom = new THREE.SphereGeometry(1, 24, 24)
		const mat = new THREE.MeshPhysicalMaterial({
			envMap: scene.environment || null,
			...cfg.materialParams,
		})
		mat.envMapRotation = new THREE.Euler(-Math.PI / 2, 0, 0)

		const mesh = new THREE.InstancedMesh(geom, mat, cfg.count)
		mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

		// colors gradient
		if (cfg.colors && cfg.colors.length > 1) {
			const cols = cfg.colors.map(c => new THREE.Color(c))
			for (let i = 0; i < cfg.count; i++) {
				const t = (i / Math.max(1, cfg.count - 1)) * (cols.length - 1)
				const idx = Math.floor(t)
				const a = cols[idx]
				const b = cols[Math.min(cols.length - 1, idx + 1)]
				const f = t - idx
				const out = new THREE.Color(
					a.r + f * (b.r - a.r),
					a.g + f * (b.g - a.g),
					a.b + f * (b.b - a.b),
				)
				mesh.setColorAt(i, out)
				if (i === 0) light.color.copy(out)
			}
			mesh.instanceColor.needsUpdate = true
		}

		scene.add(mesh)

		const physics = new Physics(cfg)

		const tmpObj = new THREE.Object3D()
		const raycaster = new THREE.Raycaster()
		const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
		const hit = new THREE.Vector3()

		let paused = false
		let raf = 0
		let last = performance.now()

		const resize = () => {
			const r = el.getBoundingClientRect()
			const w = Math.max(1, Math.floor(r.width))
			const h = Math.max(1, Math.floor(r.height))
			const pr = clamp(window.devicePixelRatio || 1, 1, 2)

			renderer.setPixelRatio(pr)
			renderer.setSize(w, h, false)

			camera.aspect = w / h
			camera.updateProjectionMatrix()

			const fov = (camera.fov * Math.PI) / 180
			const wH = 2 * Math.tan(fov / 2) * camera.position.length()
			const wW = wH * camera.aspect
			cfg.maxX = wW / 2
			cfg.maxY = wH / 2
			cfg.maxZ = 2
			cfg.maxSize = cfg.maxSize || DEFAULT.maxSize

			// форсимо оновлення курсору після resize
			if (el._ballpitPointer) el._ballpitPointer.onMove(el._ballpitPointer)
		}

		const ro = new ResizeObserver(resize)
		ro.observe(el)
		resize()

		const pointer = Pointer(canvas, {
			onMove(st) {
				if (!cfg.followCursor) return
				raycaster.setFromCamera(st.nPosition, camera)
				camera.getWorldDirection(plane.normal)
				raycaster.ray.intersectPlane(plane, hit)
				physics.center.copy(hit)
				cfg.controlSphere0 = true
			},
			onLeave() {
				cfg.controlSphere0 = false
			},
		})
		el._ballpitPointer = pointer

		const loop = now => {
			raf = requestAnimationFrame(loop)

			const dt = Math.min(0.033, (now - last) / 1000)
			last = now

			if (!paused) physics.update({ delta: dt })

			for (let i = 0; i < cfg.count; i++) {
				tmpObj.position.fromArray(physics.positionData, i * 3)
				if (i === 0 && cfg.followCursor === false) tmpObj.scale.setScalar(0)
				else tmpObj.scale.setScalar(physics.sizeData[i])

				tmpObj.updateMatrix()
				mesh.setMatrixAt(i, tmpObj.matrix)
				if (i === 0) light.position.copy(tmpObj.position)
			}

			mesh.instanceMatrix.needsUpdate = true
			renderer.render(scene, camera)
		}

		raf = requestAnimationFrame(loop)

		el._ballpitCleanup = () => {
			cancelAnimationFrame(raf)
			ro.disconnect()
			pointer.dispose()

			scene.remove(mesh)
			scene.remove(amb)
			scene.remove(light)

			geom.dispose()
			mat.dispose()
			renderer.dispose()

			if (env) env.dispose?.()
			if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas)

			el._ballpitPointer = null
		}

		el.Ballpit = {
			set(next) {
				if (!next) return
				if (typeof next.gravity === 'number') cfg.gravity = next.gravity
				if (typeof next.friction === 'number') cfg.friction = next.friction
				if (typeof next.wallBounce === 'number')
					cfg.wallBounce = next.wallBounce
				if (typeof next.followCursor === 'boolean')
					cfg.followCursor = next.followCursor
			},
			togglePause() {
				paused = !paused
			},
			destroy() {
				el._ballpitCleanup && el._ballpitCleanup()
			},
		}
	}

	const initAll = () => {
		document.querySelectorAll('[data-ballpit]').forEach(initBallpit)
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initAll)
	} else {
		initAll()
	}
})()
