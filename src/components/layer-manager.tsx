
/**
 * @fileOverview Componente para gerenciar a visibilidade das camadas de equipamentos e anotações.
 * Renderiza um card com checkboxes para cada camada, permitindo ao usuário controlar
 * o que é exibido na cena 3D.
 */
"use client";

import { LayersIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { Layer } from '@/lib/types';

/**
 * Props para o componente LayerManager.
 * @interface LayerManagerProps
 * @property {Layer[]} layers - A lista de camadas disponíveis e seus estados de visibilidade.
 * @property {(layerId: string) => void} onToggleLayer - Callback para quando a visibilidade de uma camada é alternada.
 */
interface LayerManagerProps {
  layers: Layer[];
  onToggleLayer: (layerId: string) => void;
}

/**
 * Renderiza um Card com checkboxes para controlar a visibilidade de cada camada.
 * Cada checkbox corresponde a uma camada (e.g., Prédios, Tanques, Anotações).
 * @param {LayerManagerProps} props As props do componente.
 * @returns {JSX.Element} O componente gerenciador de camadas.
 */
export function LayerManager({ layers, onToggleLayer }: LayerManagerProps): JSX.Element {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <LayersIcon className="mr-2 h-5 w-5" />
          Controle de Camadas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-2 p-3">
        {layers.map(layer => (
          <div key={layer.id} className="flex items-center space-x-2">
            <Checkbox
              id={`layer-${layer.id}`}
              checked={layer.isVisible}
              onCheckedChange={() => onToggleLayer(layer.id)}
              aria-label={`Alternar visibilidade da camada ${layer.name}`}
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

    