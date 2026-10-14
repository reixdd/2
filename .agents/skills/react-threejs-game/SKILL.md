---
name: react-threejs-game
description: Three.js game development with React using @react-three/fiber and @react-three/drei — strict TypeScript, 60 fps, accessible
license: MIT
---

# react-threejs-game Skill

## Context

Applies when building 3D scenes, implementing game loops, handling 3D interactions, optimizing Three.js rendering, loading assets, or managing game state with React.

## Rules

1. **Declarative first** — `@react-three/fiber` JSX, not imperative Three.js
2. **Type everything** — `useRef<THREE.Mesh>(null)`, typed props, typed event handlers
3. **`useFrame` for the game loop** — `((state, delta) => …)` — delta time, not wall-clock
4. **Refs for Three.js objects** — never mutate props
5. **Minimize re-renders** — 60 Hz updates go through refs, not `useState`
6. **Use Drei helpers** — `OrbitControls`, `useTexture`, `Html`, `Sparkles`, `Trail`
7. **Mesh events** — `onClick`, `onPointerOver` on meshes — no manual raycasting
8. **Dispose resources** — geometries, materials, textures, audio buffers on unmount
9. **InstancedMesh** for > 10 similar objects (particles, bullets, enemies)
10. **Target 60 fps** — frame time ≤ 16.67 ms; profile with React DevTools + Spector.js
11. **Separate concerns** — logic in hooks, rendering in JSX, state in React
12. **No `useState` inside `useFrame`** — use refs for transient animation state
13. **Accessibility** — keyboard equivalents, `prefers-reduced-motion`, readable HUD contrast
14. **Asset safety** — load textures/models only from trusted origins; no user-supplied URLs without validation

## Examples

### ✅ Typed interactive object with `useFrame`

```tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TargetProps {
  position: readonly [number, number, number];
  size: number;
  onClick: () => void;
}

export function Target({ position, size, onClick }: TargetProps): JSX.Element {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.rotation.y += delta * 0.5;
    mesh.position.y = position[1] + Math.sin(state.clock.elapsedTime) * 0.3;
  });

  return (
    <mesh ref={meshRef} position={position} onClick={onClick}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  );
}
```

### ✅ Resource disposal on unmount

```tsx
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

function Ring(): JSX.Element {
  const geometry = useMemo(() => new THREE.TorusGeometry(1, 0.2, 16, 64), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: 'cyan' }), []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return <mesh geometry={geometry} material={material} />;
}
```

### ✅ Respecting reduced-motion

```tsx
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
useFrame((_, delta) => {
  const speed = prefersReduced ? 0 : 0.5;
  if (meshRef.current) meshRef.current.rotation.y += delta * speed;
});
```

### ❌ Anti-Patterns

```typescript
// BAD: setInterval for animation
setInterval(() => { mesh.rotation.y += 0.01 }, 16);

// BAD: useState in useFrame (60 renders/sec)
useFrame(() => setPosition(p => p + 1));

// BAD: untyped ref
const meshRef = useRef(null);

// BAD: forgetting disposal
// Leaks geometry and material on unmount

// BAD: loading textures from user-supplied URLs without validation
useTexture(userInputUrl);
```

## Validation Checklist

- [ ] Refs are typed (`useRef<THREE.X>(null)`)
- [ ] Animations use `useFrame` + delta; no timers
- [ ] No `useState` inside `useFrame`
- [ ] Geometries / materials / textures disposed
- [ ] > 10 similar meshes → `InstancedMesh`
- [ ] `prefers-reduced-motion` honored
- [ ] Asset URLs validated / from bundled sources
- [ ] Frame time under 16.67 ms on target hardware
