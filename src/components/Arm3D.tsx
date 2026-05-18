import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment } from "@react-three/drei";
import * as THREE from "three";

interface Arm3DProps {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

const l1 = 0.1;
const l2 = 0.43;
const l3 = 0.43;
const l4 = 0.213;

function Link({
  position,
  rotation,
  length,
  color,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  length: number;
  color: string;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.02, 0.02, length, 16]} />
        <meshStandardMaterial
          color={color}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

export default function Arm3D({ q1, q2, q3, q4 }: Arm3DProps) {
  const baseRef = useRef<THREE.Group>(null);

  const deg2rad = (d: number) => (d * Math.PI) / 180;
  const q1r = deg2rad(q1);
  const q2r = deg2rad(q2);
  const q3r = deg2rad(q3);
  const q4r = deg2rad(q4);

  return (
    <div className="h-[400px] w-full bg-gray-900 rounded-lg">
      <Canvas shadows>
        {/* Iluminación */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[2, 3, 2]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        {/* Cámara y controles */}
        <PerspectiveCamera makeDefault position={[1.2, 0.8, 1.2]} />
        <OrbitControls enablePan enableZoom enableRotate />

        {/* 🌟 HDR local, sin internet */}
        <Environment files="/empty_warehouse_01_1k.hdr" background />

        {/* Plano del suelo */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[4, 4]} />
          <meshStandardMaterial color="#222" />
        </mesh>

        {/* Ejes y grilla */}
        <axesHelper args={[0.5]} />
        <gridHelper args={[2, 20, "white", "gray"]} />

        {/* Base fija */}
        <mesh position={[0, l1 / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.1, 0.1, l1, 32]} />
          <meshStandardMaterial color="gray" metalness={0.4} roughness={0.6} />
        </mesh>

        {/* Brazo principal */}
        <group ref={baseRef} position={[0, l1, 0]} rotation={[0, q1r, 0]}>
          {/* Joint 2 */}
          <group position={[0, 0, 0]} rotation={[0, 0, q2r]}>
            <Link position={[l2 / 2, 0, 0]} length={l2} color="blue" />

            {/* Joint 3 */}
            <group position={[l2, 0, 0]} rotation={[0, 0, q3r]}>
              <Link position={[l3 / 2, 0, 0]} length={l3} color="red" />

              {/* Joint 4 */}
              <group position={[l3, 0, 0]} rotation={[0, 0, q4r]}>
                <Link position={[l4 / 2, 0, 0]} length={l4} color="green" />

                {/* End Effector */}
                <mesh position={[l4, 0, 0]} castShadow>
                  <sphereGeometry args={[0.03, 16, 16]} />
                  <meshStandardMaterial color="yellow" emissive="gold" />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </Canvas>
    </div>
  );
}
