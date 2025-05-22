
/**
 * @fileOverview Componente para gerenciar a visibilidade das camadas de equipamentos.
 * Permite ao usuário ativar ou desativar a visualização de diferentes tipos de camadas na cena 3D.
 */
"use client";

import { LayersIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { Layer } from '@/lib/types';

// ColorMode type definition, can be moved to types.ts if shared more broadly
export type ColorMode = 'Produto' | 'Estado Operacional' | 'Equipamento';


interface LayerManagerProps {
  layers: Layer[];
  onToggleLayer: (layerId: string) => void;
}

/**
 * Renderiza um Card com checkboxes para controlar a visibilidade de cada camada.
 * @param {LayerManagerProps} props As props do componente.
 * @returns {JSX.Element} O componente gerenciador de camadas.
 */
export function LayerManager({ layers, onToggleLayer }: LayerManagerProps) {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <LayersIcon className="mr-2 h-5 w-5" />
          Layer Visibility
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-2 p-3"> {/* Adjusted padding */}
        {layers.map(layer => (
          <div key={layer.id} className="flex items-center space-x-2">
            <Checkbox
              id={`layer-${layer.id}`}
              checked={layer.isVisible}
              onCheckedChange={() => onToggleLayer(layer.id)}
              aria-label={`Toggle visibility of ${layer.name} layer`}
            />
            <Label htmlFor={`layer-${layer.id}`} className="text-sm font-normal cursor-pointer">
              {layer.name}
            </Label>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
