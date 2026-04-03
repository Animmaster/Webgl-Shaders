;(function () {
	let container = document.getElementById('gradientBlinds')
	if (!container) return
	let MAX_COLORS = 8
	function hexToRGB(hex) {
		let c = (hex || '').replace('#', '')
		while (c.length < 6) c += '0'
		c = c.slice(0, 6)
		let r = parseInt(c.slice(0, 2), 16) / 255
		let g = parseInt(c.slice(2, 4), 16) / 255
		let b = parseInt(c.slice(4, 6), 16) / 255
		return [r, g, b]
	}
	function prepStops(stops) {
		let base = (stops && stops.length ? stops : ['#FF9FFC', '#5227FF']).slice(
			0,
			MAX_COLORS,
		)
		if (base.length === 1) base.push(base[0])
		while (base.length < MAX_COLORS) base.push(base[base.length - 1])
		let arr = []
		for (let i = 0; i < MAX_COLORS; i++) arr.push(hexToRGB(base[i]))
		let count = Math.max(
			2,
			Math.min(MAX_COLORS, stops && stops.length ? stops.length : 2),
		)
		return { arr, count }
	}
	let opts = {
		dpr: window.devicePixelRatio || 1,
		paused: false,
		gradientColors: ['#FF9FFC', '#5227FF'],
		angle: 0,
		noise: 0.3,
		blindCount: 12,
		blindMinWidth: 50,
		mouseDampening: 0.15,
		mirrorGradient: false,
		spotlightRadius: 0.5,
		spotlightSoftness: 1,
		spotlightOpacity: 1,
		distortAmount: 0,
		shineDirection: 'left',
		mixBlendMode: 'lighten',
	}
	let canvas = document.createElement('canvas')
	canvas.style.width = '100%'
	canvas.style.height = '100%'
	canvas.style.display = 'block'
	canvas.style.mixBlendMode = opts.mixBlendMode
	container.appendChild(canvas)
	let gl =
		canvas.getContext('webgl', { alpha: true, antialias: true }) ||
		canvas.getContext('experimental-webgl', { alpha: true, antialias: true })
	if (!gl) return
	let vertexSrc =
		'attribute vec2 position;attribute vec2 uv;varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,0.0,1.0);}'
	let fragmentSrc =
		'#ifdef GL_ES\nprecision mediump float;\n#endif\nuniform vec3 iResolution;\nuniform vec2 iMouse;\nuniform float iTime;\nuniform float uAngle;\nuniform float uNoise;\nuniform float uBlindCount;\nuniform float uSpotlightRadius;\nuniform float uSpotlightSoftness;\nuniform float uSpotlightOpacity;\nuniform float uMirror;\nuniform float uDistort;\nuniform float uShineFlip;\nuniform vec3 uColor0;\nuniform vec3 uColor1;\nuniform vec3 uColor2;\nuniform vec3 uColor3;\nuniform vec3 uColor4;\nuniform vec3 uColor5;\nuniform vec3 uColor6;\nuniform vec3 uColor7;\nuniform int uColorCount;\nvarying vec2 vUv;\nfloat rand(vec2 co){return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453);}\nvec2 rotate2D(vec2 p,float a){float c=cos(a);float s=sin(a);return mat2(c,-s,s,c)*p;}\nvec3 getGradientColor(float t){float tt=clamp(t,0.0,1.0);int count=uColorCount; if(count<2) count=2; float scaled=tt*float(count-1); float seg=floor(scaled); float f=fract(scaled);\nif(seg<1.0) return mix(uColor0,uColor1,f);\nif(seg<2.0 && count>2) return mix(uColor1,uColor2,f);\nif(seg<3.0 && count>3) return mix(uColor2,uColor3,f);\nif(seg<4.0 && count>4) return mix(uColor3,uColor4,f);\nif(seg<5.0 && count>5) return mix(uColor4,uColor5,f);\nif(seg<6.0 && count>6) return mix(uColor5,uColor6,f);\nif(seg<7.0 && count>7) return mix(uColor6,uColor7,f);\nif(count>7) return uColor7;\nif(count>6) return uColor6;\nif(count>5) return uColor5;\nif(count>4) return uColor4;\nif(count>3) return uColor3;\nif(count>2) return uColor2;\nreturn uColor1;}\nvoid mainImage(out vec4 fragColor,in vec2 fragCoord){\nvec2 uv0=fragCoord.xy/iResolution.xy;\nfloat aspect=iResolution.x/iResolution.y;\nvec2 p=uv0*2.0-1.0;\np.x*=aspect;\nvec2 pr=rotate2D(p,uAngle);\npr.x/=aspect;\nvec2 uv=pr*0.5+0.5;\nvec2 uvMod=uv;\nif(uDistort>0.0){float a=uvMod.y*6.0; float b=uvMod.x*6.0; float w=0.01*uDistort; uvMod.x+=sin(a)*w; uvMod.y+=cos(b)*w;}\nfloat t=uvMod.x;\nif(uMirror>0.5){t=1.0-abs(1.0-2.0*fract(t));}\nvec3 base=getGradientColor(t);\nvec2 offset=vec2(iMouse.x/iResolution.x,iMouse.y/iResolution.y);\nfloat d=length(uv0-offset);\nfloat r=max(uSpotlightRadius,1e-4);\nfloat dn=d/r;\nfloat spot=(1.0-2.0*pow(dn,uSpotlightSoftness))*uSpotlightOpacity;\nvec3 cir=vec3(spot);\nfloat stripe=fract(uvMod.x*max(uBlindCount,1.0));\nif(uShineFlip>0.5) stripe=1.0-stripe;\nvec3 ran=vec3(stripe);\nvec3 col=cir+base-ran;\ncol+=(rand(gl_FragCoord.xy+iTime)-0.5)*uNoise;\nfragColor=vec4(col,1.0);\n}\nvoid main(){vec4 color; mainImage(color, vUv*iResolution.xy); gl_FragColor=color;}\n'
	function compileShader(type, source) {
		let sh = gl.createShader(type)
		gl.shaderSource(sh, source)
		gl.compileShader(sh)
		if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
			gl.deleteShader(sh)
			return null
		}
		return sh
	}
	function createProgram(vsSrc, fsSrc) {
		let vs = compileShader(gl.VERTEX_SHADER, vsSrc)
		let fs = compileShader(gl.FRAGMENT_SHADER, fsSrc)
		if (!vs || !fs) return null
		let prog = gl.createProgram()
		gl.attachShader(prog, vs)
		gl.attachShader(prog, fs)
		gl.linkProgram(prog)
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			gl.deleteProgram(prog)
			return null
		}
		gl.deleteShader(vs)
		gl.deleteShader(fs)
		return prog
	}
	let program = createProgram(vertexSrc, fragmentSrc)
	if (!program) return
	gl.useProgram(program)
	let posLoc = gl.getAttribLocation(program, 'position')
	let uvLoc = gl.getAttribLocation(program, 'uv')
	let iResolutionLoc = gl.getUniformLocation(program, 'iResolution')
	let iMouseLoc = gl.getUniformLocation(program, 'iMouse')
	let iTimeLoc = gl.getUniformLocation(program, 'iTime')
	let uAngleLoc = gl.getUniformLocation(program, 'uAngle')
	let uNoiseLoc = gl.getUniformLocation(program, 'uNoise')
	let uBlindCountLoc = gl.getUniformLocation(program, 'uBlindCount')
	let uSpotlightRadiusLoc = gl.getUniformLocation(program, 'uSpotlightRadius')
	let uSpotlightSoftnessLoc = gl.getUniformLocation(
		program,
		'uSpotlightSoftness',
	)
	let uSpotlightOpacityLoc = gl.getUniformLocation(program, 'uSpotlightOpacity')
	let uMirrorLoc = gl.getUniformLocation(program, 'uMirror')
	let uDistortLoc = gl.getUniformLocation(program, 'uDistort')
	let uShineFlipLoc = gl.getUniformLocation(program, 'uShineFlip')
	let uColorLocs = [
		gl.getUniformLocation(program, 'uColor0'),
		gl.getUniformLocation(program, 'uColor1'),
		gl.getUniformLocation(program, 'uColor2'),
		gl.getUniformLocation(program, 'uColor3'),
		gl.getUniformLocation(program, 'uColor4'),
		gl.getUniformLocation(program, 'uColor5'),
		gl.getUniformLocation(program, 'uColor6'),
		gl.getUniformLocation(program, 'uColor7'),
	]
	let uColorCountLoc = gl.getUniformLocation(program, 'uColorCount')
	let posBuffer = gl.createBuffer()
	gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer)
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 3, -1, -1, 3]),
		gl.STATIC_DRAW,
	)
	gl.enableVertexAttribArray(posLoc)
	gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
	let uvBuffer = gl.createBuffer()
	gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([0, 0, 2, 0, 0, 2]),
		gl.STATIC_DRAW,
	)
	gl.enableVertexAttribArray(uvLoc)
	gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0)
	let state = {
		mouse: [0, 0],
		mouseTarget: [0, 0],
		lastTime: 0,
		firstResize: true,
		raf: 0,
	}
	let stopInfo = prepStops(opts.gradientColors)
	function setUniforms() {
		gl.uniform1f(uAngleLoc, (opts.angle * Math.PI) / 180)
		gl.uniform1f(uNoiseLoc, opts.noise)
		gl.uniform1f(uSpotlightRadiusLoc, opts.spotlightRadius)
		gl.uniform1f(uSpotlightSoftnessLoc, opts.spotlightSoftness)
		gl.uniform1f(uSpotlightOpacityLoc, opts.spotlightOpacity)
		gl.uniform1f(uMirrorLoc, opts.mirrorGradient ? 1 : 0)
		gl.uniform1f(uDistortLoc, opts.distortAmount)
		gl.uniform1f(uShineFlipLoc, opts.shineDirection === 'right' ? 1 : 0)
		gl.uniform1i(uColorCountLoc, stopInfo.count)
		for (let i = 0; i < 8; i++)
			gl.uniform3fv(uColorLocs[i], new Float32Array(stopInfo.arr[i]))
	}
	function resize() {
		let rect = container.getBoundingClientRect()
		let dpr = opts.dpr
		let w = Math.max(1, Math.floor(rect.width * dpr))
		let h = Math.max(1, Math.floor(rect.height * dpr))
		if (canvas.width !== w) canvas.width = w
		if (canvas.height !== h) canvas.height = h
		gl.viewport(0, 0, w, h)
		gl.uniform3fv(iResolutionLoc, new Float32Array([w, h, 1]))
		let effective
		if (opts.blindMinWidth && opts.blindMinWidth > 0) {
			let maxByMinWidth = Math.max(
				1,
				Math.floor(rect.width / opts.blindMinWidth),
			)
			effective = opts.blindCount
				? Math.min(opts.blindCount, maxByMinWidth)
				: maxByMinWidth
		} else {
			effective = opts.blindCount
		}
		gl.uniform1f(uBlindCountLoc, Math.max(1, effective))
		if (state.firstResize) {
			state.firstResize = false
			let cx = w / 2
			let cy = h / 2
			state.mouse[0] = cx
			state.mouse[1] = cy
			state.mouseTarget[0] = cx
			state.mouseTarget[1] = cy
			gl.uniform2fv(iMouseLoc, new Float32Array(state.mouse))
		}
	}
	setUniforms()
	resize()
	let ro = new ResizeObserver(resize)
	ro.observe(container)
	function onPointerMove(e) {
		let rect = canvas.getBoundingClientRect()
		let dpr = opts.dpr
		let x = (e.clientX - rect.left) * dpr
		let y = (rect.height - (e.clientY - rect.top)) * dpr
		state.mouseTarget[0] = x
		state.mouseTarget[1] = y
		if (opts.mouseDampening <= 0) {
			state.mouse[0] = x
			state.mouse[1] = y
			gl.uniform2fv(iMouseLoc, new Float32Array(state.mouse))
		}
	}
	canvas.addEventListener('pointermove', onPointerMove)
	function loop(t) {
		state.raf = requestAnimationFrame(loop)
		gl.uniform1f(iTimeLoc, t * 1e-3)
		if (opts.mouseDampening > 0) {
			if (!state.lastTime) state.lastTime = t
			let dt = (t - state.lastTime) / 1e3
			state.lastTime = t
			let tau = Math.max(1e-4, opts.mouseDampening)
			let factor = 1 - Math.exp(-dt / tau)
			if (factor > 1) factor = 1
			state.mouse[0] += (state.mouseTarget[0] - state.mouse[0]) * factor
			state.mouse[1] += (state.mouseTarget[1] - state.mouse[1]) * factor
			gl.uniform2fv(iMouseLoc, new Float32Array(state.mouse))
		} else {
			state.lastTime = t
		}
		if (!opts.paused) gl.drawArrays(gl.TRIANGLES, 0, 3)
	}
	state.raf = requestAnimationFrame(loop)
	window.GradientBlinds = {
		set: function (next) {
			if (!next) return
			if (typeof next.angle === 'number') opts.angle = next.angle
			if (typeof next.noise === 'number') opts.noise = next.noise
			if (typeof next.blindCount === 'number') opts.blindCount = next.blindCount
			if (typeof next.blindMinWidth === 'number')
				opts.blindMinWidth = next.blindMinWidth
			if (typeof next.mouseDampening === 'number')
				opts.mouseDampening = next.mouseDampening
			if (typeof next.mirrorGradient === 'boolean')
				opts.mirrorGradient = next.mirrorGradient
			if (typeof next.spotlightRadius === 'number')
				opts.spotlightRadius = next.spotlightRadius
			if (typeof next.spotlightSoftness === 'number')
				opts.spotlightSoftness = next.spotlightSoftness
			if (typeof next.spotlightOpacity === 'number')
				opts.spotlightOpacity = next.spotlightOpacity
			if (typeof next.distortAmount === 'number')
				opts.distortAmount = next.distortAmount
			if (typeof next.shineDirection === 'string')
				opts.shineDirection = next.shineDirection
			if (Array.isArray(next.gradientColors)) {
				opts.gradientColors = next.gradientColors.slice(0)
				stopInfo = prepStops(opts.gradientColors)
			}
			setUniforms()
			resize()
		},
		pause: function () {
			opts.paused = true
		},
		play: function () {
			opts.paused = false
		},
		destroy: function () {
			cancelAnimationFrame(state.raf)
			canvas.removeEventListener('pointermove', onPointerMove)
			ro.disconnect()
			if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
			try {
				gl.getExtension('WEBGL_lose_context') &&
					gl.getExtension('WEBGL_lose_context').loseContext()
			} catch (e) {}
		},
	}
})()
