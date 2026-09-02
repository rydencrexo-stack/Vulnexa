"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function ParticleRing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.z = 7.75;
    const group = new THREE.Group();
    scene.add(group);

    const count = window.innerWidth < 700 ? 9500 : 17500;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const angles = new Float32Array(count);
    const bands = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * Math.PI * 2;
      const radius = 2.72;
      const tube = 0.36 + (Math.random() - 0.5) * 0.29;
      let x = (radius + tube * Math.cos(v)) * Math.cos(u);
      let y = (radius + tube * Math.cos(v)) * Math.sin(u);
      let z = tube * Math.sin(v);
      const ripple = 0.07 * Math.sin(u * 7 + v * 3) + 0.045 * Math.sin(u * 13 - v * 2);
      x *= 1 + ripple;
      y *= 1 + ripple;
      z += 0.055 * Math.sin(u * 9 + v * 5);
      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = z;
      seeds[index] = Math.random() * 100;
      angles[index] = u;
      bands[index] = v;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute("ang", new THREE.BufferAttribute(angles, 1));
    geometry.setAttribute("band", new THREE.BufferAttribute(bands, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        time: { value: 0 },
        mouse: { value: new THREE.Vector2() },
        pointerActive: { value: 0 },
        impulse: { value: 0 },
        size: { value: 2.16 },
      },
      vertexShader: `
        uniform float time; uniform vec2 mouse; uniform float pointerActive; uniform float impulse; uniform float size;
        attribute float seed; attribute float ang; attribute float band;
        varying vec3 col; varying float alpha;
        vec3 palette(float t) {
          vec3 cyan = vec3(.08, .58, 1.0);
          vec3 violet = vec3(.39, .19, 1.0);
          vec3 pink = vec3(.93, .26, .72);
          vec3 ember = vec3(1.0, .24, .06);
          if (t < .34) return mix(cyan, violet, t / .34);
          if (t < .68) return mix(violet, pink, (t - .34) / .34);
          return mix(pink, ember, (t - .68) / .32);
        }
        void main() {
          vec3 point = position;
          float tick = time * .30;
          float wave = sin(ang * 13. + band * 4. + tick * 2.2 + seed) * .045
            + sin(ang * 5. - band * 11. - tick * 1.5 + seed * .7) * .027;
          point.xy *= 1. + wave * (1. + impulse * .65);
          point.z += sin(ang * 9. + tick * 2.5 + seed) * .05;
          vec2 cursor = mouse * vec2(3.05, 2.45);
          vec2 delta = point.xy - cursor;
          float cursorDistance = length(delta);
          vec2 away = normalize(delta + vec2(.0001));
          float influence = exp(-cursorDistance * cursorDistance * 1.18) * pointerActive;
          float cursorWave = sin(cursorDistance * 24. - time * 6.) * influence * impulse;
          point.xy += away * (influence * (.14 + impulse * .18) + cursorWave * .045);
          point.z += influence * (.22 + impulse * .28);
          float positionY = clamp((point.y + 3.2) / 6.4, 0., 1.);
          col = palette(positionY);
          alpha = .26 + .74 * pow(1. - min(abs(point.z) / .75, 1.), 1.5);
          vec4 view = modelViewMatrix * vec4(point, 1.);
          gl_Position = projectionMatrix * view;
          gl_PointSize = size * (132. / -view.z) * (.7 + fract(seed) * .8);
        }
      `,
      fragmentShader: `
        varying vec3 col; varying float alpha;
        void main() {
          vec2 uv = gl_PointCoord - .5;
          float distanceToCenter = length(uv);
          if (distanceToCenter > .5) discard;
          float opacity = smoothstep(.5, 0., distanceToCenter) * alpha;
          gl_FragColor = vec4(col, opacity);
        }
      `,
    });
    const points = new THREE.Points(geometry, material);
    group.add(points);

    let mouseX = 0;
    let mouseY = 0;
    let pointerTarget = 0;
    let pointerImpulse = 0;
    let frame = 0;
    const pointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
      mouseY = -((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
      pointerTarget = 1;
      pointerImpulse = Math.min(1.25, pointerImpulse + Math.hypot(event.movementX, event.movementY) * 0.018);
    };
    const pointerLeave = () => { pointerTarget = 0; };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      renderer.setSize(Math.max(rect.width, 1), Math.max(rect.height, 1), false);
      camera.aspect = Math.max(rect.width, 1) / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
    };
    const clock = new THREE.Clock();
    const draw = () => {
      const elapsed = reduceMotion ? 0 : clock.getElapsedTime();
      material.uniforms.time.value = elapsed;
      material.uniforms.mouse.value.x += (mouseX - material.uniforms.mouse.value.x) * 0.055;
      material.uniforms.mouse.value.y += (mouseY - material.uniforms.mouse.value.y) * 0.055;
      material.uniforms.pointerActive.value += (pointerTarget - material.uniforms.pointerActive.value) * 0.08;
      material.uniforms.impulse.value += (pointerImpulse - material.uniforms.impulse.value) * 0.18;
      pointerImpulse *= 0.9;
      if (!reduceMotion) {
        group.rotation.z += 0.0003;
        const targetY = Math.sin(elapsed * 0.16) * 0.055 + mouseX * 0.16;
        const targetX = 0.04 + Math.sin(elapsed * 0.13) * 0.02 + mouseY * 0.11;
        group.rotation.y += (targetY - group.rotation.y) * 0.045;
        group.rotation.x += (targetX - group.rotation.x) * 0.045;
        group.position.x += (mouseX * 0.08 - group.position.x) * 0.035;
        group.position.y += (mouseY * 0.06 - group.position.y) * 0.035;
      }
      renderer.render(scene, camera);
      if (!reduceMotion) frame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", pointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", pointerLeave);
    draw();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", pointer);
      document.documentElement.removeEventListener("pointerleave", pointerLeave);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="ds-particle-ring" aria-hidden="true" />;
}
