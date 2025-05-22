
/**
 * @fileOverview Custom hook para gerenciar o estado e as interações da câmera.
 *
 * Responsabilidades:
 * - Manter o estado atual da câmera (`currentCameraState`).
 * - Manter o estado do sistema alvo para enquadramento (`targetSystemToFrame`).
 * - Fornecer funções para definir a visão da câmera para um sistema e lidar com mudanças de câmera da cena 3D.
 * - Integrar mudanças de câmera (exceto foco em sistema) com o histórico de comandos.
 */
"use client";

import { useState, useCallback } from 'react';
import type { CameraState, Command } from '@/lib/types';

const defaultInitialCameraPosition = { x: 25, y: 20, z: 25 };
const defaultInitialCameraLookAt = { x: 0, y: 2, z: 0 };

/**
 * Props para o hook useCameraManager.
 */
interface UseCameraManagerProps {
  executeCommand: (command: Command) => void;
}

/**
 * Retorno do hook useCameraManager.
 */
interface UseCameraManagerReturn {
  currentCameraState: CameraState | undefined;
  targetSystemToFrame: string | null;
  handleSetCameraViewForSystem: (systemName: string) => void;
  handleCameraChangeFromScene: (newSceneCameraState: CameraState) => void;
  onSystemFramed: () => void;
  defaultInitialCameraPosition: { x: number; y: number; z: number };
  defaultInitialCameraLookAt: { x: number; y: number; z: number };
}

/**
 * Hook para gerenciar o estado e as interações da câmera.
 * @param executeCommand Função para executar comandos e adicioná-los ao histórico.
 * @returns Um objeto contendo o estado da câmera e funções para interagir com ela.
 */
export function useCameraManager({ executeCommand }: UseCameraManagerProps): UseCameraManagerReturn {
  const [currentCameraState, setCurrentCameraState] = useState<CameraState | undefined>({
    position: defaultInitialCameraPosition,
    lookAt: defaultInitialCameraLookAt,
  });
  const [targetSystemToFrame, setTargetSystemToFrame] = useState<string | null>(null);

  /**
   * Define o sistema alvo para a câmera enquadrar.
   * A lógica de seleção de equipamentos associada a este foco permanece em `page.tsx` ou em `useEquipmentSelectionManager`.
   * @param systemName O nome do sistema para focar.
   */
  const handleSetCameraViewForSystem = useCallback((systemName: string) => {
    setTargetSystemToFrame(systemName);
    // A seleção de equipamentos é tratada separadamente pelo useEquipmentSelectionManager
  }, []);

  /**
   * Manipula as mudanças de câmera provenientes da cena 3D (e.g., órbita do usuário).
   * Registra a mudança no histórico de comandos.
   * @param newSceneCameraState O novo estado da câmera da cena.
   */
  const handleCameraChangeFromScene = useCallback((newSceneCameraState: CameraState) => {
    // Evita disparos repetitivos para o mesmo estado
    if (currentCameraState &&
        Math.abs(currentCameraState.position.x - newSceneCameraState.position.x) < 0.01 &&
        Math.abs(currentCameraState.position.y - newSceneCameraState.position.y) < 0.01 &&
        Math.abs(currentCameraState.position.z - newSceneCameraState.position.z) < 0.01 &&
        Math.abs(currentCameraState.lookAt.x - newSceneCameraState.lookAt.x) < 0.01 &&
        Math.abs(currentCameraState.lookAt.y - newSceneCameraState.lookAt.y) < 0.01 &&
        Math.abs(currentCameraState.lookAt.z - newSceneCameraState.lookAt.z) < 0.01) {
      return;
    }

    const oldCameraState = currentCameraState ? { ...currentCameraState } : undefined;
    const command: Command = {
      id: `orbit-camera-${Date.now()}`,
      type: 'CAMERA_MOVE',
      description: 'Câmera orbitada pelo usuário',
      execute: () => setCurrentCameraState(newSceneCameraState),
      undo: () => setCurrentCameraState(oldCameraState),
    };
    executeCommand(command);
  }, [currentCameraState, executeCommand]);

  /**
   * Callback para ser chamado pela ThreeScene após o enquadramento do sistema ser concluído.
   */
  const onSystemFramed = useCallback(() => {
    setTargetSystemToFrame(null);
  }, []);

  return {
    currentCameraState,
    targetSystemToFrame,
    handleSetCameraViewForSystem,
    handleCameraChangeFromScene,
    onSystemFramed,
    defaultInitialCameraPosition,
    defaultInitialCameraLookAt,
  };
}
