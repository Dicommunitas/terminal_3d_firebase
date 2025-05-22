
/**
 * @fileoverview Custom hook para gerenciar o histórico de comandos (Undo/Redo).
 *
 * Este hook permite registrar comandos executados pelo usuário e fornece
 * funcionalidades para desfazer (undo) e refazer (redo) esses comandos.
 * Cada comando deve implementar métodos `execute` e `undo`.
 */
"use client";

import type { Command } from '@/lib/types';
import { useState, useCallback } from 'react';

interface CommandHistoryState {
  history: Command[];
  currentIndex: number; // Aponta para o último comando executado
}

/**
 * Hook para gerenciar um histórico de comandos, permitindo Undo e Redo.
 * @param initialState Estado inicial opcional para o histórico.
 * @returns Um objeto com funções para executar, desfazer, refazer comandos,
 * e flags indicando se undo/redo são possíveis, além do próprio histórico.
 */
export function useCommandHistory(initialState?: CommandHistoryState) {
  const [state, setState] = useState<CommandHistoryState>(
    initialState || { history: [], currentIndex: -1 }
  );

  /**
   * Executa um comando e o adiciona ao histórico.
   * Qualquer comando refeito após este ponto é descartado do histórico.
   * @param command O comando a ser executado.
   */
  const executeCommand = useCallback((command: Command) => {
    command.execute();
    setState((prevState) => {
      const newHistory = prevState.history.slice(0, prevState.currentIndex + 1);
      newHistory.push(command);
      return {
        history: newHistory,
        currentIndex: newHistory.length - 1,
      };
    });
  }, []);

  /**
   * Desfaz o último comando executado.
   */
  const undo = useCallback(() => {
    setState((prevState) => {
      if (prevState.currentIndex < 0) return prevState; // Nenhum comando para desfazer
      const commandToUndo = prevState.history[prevState.currentIndex];
      commandToUndo.undo();
      return {
        ...prevState,
        currentIndex: prevState.currentIndex - 1,
      };
    });
  }, []);

  /**
   * Refaz o último comando desfeito.
   */
  const redo = useCallback(() => {
    setState((prevState) => {
      if (prevState.currentIndex >= prevState.history.length - 1) return prevState; // Nenhum comando para refazer
      const commandToRedo = prevState.history[prevState.currentIndex + 1];
      commandToRedo.execute();
      return {
        ...prevState,
        currentIndex: prevState.currentIndex + 1,
      };
    });
  }, []);

  const canUndo = state.currentIndex >= 0;
  const canRedo = state.currentIndex < state.history.length - 1;
  const commandHistory = state.history;

  return { executeCommand, undo, redo, canUndo, canRedo, commandHistory };
}
