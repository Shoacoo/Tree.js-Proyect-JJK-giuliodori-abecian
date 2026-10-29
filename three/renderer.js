import * as THREE from 'three';

// Renderer compartido por las tres escenas. Si el navegador no da un contexto WebGL
// (sin GPU, o bloqueado después de perder el contexto varias veces) devuelve null
// y cada escena sigue sin 3D en lugar de tirar la página entera.
export function createRenderer({ onLost, ...options } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ powerPreference: 'high-performance', ...options });
  } catch (error) {
    console.warn('[3D] WebGL no disponible:', error?.message ?? error);
    return null;
  }

  // Un shader con errores de GLSL se informa completo. Si el enlace falla sin ningún log
  // es la GPU (contexto perdido o driver): se avisa una sola vez y no un error por material.
  let gpuWarned = false;
  renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
    const logs = [gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment)].map((log) => (log || '').trim());
    if (logs.some(Boolean)) console.error('[3D] error de shader', ...logs.filter(Boolean));
    else if (!gpuWarned) {
      gpuWarned = true;
      console.warn('[3D] la GPU no pudo preparar los materiales');
    }
  };

  // three deja de dibujar mientras el contexto está perdido y lo recupera solo.
  // El evento llega después de la limpieza de la escena (forceContextLoss y el canvas
  // ya fuera del DOM): esa pérdida es a propósito y no cuenta.
  renderer.domElement.addEventListener('webglcontextlost', () => {
    if (!renderer.domElement.isConnected) return;
    console.warn('[3D] se perdió el contexto WebGL');
    onLost?.();
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    gpuWarned = false;
  });
  return renderer;
}
