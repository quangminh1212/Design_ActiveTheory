const canvas = document.querySelector('#experience')
const context = canvas?.getContext('2d', { alpha: false })
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const touchDevice = window.matchMedia('(pointer: coarse)').matches
const root = document.documentElement

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const lerp = (a, b, amount) => a + (b - a) * amount
const random = (seed) => {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

const state = {
  width: 1,
  height: 1,
  dpr: 1,
  elapsed: 0,
  paused: false,
  scroll: 0,
  pointer: { x: 0, y: 0, tx: 0, ty: 0 },
}

const makeParticles = () => {
  const seed = random(0x4154)
  return Array.from({ length: 520 }, (_, index) => ({
    x: seed() * 2 - 1,
    y: seed() * 2 - 1,
    z: seed(),
    size: .35 + seed() * 2.4,
    alpha: .16 + seed() * .66,
    hue: seed() > .74 ? 'cyan' : seed() > .45 ? 'blue' : 'violet',
    phase: seed() * Math.PI * 2,
    drift: .2 + seed() * .8,
    index,
  }))
}

const particles = makeParticles()

const resize = () => {
  if (!canvas || !context) return
  const rect = canvas.getBoundingClientRect()
  state.width = Math.max(1, rect.width)
  state.height = Math.max(1, rect.height)
  state.dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.floor(state.width * state.dpr)
  canvas.height = Math.floor(state.height * state.dpr)
  context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0)
}

const colorFor = (hue, alpha) => ({
  blue: `rgba(119, 177, 255, ${alpha})`,
  cyan: `rgba(113, 233, 255, ${alpha})`,
  violet: `rgba(181, 155, 255, ${alpha})`,
}[hue])

const drawParticle = (x, y, radius, color, alpha) => {
  const glow = context.createRadialGradient(x, y, 0, x, y, radius * 4.8)
  glow.addColorStop(0, colorFor(color, alpha))
  glow.addColorStop(1, colorFor(color, 0))
  context.fillStyle = glow
  context.beginPath()
  context.arc(x, y, radius * 4.8, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = colorFor(color, Math.min(1, alpha + .16))
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fill()
}

const drawCentralObject = (time, heroWeight) => {
  const { width, height, pointer } = state
  const cx = width * .52 + pointer.x * 24
  const cy = height * (.48 - state.scroll * .05) + pointer.y * 14
  const scale = clamp(Math.min(width, height) / 740, .63, 1.24) * heroWeight
  if (scale < .03) return

  context.save()
  context.translate(cx, cy)
  context.scale(scale, scale)
  context.globalCompositeOperation = 'lighter'

  const halo = context.createRadialGradient(0, 0, 40, 0, 0, 290)
  halo.addColorStop(0, `rgba(92, 129, 229, ${.16 * heroWeight})`)
  halo.addColorStop(.42, `rgba(71, 95, 186, ${.05 * heroWeight})`)
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)')
  context.fillStyle = halo
  context.beginPath()
  context.arc(0, 0, 290, 0, Math.PI * 2)
  context.fill()

  const drawRing = (radius, rotation, alpha, dash = []) => {
    context.save()
    context.rotate(rotation)
    context.setLineDash(dash)
    context.lineWidth = 1.05
    const ring = context.createLinearGradient(-radius, -radius, radius, radius)
    ring.addColorStop(0, `rgba(115, 224, 255, ${alpha})`)
    ring.addColorStop(.36, `rgba(170, 145, 255, ${alpha * .8})`)
    ring.addColorStop(.6, `rgba(255, 255, 255, ${alpha * .95})`)
    ring.addColorStop(1, `rgba(93, 134, 255, ${alpha * .35})`)
    context.strokeStyle = ring
    context.beginPath()
    context.ellipse(0, 0, radius, radius * .64, 0, 0, Math.PI * 2)
    context.stroke()
    context.restore()
  }

  drawRing(122, time * .12, .75)
  drawRing(164, -time * .09 + .6, .34, [25, 17])
  drawRing(95, time * .2 + 1.2, .48, [4, 19])

  context.save()
  context.rotate(time * -.08)
  context.beginPath()
  context.moveTo(-43, -36)
  context.lineTo(12, -60)
  context.lineTo(48, -28)
  context.lineTo(45, 26)
  context.lineTo(0, 65)
  context.lineTo(-48, 26)
  context.closePath()
  context.lineWidth = 1.35
  context.strokeStyle = 'rgba(211, 237, 255, .73)'
  context.shadowBlur = 18
  context.shadowColor = 'rgba(123, 197, 255, .7)'
  context.stroke()
  context.shadowBlur = 0
  context.beginPath()
  context.moveTo(-18, -20)
  context.lineTo(12, -31)
  context.lineTo(30, -13)
  context.lineTo(28, 17)
  context.lineTo(0, 37)
  context.lineTo(-27, 16)
  context.closePath()
  context.strokeStyle = 'rgba(171, 158, 255, .62)'
  context.stroke()
  context.restore()

  context.fillStyle = 'rgba(240, 248, 255, .92)'
  context.beginPath()
  context.arc(0, 0, 3, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

const render = (time = state.elapsed) => {
  if (!context) return
  const { width, height, pointer } = state
  const progress = state.scroll
  const bg = context.createLinearGradient(0, 0, width, height)
  bg.addColorStop(0, '#070912')
  bg.addColorStop(.5, progress > .4 ? '#0b111d' : '#090b17')
  bg.addColorStop(1, progress > .7 ? '#101222' : '#070912')
  context.fillStyle = bg
  context.fillRect(0, 0, width, height)

  const ambient = context.createRadialGradient(width * (.5 + pointer.x * .02), height * (.38 + pointer.y * .02), 0, width * .5, height * .4, width * .68)
  ambient.addColorStop(0, `rgba(53, 73, 153, ${.15 * (1 - progress * .35)})`)
  ambient.addColorStop(.45, 'rgba(28, 33, 76, .06)')
  ambient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  context.fillStyle = ambient
  context.fillRect(0, 0, width, height)

  const t = time * .001
  for (const particle of particles) {
    const depth = .3 + particle.z * .95
    const x = width * (.5 + particle.x * .72 * depth) + Math.sin(t * particle.drift + particle.phase) * (12 + particle.z * 30) + pointer.x * (10 + particle.z * 20)
    const y = height * (.51 + particle.y * .72 * depth) + Math.cos(t * particle.drift * .7 + particle.phase) * (9 + particle.z * 27) + pointer.y * (8 + particle.z * 16)
    if (x < -30 || x > width + 30 || y < -30 || y > height + 30) continue
    const alpha = particle.alpha * (.25 + particle.z * .75) * (1 - progress * .2)
    drawParticle(x, y, particle.size * (.45 + particle.z * .7), particle.hue, alpha)
  }

  const floorY = height * (.84 - progress * .08)
  context.save()
  context.globalAlpha = .28 * (1 - progress * .4)
  context.strokeStyle = 'rgba(125, 162, 245, .24)'
  context.lineWidth = .5
  for (let i = -8; i <= 8; i += 1) {
    context.beginPath()
    context.moveTo(width * .5 + i * 65 + pointer.x * 12, floorY)
    context.lineTo(width * .5 + i * 185 + pointer.x * 32, height)
    context.stroke()
  }
  context.restore()

  drawCentralObject(t, clamp(1 - progress * 2.2, 0, 1))
}

const animate = (now) => {
  if (!state.paused && !reducedMotion.matches) state.elapsed = now
  state.pointer.x = lerp(state.pointer.x, state.pointer.tx, reducedMotion.matches ? 1 : .08)
  state.pointer.y = lerp(state.pointer.y, state.pointer.ty, reducedMotion.matches ? 1 : .08)
  render(state.elapsed)
  window.requestAnimationFrame(animate)
}

const updateScroll = () => {
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
  state.scroll = clamp(window.scrollY / max, 0, 1)
  root.style.setProperty('--scroll-progress', state.scroll.toFixed(4))
}

const updatePointer = (event) => {
  state.pointer.tx = event.clientX - window.innerWidth / 2
  state.pointer.ty = event.clientY - window.innerHeight / 2
  root.style.setProperty('--pointer-x', event.clientX)
  root.style.setProperty('--pointer-y', event.clientY)
  document.querySelector('.cursor')?.classList.add('has-position')
}

const initReveals = () => {
  const items = document.querySelectorAll('.reveal')
  if (!('IntersectionObserver' in window) || reducedMotion.matches) {
    items.forEach((item) => item.classList.add('is-visible'))
    return
  }
  const observer = new IntersectionObserver((entries, instance) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      instance.unobserve(entry.target)
    })
  }, { threshold: .14, rootMargin: '0px 0px -8% 0px' })
  items.forEach((item) => observer.observe(item))
}

const initNavigation = () => {
  const header = document.querySelector('.site-header')
  const toggle = document.querySelector('.menu-toggle')
  const nav = document.querySelector('#primary-nav')
  const closeMenu = () => {
    header?.classList.remove('nav-open')
    toggle?.setAttribute('aria-expanded', 'false')
  }
  toggle?.addEventListener('click', () => {
    const open = !header.classList.contains('nav-open')
    header.classList.toggle('nav-open', open)
    toggle.setAttribute('aria-expanded', String(open))
  })
  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu))
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.querySelector(link.getAttribute('href'))
      if (!target) return
      event.preventDefault()
      target.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' })
    })
  })
}

const projects = {
  museum: { index: '01', title: 'Museum of Weed', description: 'An immersive installation that turns a cultural archive into a living, breathing world. Light, sound and curious visitors become part of the exhibit.', client: 'VICE / Installation', year: '2017' },
  signal: { index: '02', title: 'Signal / Field', description: 'A responsive film made from real-time signals. Every visit finds a different path through the same story, keeping the human hand in the machine.', client: 'Interactive film', year: '2024' },
  room: { index: '03', title: 'Clean Room', description: 'Our home for innovation: a small, strange laboratory where prototypes turn into production projects and a good question can change the shape of a screen.', client: 'AT Lab / Prototype', year: 'Always in motion' },
}

const initProjectDialog = () => {
  const dialog = document.querySelector('#project-dialog')
  if (!dialog) return
  const close = dialog.querySelector('.dialog-close')
  const fields = { index: dialog.querySelector('#dialog-index'), title: dialog.querySelector('#dialog-title'), description: dialog.querySelector('#dialog-description'), client: dialog.querySelector('#dialog-client'), year: dialog.querySelector('#dialog-year') }
  document.querySelectorAll('[data-project]').forEach((card) => card.addEventListener('click', () => {
    const project = projects[card.dataset.project]
    if (!project) return
    Object.entries(fields).forEach(([key, field]) => { if (field) field.textContent = project[key] })
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
  }))
  close?.addEventListener('click', () => dialog.close())
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close() })
}

const initCursor = () => {
  const cursor = document.querySelector('.cursor')
  if (touchDevice || !cursor) return
  window.addEventListener('pointermove', updatePointer, { passive: true })
  document.querySelectorAll('a, button').forEach((element) => {
    element.addEventListener('pointerenter', () => cursor.classList.add('is-hovering'))
    element.addEventListener('pointerleave', () => cursor.classList.remove('is-hovering'))
  })
}

resize()
window.addEventListener('resize', resize, { passive: true })
window.addEventListener('scroll', updateScroll, { passive: true })
updateScroll()
initReveals()
initNavigation()
initProjectDialog()
initCursor()
window.addEventListener('keydown', (event) => { if (event.key === 'Escape') document.querySelector('#project-dialog')?.close() })

window.__clone = {
  step(seconds = 1 / 60) { state.elapsed += seconds * 1000; render(state.elapsed) },
  pause() { state.paused = true },
  resume() { state.paused = false },
}
window.__verify = {
  ready: true,
  rendering: '2d-canvas',
  canvas: Boolean(canvas && context),
  sections: ['home', 'about', 'work', 'lab', 'contact'],
  interactions: ['smooth-navigation', 'project-dialog', 'responsive-menu', 'pointer-field'],
}

window.requestAnimationFrame(animate)
