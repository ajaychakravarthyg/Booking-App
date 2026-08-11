import { useEffect, useRef, useState } from 'react'

/*
 * Adapted from "Travel Connect Signin" by @coderislive07 on 21st.dev
 * https://21st.dev/@coderislive07/components/travel-connect-signin-1
 *
 * Kept: the canvas dot grid masked into continent shapes, and animated routes with a glowing
 * moving point.
 *
 * Changed, and the changes are the point:
 *   • THEME-AWARE. The original hardcodes `rgba(37, 99, 235, …)` and a white card, so on a dark
 *     background it renders invisible dots on the wrong surface. Colours are now read from the
 *     app's CSS custom properties and the canvas repaints when the theme class flips.
 *   • framer-motion dropped — it is not a dependency here, and none of its animation was load-
 *     bearing for the map itself.
 *   • Routes now connect our ACTUAL destinations by latitude/longitude, projected onto the
 *     canvas, instead of arbitrary hardcoded pixel pairs. A detected location is plotted too.
 *   • Honours prefers-reduced-motion: the map still draws, the routes just do not animate.
 *   • TSX → JSX.
 */

/** Equirectangular projection: lon/lat → canvas x/y. Crude, but right for a stylised map. */
function project(longitude, latitude, width, height) {
  return {
    x: ((longitude + 180) / 360) * width,
    // Latitude is inverted because canvas y grows downward.
    y: ((90 - latitude) / 180) * height,
  }
}

/** "#0095ff" → "0, 149, 255" so it can be used inside rgba(). */
function hexToRgb(hex) {
  const clean = String(hex).trim().replace('#', '')
  if (clean.length !== 6) return '99, 102, 241'
  const int = Number.parseInt(clean, 16)
  return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`
}

function readThemeColours() {
  const styles = getComputedStyle(document.documentElement)
  const read = (name, fallback) => {
    const value = styles.getPropertyValue(name).trim()
    return value || fallback
  }
  return {
    dot: hexToRgb(read('--primary', '#0095ff')),
    route: read('--primary', '#0095ff'),
    accent: read('--chart-3', '#8b5cf6'),
    marker: read('--chart-2', '#10b981'),
  }
}

/**
 * A coarse landmass mask, expressed as fractions of the canvas.
 *
 * Rectangles rather than real geometry: at this dot size the silhouette reads as "the world"
 * without shipping a GeoJSON file, and the original component took the same approach. The
 * boxes are tuned to the equirectangular projection above so plotted cities land on land.
 */
const LANDMASSES = [
  { x: [0.13, 0.30], y: [0.10, 0.36] }, // North America
  { x: [0.20, 0.32], y: [0.36, 0.45] }, // Central America
  { x: [0.25, 0.36], y: [0.45, 0.80] }, // South America
  { x: [0.44, 0.56], y: [0.10, 0.30] }, // Europe
  { x: [0.46, 0.62], y: [0.30, 0.68] }, // Africa
  { x: [0.56, 0.78], y: [0.12, 0.42] }, // Asia
  { x: [0.72, 0.86], y: [0.30, 0.46] }, // SE Asia
  { x: [0.80, 0.92], y: [0.58, 0.74] }, // Australia
]

function isLand(fx, fy) {
  return LANDMASSES.some(
    (box) => fx >= box.x[0] && fx <= box.x[1] && fy >= box.y[0] && fy <= box.y[1],
  )
}

/**
 * @param destinations [{ city, latitude, longitude }] — plotted as static markers
 * @param highlight    { city, latitude, longitude } — the detected location, drawn larger
 */
export function WorldDotMap({ destinations = [], highlight = null, className }) {
  const canvasRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  // Bumped whenever the theme class changes, to force a repaint with new colours.
  const [themeTick, setThemeTick] = useState(0)

  // Track the container's size rather than assuming one: the panel is fluid.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas?.parentElement) return

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ width, height })
    })
    observer.observe(canvas.parentElement)
    return () => observer.disconnect()
  }, [])

  // Repaint on theme flip. Without this the canvas keeps the old palette until a resize,
  // which is the exact bug the original component has when dropped into a dark app.
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeTick((tick) => tick + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !size.width || !size.height) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Render at device pixel ratio so dots are crisp rather than blurry on retina.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size.width * dpr
    canvas.height = size.height * dpr
    ctx.scale(dpr, dpr)

    const { width, height } = size
    const colours = readThemeColours()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Build the dot field once — regenerating it every frame would both cost time and make
    // the random opacities shimmer.
    const gap = 11
    const dots = []
    for (let x = 0; x < width; x += gap) {
      for (let y = 0; y < height; y += gap) {
        if (isLand(x / width, y / height) && Math.random() > 0.28) {
          dots.push({ x, y, opacity: Math.random() * 0.45 + 0.15 })
        }
      }
    }

    const points = destinations
      .filter((d) => d.latitude != null && d.longitude != null)
      .map((d) => ({ ...d, ...project(Number(d.longitude), Number(d.latitude), width, height) }))

    const origin =
      highlight?.latitude != null && highlight?.longitude != null
        ? {
            ...highlight,
            ...project(Number(highlight.longitude), Number(highlight.latitude), width, height),
          }
        : null

    // Routes fan out from the detected location when we have one, otherwise they chain the
    // destinations together — so the animation always means something.
    const routes = origin
      ? points.map((point, index) => ({ from: origin, to: point, delay: index * 0.7 }))
      : points.slice(0, -1).map((point, index) => ({
          from: point,
          to: points[index + 1],
          delay: index * 0.7,
        }))

    let frame
    const started = Date.now()
    const CYCLE_SECONDS = 12

    function drawStatic() {
      dots.forEach((dot) => {
        ctx.beginPath()
        ctx.arc(dot.x, dot.y, 1, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${colours.dot}, ${dot.opacity})`
        ctx.fill()
      })

      points.forEach((point) => {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = colours.route
        ctx.fill()
      })

      if (origin) {
        // Halo, then core — the detected location should read as "you are here" at a glance.
        ctx.beginPath()
        ctx.arc(origin.x, origin.y, 9, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${hexToRgb(colours.marker)}, 0.22)`
        ctx.fill()
        ctx.beginPath()
        ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = colours.marker
        ctx.fill()
      }
    }

    function drawRoutes(elapsed) {
      routes.forEach((route) => {
        const progress = reduceMotion
          ? 1
          : Math.max(0, Math.min((elapsed - route.delay) / 2.6, 1))
        if (progress <= 0) return

        const x = route.from.x + (route.to.x - route.from.x) * progress
        const y = route.from.y + (route.to.y - route.from.y) * progress

        ctx.beginPath()
        ctx.moveTo(route.from.x, route.from.y)
        ctx.lineTo(x, y)
        ctx.strokeStyle = `rgba(${hexToRgb(colours.accent)}, 0.55)`
        ctx.lineWidth = 1.25
        ctx.stroke()

        if (progress < 1) {
          ctx.beginPath()
          ctx.arc(x, y, 6, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${hexToRgb(colours.route)}, 0.3)`
          ctx.fill()
          ctx.beginPath()
          ctx.arc(x, y, 2.5, 0, Math.PI * 2)
          ctx.fillStyle = colours.route
          ctx.fill()
        }
      })
    }

    function render() {
      ctx.clearRect(0, 0, width, height)
      drawStatic()
      const elapsed = (Date.now() - started) / 1000
      drawRoutes(elapsed % CYCLE_SECONDS)
      frame = requestAnimationFrame(render)
    }

    if (reduceMotion) {
      // One static frame: the map is still informative, it just does not move.
      ctx.clearRect(0, 0, width, height)
      drawStatic()
      drawRoutes(Number.POSITIVE_INFINITY)
    } else {
      render()
    }

    return () => {
      if (frame) cancelAnimationFrame(frame)
    }
  }, [size, destinations, highlight, themeTick])

  return (
    <div className={className} aria-hidden="true">
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}
