
/**
 * @fileOverview Custom hook para gerenciar o estado e as interações da câmera 3D.
 *
 * Responsabilidades:
 * - Manter o estado atual da câmera (`currentCameraState`), incluindo posição e ponto de observação.
 * - Manter o estado do sistema alvo para enquadramento (`targetSystemToFrame`).
 * - Fornecer funções para definir a visão da câmera para um sistema específico e lidar com mudanças de câmera
 *   iniciadas pelo usuário na cena 3D.
 * - Integrar mudanças de câmera (exceto foco em sistema) com o histórico de comandos (`useCommandHistory`).
 * - Fornecer posições e alvos iniciais padrão para a câmera.
 */
"use client";

import { useState, useCallback } from 'react';
import type { CameraState, Command } from '@/lib/types';

/** Posição inicial padrão da câmera. */
export const defaultInitialCameraPosition = { x: 25, y: 20, z: 25 };
/** Ponto de observação (lookAt) inicial padrão da câmera. */
export const defaultInitialCameraLookAt = { x: 0, y: 2, z: 0 };

/**
 * Props para o hook useCameraManager.
 * @interface UseCameraManagerProps
 * @property {(command: Command) => void} executeCommand - Função para executar comandos e adicioná-los ao histórico.
 */
interface UseCameraManagerProps {
  executeCommand: (command: Command) => void;
}

/**
 * Retorno do hook useCameraManager.
 * @interface UseCameraManagerReturn
 * @property {CameraState | undefined} currentCameraState - O estado atual da câmera (posição e ponto de observação).
 * @property {string | null} targetSystemToFrame - O nome do sistema alvo para a câmera enquadrar. Null se nenhum sistema estiver sendo focado.
 * @property {(systemName: string) => void} handleSetCameraViewForSystem - Define o sistema alvo para a câmera enquadrar.
 * @property {(newSceneCameraState: CameraState) => void} handleCameraChangeFromScene - Manipula mudanças de câmera provenientes da cena 3D e as registra no histórico.
 * @property {() => void} onSystemFramed - Callback para ser chamado pela ThreeScene após o enquadramento do sistema ser concluído, resetando o `targetSystemToFrame`.
 * @property {{ x: number; y: number; z: number }} defaultInitialCameraPosition - Posição inicial padrão da câmera.
 * @property {{ x: number; y: number; z: number }} defaultInitialCameraLookAt - Ponto de observação inicial padrão da câmera.
 */
export interface UseCameraManagerReturn {
  currentCameraState: CameraState | undefined;
  targetSystemToFrame: string | null;
  handleSetCameraViewForSystem: (systemName: string) => void;
  handleCameraChangeFromScene: (newSceneCameraState: CameraState) => void;
  onSystemFramed: () => void;
  defaultInitialCameraPosition: { x: number; y: number; z: number };
  defaultInitialCameraLookAt: { x: number; y: number; z: number };
}

/**
 * Hook customizado para gerenciar o estado e as interações da câmera 3D.
 * Responsável pelo estado da câmera, foco em sistemas e integração com o histórico de comandos.
 * @param {UseCameraManagerProps} props As props do hook, incluindo `executeCommand` para integração com o histórico.
 * @returns {UseCameraManagerReturn} Um objeto contendo o estado da câmera e funções para interagir com ela.
 */
export function useCameraManager({ executeCommand }: UseCameraManagerProps): UseCameraManagerReturn {
  const [currentCameraState, setCurrentCameraState] = useState<CameraState | undefined>({
    position: defaultInitialCameraPosition,
    lookAt: defaultInitialCameraLookAt,
  });
  const [targetSystemToFrame, setTargetSystemToFrame] = useState<string | null>(null);

  /**
   * Define o sistema alvo para a câmera enquadrar.
   * @param {string} systemName O nome do sistema para focar.
   */
  const handleSetCameraViewForSystem = useCallback((systemName: string) => {
    setTargetSystemToFrame(systemName);
  }, []);

  /**
   * Manipula as mudanças de câmera provenientes da cena 3D (e.g., órbita do usuário).
   * Registra a mudança no histórico de comandos.
   * @param {CameraState} newSceneCameraState O novo estado da câmera da cena.
   */
  const handleCameraChangeFromScene = useCallback((newSceneCameraState: CameraState) => {
    const oldCameraStateSnapshot = currentCameraState ? {
      position: { ...currentCameraState.position },
      lookAt: { ...currentCameraState.lookAt }
    } : undefined;

    // Evita disparos repetitivos para o mesmo estado (com uma pequena tolerância)
    if (oldCameraStateSnapshot &&
        Math.abs(oldCameraStateSnapshot.position.x - newSceneCameraState.position.x) < 0.01 &&
        Math.abs(oldCameraStateSnapshot.position.y - newSceneCameraState.position.y) < 0.01 &&
        Math.abs(oldCameraStateSnapshot.position.z - newSceneCameraState.position.z) < 0.01 &&
        Math.abs(oldCameraStateSnapshot.lookAt.x - newSceneCameraState.lookAt.x) < 0.01 &&
        Math.abs(oldCameraStateSnapshot.lookAt.y - newSceneCameraState.lookAt.y) < 0.01 &&
        Math.abs(oldCameraStateSnapshot.lookAt.z - newSceneCameraState.lookAt.z) < 0.01) {
      return;
    }

    const command: Command = {
      id: `orbit-camera-${Date.now()}`,
      type: 'CAMERA_MOVE',
      description: 'Câmera movimentada pelo usuário',
      execute: () => setCurrentCameraState(newSceneCameraState),
      undo: () => setCurrentCameraState(oldCameraStateSnapshot),
    };
    executeCommand(command);
  }, [currentCameraState, executeCommand]);

  /**
   * Callback para ser chamado pela ThreeScene após o enquadramento do sistema ser concluído.
   * Reseta o `targetSystemToFrame` para `null`.
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

    