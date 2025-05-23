
/**
 * @fileoverview Componente de painel para controles de câmera, especificamente para focar em sistemas.
 * Renderiza botões para cada sistema disponível, permitindo ao usuário focar a câmera
 * e selecionar todos os equipamentos pertencentes àquele sistema.
 */
"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VideoIcon } from 'lucide-react';

/**
 * Props para o componente CameraControlsPanel.
 * @interface CameraControlsPanelProps
 * @property {string[]} systems - Lista de nomes dos sistemas disponíveis para foco.
 * @property {(systemName: string) => void} onSetView - Callback chamado quando um sistema é selecionado para foco.
 */
interface CameraControlsPanelProps {
  systems: string[];
  onSetView: (systemName: string) => void;
}

/**
 * Renderiza um painel com botões para focar a câmera em sistemas específicos.
 * Cada botão representa um sistema; ao clicar, a câmera enquadra os equipamentos desse sistema.
 * @param {CameraControlsPanelProps} props As props do componente.
 * @returns {JSX.Element} O componente CameraControlsPanel.
 */
export function CameraControlsPanel({ systems, onSetView }: CameraControlsPanelProps): JSX.Element {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <VideoIcon className="mr-2 h-5 w-5" />
          Focar no Sistema
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {systems.map((systemName) => (
          <Button
            key={systemName}
            variant="outline"
            size="sm"
            onClick={() => onSetView(systemName)}
            className="w-full"
          >
            {systemName}
          </Button>
        ))}
        {systems.length === 0 && (
          <p className="col-span-2 text-sm text-muted-foreground text-center">
            Nenhum sistema disponível para focar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

    