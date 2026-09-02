"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { Activity, Braces, Radar, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import * as THREE from "three";

type EarthHeroMode = "bug-hunter" | "scanner" | "recon";

const COPY: Record<EarthHeroMode, {
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  model: string;
  status: string;
  metrics: Array<{ label: string; value: string }>;
}> = {
  "bug-hunter": {
    eyebrow: "PAN / ANTIGRAVITY OPERATIONS",
    title: "AI HUNTER",
    accent: "#a78bfa",
    description: "DeepSeek-driven attack-surface discovery, evidence validation, and comprehensive reporting in one live thread.",
    model: "DEEPSEEK V4 / OPENCODE",
    status: "AI HUNT READY",
    metrics: [{ label: "Playbooks", value: "75" }, { label: "Stream", value: "LIVE" }, { label: "Policy", value: "SAFE" }],
  },
  scanner: {
    eyebrow: "PAN / SECURITY OPERATIONS",
    title: "SCANNER",
    accent: "#67e8f9",
    description: "Orchestrate authorized security testing across the verified attack surface with specialist, evidence-first engines.",
    model: "MULTI-ENGINE ORCHESTRATION",
    status: "SCANNER READY",
    metrics: [{ label: "Engines", value: "08" }, { label: "Scope", value: "LOCKED" }, { label: "Queue", value: "READY" }],
  },
  recon: {
    eyebrow: "PAN / ORBITAL INTELLIGENCE",
    title: "RECON",
    accent: "#6ee7b7",
    description: "Build a live, evidence-backed surface model from subdomains, responsive hosts, JavaScript, APIs, and historical routes.",
    model: "GLOBAL SURFACE MODEL",
    status: "DISCOVERY READY",
    metrics: [{ label: "Modules", value: "08" }, { label: "Sources", value: "LIVE" }, { label: "Boundary", value: "VERIFIED" }],
  },
};

const TEXTURE_ROOT = "https://threejs.org/examples/textures/planets/";

function Earth() {
  const group = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const [day, normal, specular, lights, clouds] = useLoader(THREE.TextureLoader, [
    `${TEXTURE_ROOT}earth_atmos_2048.jpg`,
    `${TEXTURE_ROOT}earth_normal_2048.jpg`,
    `${TEXTURE_ROOT}earth_specular_2048.jpg`,
    `${TEXTURE_ROOT}earth_lights_2048.png`,
    `${TEXTURE_ROOT}earth_clouds_1024.png`,
  ]);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.065;
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.085;
  });

  return (
    <group ref={group} rotation={[0.08, -0.65, 0]}>
      <mesh>
        <sphereGeometry args={[2.45, 96, 96]} />
        <meshPhongMaterial map={day} normalMap={normal} specularMap={specular} shininess={12} />
      </mesh>
      <mesh scale={1.003}>
        <sphereGeometry args={[2.45, 96, 96]} />
        <meshBasicMaterial map={lights} transparent opacity={0.46} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={cloudsRef} scale={1.015}>
        <sphereGeometry args={[2.45, 96, 96]} />
        <meshPhongMaterial map={clouds} transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh scale={1.09}>
        <sphereGeometry args={[2.45, 96, 96]} />
        <meshBasicMaterial color="#3e8fd6" transparent opacity={0.055} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function Atmosphere() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color("#4da6e8") },
      intensity: { value: 0.9 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float intensity;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.2);
        float soft = smoothstep(0.0, 0.9, fresnel);
        gl_FragColor = vec4(glowColor, soft * 0.24 * intensity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  }), []);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh scale={1.075} material={material}>
      <sphereGeometry args={[2.45, 96, 96]} />
    </mesh>
  );
}

function EarthScene() {
  return (
    <Canvas camera={{ position: [0, 0, 7.5], fov: 39 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.35} color="#7ba7d0" />
      <directionalLight position={[-5, 3, 5]} intensity={2.2} color="#c7e4ff" />
      <directionalLight position={[5, -1, -3]} intensity={0.28} color="#274d80" />
      <pointLight position={[0, 0, 4]} intensity={0.45} color="#91c7ff" />
      <Suspense fallback={null}>
        <Earth />
        <Atmosphere />
      </Suspense>
    </Canvas>
  );
}

export function OrbitalEarthHero({ mode, className = "" }: { mode: EarthHeroMode; className?: string }) {
  const copy = COPY[mode];
  const ModeIcon = mode === "bug-hunter" ? Sparkles : mode === "scanner" ? ScanSearch : Radar;

  return (
    <section className={`relative isolate min-h-[390px] overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#03080d] shadow-[0_26px_80px_rgba(0,0,0,.34)] ${className}`} style={{ "--earth-accent": copy.accent } as CSSProperties}>
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_70%_45%,rgba(41,116,174,.14),transparent_37%),linear-gradient(90deg,#03080d_0%,rgba(3,8,13,.92)_38%,rgba(3,8,13,.2)_68%,#03080d_100%)]" />
      <div className="pointer-events-none absolute inset-0 z-[1] opacity-35 [background-image:linear-gradient(rgba(125,211,252,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,.035)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="pointer-events-none absolute -right-[175px] -bottom-[225px] h-[720px] w-[720px] sm:-right-[145px] sm:-bottom-[250px] sm:h-[790px] sm:w-[790px] lg:-right-[120px] lg:-bottom-[270px] lg:h-[850px] lg:w-[850px]">
        <EarthScene />
      </div>
      <div className="pointer-events-none absolute left-[29%] right-[7%] top-[55%] z-[2] h-px animate-[orbital-sweep_5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent" />
      <div className="pointer-events-none absolute right-[19%] top-[20%] z-[2] hidden h-40 w-40 rounded-full border border-cyan-300/[0.08] lg:block"><span className="absolute inset-5 rounded-full border border-cyan-300/[0.07]" /><span className="absolute inset-12 rounded-full border border-cyan-300/[0.1]" /></div>

      <div className="relative z-[3] flex min-h-[390px] max-w-[620px] flex-col px-6 py-8 sm:px-9 sm:py-10 lg:px-12 lg:py-12">
        <div className="flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[.2em] text-slate-500"><ModeIcon className="h-3.5 w-3.5" style={{ color: copy.accent }} /> {copy.eyebrow}</div>
        <h2 className="mt-5 text-[42px] font-semibold leading-none tracking-[.09em] text-slate-100 sm:text-[54px]">{copy.title}<span style={{ color: copy.accent }}>.</span></h2>
        <p className="mt-4 max-w-[470px] text-sm leading-6 text-slate-400 sm:text-[15px]">{copy.description}</p>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2 font-mono text-[9px] uppercase tracking-[.14em] text-slate-400"><Activity className="h-3.5 w-3.5" style={{ color: copy.accent }} /> {copy.model}</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/15 bg-emerald-300/[0.045] px-3 py-2 font-mono text-[9px] uppercase tracking-[.14em] text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> {copy.status}</span>
        </div>

        <div className="mt-auto grid max-w-[470px] grid-cols-3 divide-x divide-white/[0.07] border-t border-white/[0.07] pt-5">
          {copy.metrics.map((metric) => <div key={metric.label} className="px-3 first:pl-0"><span className="block font-mono text-sm font-semibold text-slate-200">{metric.value}</span><span className="mt-1 block font-mono text-[8px] uppercase tracking-[.13em] text-slate-600">{metric.label}</span></div>)}
        </div>
      </div>

      <div className="absolute bottom-5 right-6 z-[3] hidden items-center gap-2 font-mono text-[8px] uppercase tracking-[.16em] text-slate-600 md:flex"><ShieldCheck className="h-3 w-3 text-emerald-300/60" /> Earth observation model / rotating</div>
      <div className="absolute right-[23%] top-[43%] z-[3] hidden font-mono text-[8px] uppercase tracking-[.14em] text-cyan-200/55 lg:block"><Braces className="mb-2 h-3.5 w-3.5" /> Live surface<br />telemetry</div>
      <style jsx global>{`@keyframes orbital-sweep { 0%, 100% { opacity: .18; transform: translateX(-4%); } 50% { opacity: .85; transform: translateX(4%); } }`}</style>
    </section>
  );
}
