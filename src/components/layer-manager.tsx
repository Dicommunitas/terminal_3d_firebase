
"use client";

import { LayersIcon, PaletteIcon } from 'lucide-react'; // PaletteIcon might be more suitable
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { Layer } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type ColorMode = 'Produto' | 'Estado Operacional' | 'Equipamento';

interface LayerManagerProps {
  layers: Layer[];
  onToggleLayer: (layerId: string) => void;
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
}

export function LayerManager({ layers, onToggleLayer, colorMode, onColorModeChange }: LayerManagerProps) {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <PaletteIcon className="mr-2 h-5 w-5" /> {/* Changed to PaletteIcon */}
          Colorization & Layers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <div className="space-y-1">
          <Label htmlFor="color-mode-select" className="text-xs text-muted-foreground">
            Colorize equipment by
          </Label>
          <Select
            value={colorMode}
            onValueChange={(value) => onColorModeChange(value as ColorMode)}
          >
            <SelectTrigger id="color-mode-select" className="h-9">
              <SelectValue placeholder="Select colorization mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Equipamento">Equipamento (Base Color)</SelectItem>
              <SelectItem value="Estado Operacional">Estado Operacional</SelectItem>
              <SelectItem value="Produto">Produto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2 pt-2">
            <Label className="text-xs text-muted-foreground flex items-center">
                <LayersIcon className="mr-1.5 h-3.5 w-3.5" />
                Toggle Layer Visibility
            </Label>
            {layers.map(layer => (
                <div key={layer.id} className="flex items-center space-x-2">
                <Checkbox
                    id={`layer-${layer.id}`}
                    checked={layer.isVisible}
                    onCheckedChange={() => onToggleLayer(layer.id)}
                    aria-label={`Toggle visibility of ${layer.name} layer`}
                />
                <Label htmlFor={`layer-${layer.id}`} className="text-sm font-normal">
                    {layer.name}
                </Label>
                </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
