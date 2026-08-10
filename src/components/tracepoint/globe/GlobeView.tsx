'use client';

import React, { Suspense, useRef, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, QuadraticBezierLine, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useGlobeStore } from '@/lib/store/app';
import type { GlobeMarker, GlobeArc } from '@/lib/types';

// ============================================================
// Constants
// ============================================================

const GLOBE_RADIUS = 2;
const ATMOSPHERE_RADIUS = 2.15;
const WIREFRAME_RADIUS = 2.005;
const MARKER_RADIUS = 0.025;
const PULSE_RING_RADIUS = 0.045;
const ARC_ALTITUDE_FACTOR = 0.4;
const ORIGIN = new THREE.Vector3(0, 0, 0);

const MARKER_COLORS: Record<GlobeMarker['type'], string> = {
  identity: '#f59e0b',
  business: '#22c55e',
  device: '#06b6d4',
  source: '#6b7280',
};

const ARC_DEFAULT_COLOR = '#f59e0b';

// ============================================================
// Utilities
// ============================================================

/** Convert latitude/longitude to a point on the globe surface */
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

/** Compute a control point elevated above the midpoint of two positions for arc curvature */
function computeArcMidpoint(
  start: THREE.Vector3,
  end: THREE.Vector3,
): [number, number, number] {
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const distance = start.distanceTo(end);
  const altitude = GLOBE_RADIUS + distance * ARC_ALTITUDE_FACTOR;
  mid.normalize().multiplyScalar(altitude);
  return [mid.x, mid.y, mid.z];
}

// ============================================================
// Atmosphere Glow Shader
// ============================================================

const atmosphereVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragmentShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 viewDir = normalize(-vPosition);
    float fresnel = 1.0 - dot(viewDir, vNormal);
    fresnel = pow(fresnel, 3.0) * 0.6;
    vec3 glowColor = mix(vec3(0.06, 0.15, 0.25), vec3(0.1, 0.25, 0.4), fresnel);
    gl_FragColor = vec4(glowColor, fresnel * 0.7);
  }
`;

// ============================================================
// Earth Components
// ============================================================

/** Solid dark sphere + wireframe grid overlay + lat/long reference lines */
function Earth() {
  return (
    <group>
      {/* Solid dark sphere — base earth */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
        <meshStandardMaterial color="#1a2840" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Wireframe grid overlay */}
      <mesh>
        <sphereGeometry args={[WIREFRAME_RADIUS, 36, 18]} />
        <meshBasicMaterial color="#2a4a5a" wireframe transparent opacity={0.12} />
      </mesh>

      {/* Subtle latitude/longitude reference rings */}
      <LatLongRings />
    </group>
  );
}

/** Decorative latitude/longitude reference lines at key parallels and meridians */
function LatLongRings() {
  const latitudes = [-60, -30, 0, 30, 60];
  const longitudes = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];

  const lines = useMemo(() => {
    const result: Array<{ points: THREE.Vector3[] }> = [];

    for (const lat of latitudes) {
      const pts: THREE.Vector3[] = [];
      for (let lng = -180; lng <= 180; lng += 3) {
        pts.push(latLngToVector3(lat, lng, WIREFRAME_RADIUS + 0.002));
      }
      result.push({ points: pts });
    }

    for (const lng of longitudes) {
      const pts: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 3) {
        pts.push(latLngToVector3(lat, lng, WIREFRAME_RADIUS + 0.002));
      }
      result.push({ points: pts });
    }

    return result;
  }, []);

  return (
    <group>
      {lines.map((line, i) => (
        <Line
          key={i}
          points={line.points}
          color="#1e3a4a"
          transparent
          opacity={0.08}
          lineWidth={0.5}
        />
      ))}
    </group>
  );
}

/** Atmospheric glow effect — Fresnel-based rim shader on a backface sphere */
function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  return (
    <mesh material={material}>
      <sphereGeometry args={[ATMOSPHERE_RADIUS, 64, 64]} />
    </mesh>
  );
}

// ============================================================
// Markers
// ============================================================

/** Single marker with a core dot and pulsing outer ring */
function MarkerDot({ marker }: { marker: GlobeMarker }) {
  const pulseRef = useRef<THREE.Mesh>(null!);
  const color = MARKER_COLORS[marker.type];
  const phaseOffset = useRef(Math.random() * Math.PI * 2);

  const position = useMemo(
    () => latLngToVector3(marker.lat, marker.lng, GLOBE_RADIUS + 0.012),
    [marker.lat, marker.lng],
  );

  // Orientation quaternion so the marker group faces outward from the globe center
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const dir = position.clone().normalize();
    q.setFromUnitVectors(up, dir);
    return q;
  }, [position]);

  useFrame(({ clock }) => {
    if (!pulseRef.current) return;
    const t = clock.getElapsedTime() + phaseOffset.current;
    const pulse = 1 + 0.3 * Math.sin(t * 2.5);
    pulseRef.current.scale.setScalar(pulse);
    (pulseRef.current.material as THREE.MeshBasicMaterial).opacity =
      0.5 - 0.25 * Math.sin(t * 2.5);
  });

  return (
    <group position={position} quaternion={quaternion}>
      {/* Core dot */}
      <mesh>
        <sphereGeometry args={[MARKER_RADIUS, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Pulsing outer ring */}
      <mesh ref={pulseRef}>
        <sphereGeometry args={[PULSE_RING_RADIUS, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} />
      </mesh>
      {/* Subtle point light for glow visibility on dark surface */}
      <pointLight color={color} intensity={0.4} distance={0.35} decay={2} />
    </group>
  );
}

/** Renders all globe markers from the store */
function Markers() {
  const markers = useGlobeStore((s) => s.markers);
  return (
    <group>
      {markers.map((m) => (
        <MarkerDot key={m.id} marker={m} />
      ))}
    </group>
  );
}

// ============================================================
// Arcs
// ============================================================

/** Single animated arc between two geographic points */
function ArcLine({ arc }: { arc: GlobeArc }) {
  const lineRef = useRef<any>(null);

  const start = useMemo(
    () => latLngToVector3(arc.startLat, arc.startLng, GLOBE_RADIUS + 0.015),
    [arc.startLat, arc.startLng],
  );
  const end = useMemo(
    () => latLngToVector3(arc.endLat, arc.endLng, GLOBE_RADIUS + 0.015),
    [arc.endLat, arc.endLng],
  );
  const mid = useMemo(() => computeArcMidpoint(start, end), [start, end]);

  const color = arc.color ?? ARC_DEFAULT_COLOR;

  // Animate dashed line flow effect
  useFrame(() => {
    if (lineRef.current?.material) {
      lineRef.current.material.dashOffset -= 0.015;
    }
  });

  return (
    <QuadraticBezierLine
      ref={lineRef}
      start={[start.x, start.y, start.z]}
      end={[end.x, end.y, end.z]}
      mid={mid}
      color={color}
      lineWidth={1}
      transparent
      opacity={0.7}
      dashed
      dashSize={0.06}
      gapSize={0.04}
    />
  );
}

/** Renders all arcs from the store */
function Arcs() {
  const arcs = useGlobeStore((s) => s.arcs);
  return (
    <group>
      {arcs.map((a) => (
        <ArcLine key={a.id} arc={a} />
      ))}
    </group>
  );
}

// ============================================================
// Camera Controls
// ============================================================

/**
 * Unified controller: OrbitControls with damping, auto-rotate,
 * idle-resume, and fly-to-animation when focusedLocation changes.
 */
function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const focusedLocation = useGlobeStore((s) => s.focusedLocation);
  const targetCameraPos = useRef<THREE.Vector3 | null>(null);
  const isAnimating = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fly-to: compute target camera position when focusedLocation changes
  useEffect(() => {
    if (focusedLocation) {
      const surfacePoint = latLngToVector3(
        focusedLocation.lat,
        focusedLocation.lng,
        GLOBE_RADIUS,
      );
      const cameraDistance = GLOBE_RADIUS * 1.5;
      targetCameraPos.current = surfacePoint
        .clone()
        .normalize()
        .multiplyScalar(GLOBE_RADIUS + cameraDistance);
      isAnimating.current = true;

      // Disable auto-rotate during fly-to
      if (controlsRef.current) {
        controlsRef.current.autoRotate = false;
      }
    }
  }, [focusedLocation]);

  const scheduleIdleResume = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (controlsRef.current) {
        controlsRef.current.autoRotate = true;
      }
    }, 4000);
  }, []);

  // Smooth camera interpolation each frame
  useFrame(() => {
    if (!controlsRef.current) return;

    if (isAnimating.current && targetCameraPos.current) {
      camera.position.lerp(targetCameraPos.current, 0.03);
      camera.lookAt(ORIGIN);

      if (camera.position.distanceTo(targetCameraPos.current) < 0.05) {
        isAnimating.current = false;
        // Resume auto-rotate after a delay
        scheduleIdleResume();
      }
    }

    controlsRef.current.update();
  });

  const handleInteractionStart = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = false;
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, []);

  const handleInteractionEnd = useCallback(() => {
    scheduleIdleResume();
  }, [scheduleIdleResume]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={3}
      maxDistance={8}
      enableDamping
      dampingFactor={0.05}
      rotateSpeed={0.5}
      autoRotate
      autoRotateSpeed={0.3}
      onStart={handleInteractionStart}
      onEnd={handleInteractionEnd}
    />
  );
}

// ============================================================
// Scene (lazy-loaded)
// ============================================================

function GlobeSceneInner() {
  return (
    <Canvas
      camera={{ position: [0, 1.5, 5], fov: 45, near: 0.1, far: 1000 }}
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 3, 5]} intensity={0.8} color="#c0d0e0" />
      <directionalLight position={[-3, -2, -3]} intensity={0.2} color="#3a5a7a" />

      {/* Star field background */}
      <Stars
        radius={100}
        depth={80}
        count={3000}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />

      {/* Earth globe with wireframe overlay */}
      <Earth />

      {/* Atmospheric glow */}
      <Atmosphere />

      {/* Data markers and arcs from the store */}
      <Markers />
      <Arcs />

      {/* Camera controls: damping, auto-rotate, fly-to */}
      <CameraController />
    </Canvas>
  );
}

// ============================================================
// Loading Fallback
// ============================================================

function GlobeLoadingFallback() {
  return (
    <div className="tp-globe-container absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        {/* Tactical spinner ring */}
        <div className="relative h-12 w-12">
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
            style={{
              borderTopColor: '#f59e0b',
              animationDuration: '1.5s',
            }}
          />
          <div className="absolute inset-2 rounded-full border border-[#3a4a3a]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-[#f59e0b]/60" />
          </div>
        </div>
        <span
          className="text-xs tracking-widest uppercase"
          style={{
            fontFamily: 'var(--font-geist-mono), monospace',
            color: '#8a9a8a',
          }}
        >
          Initializing Globe&hellip;
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Public Exports
// ============================================================

/** The lazy-loaded 3D globe scene. Wrap with <GlobeView /> for Suspense fallback. */
export const GlobeScene = React.lazy(() =>
  Promise.resolve({ default: GlobeSceneInner }),
);

/** Wrapper component that provides the globe with a Suspense loading fallback. */
export function GlobeView() {
  return (
    <div className="tp-globe-container relative w-full h-full">
      <Suspense fallback={<GlobeLoadingFallback />}>
        <GlobeScene />
      </Suspense>
    </div>
  );
}
