"use client";

import type { Layer } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LayersIcon } from 'lucide-react';

interface LayerManagerProps {
  layers: Layer[];
  onToggleLayer: (layerId: string) => void;
}

export function LayerManager({ layers, onToggleLayer }: LayerManagerProps) {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <LayersIcon className="mr-2 h-5 w-5" />
          Layer Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {layers.map((layer) => (
          <div key={layer.id} className="flex items-center space-x-2">
            <Checkbox
              id={`layer-${layer.id}`}
              checked={layer.isVisible}
              onCheckedChange={() => onToggleLayer(layer.id)}
              aria-label={`Toggle visibility of ${layer.name} layer`}
            />
            <Label htmlFor={`layer-${layer.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {layer.name}
            </Label>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
