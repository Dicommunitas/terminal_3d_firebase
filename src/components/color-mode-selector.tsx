
/**
 * @fileOverview Componente para selecionar o modo de colorização dos equipamentos na cena 3D.
 */
"use client";

import { PaletteIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ColorMode } from '@/components/layer-manager'; // Assuming ColorMode is still defined here or moved to types.ts

interface ColorModeSelectorProps {
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
}

/**
 * Renderiza um Card com um dropdown para selecionar o modo de colorização.
 * @param {ColorModeSelectorProps} props As props do componente.
 * @returns {JSX.Element} O componente do seletor de modo de coloração.
 */
export function ColorModeSelector({ colorMode, onColorModeChange }: ColorModeSelectorProps) {
  return (
    <Card className="shadow-md">
      <CardContent className="space-y-3 pt-4 p-3"> {/* Adjusted padding */}
        <div className="space-y-1">
          <Label htmlFor="color-mode-select" className="text-xs text-muted-foreground flex items-center">
            <PaletteIcon className="mr-1.5 h-3.5 w-3.5" />
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
      </CardContent>
    </Card>
  );
}
