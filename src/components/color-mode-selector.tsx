
/**
 * @fileOverview Componente para selecionar o modo de colorização dos equipamentos na cena 3D.
 * Permite ao usuário escolher como os equipamentos serão coloridos (por cor base,
 * estado operacional ou produto) através de um menu dropdown.
 */
"use client";

import { PaletteIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ColorMode } from '@/lib/types';

/**
 * Props para o componente ColorModeSelector.
 * @interface ColorModeSelectorProps
 * @property {ColorMode} colorMode - O modo de colorização atualmente selecionado.
 * @property {(mode: ColorMode) => void} onColorModeChange - Callback para quando o modo de colorização é alterado.
 */
interface ColorModeSelectorProps {
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
}

/**
 * Renderiza um Card com um dropdown para selecionar o modo de colorização dos equipamentos.
 * As opções são "Equipamento (Cor Base)", "Estado Operacional" e "Produto".
 * @param {ColorModeSelectorProps} props As props do componente.
 * @returns {JSX.Element} O componente do seletor de modo de coloração.
 */
export function ColorModeSelector({ colorMode, onColorModeChange }: ColorModeSelectorProps): JSX.Element {
  return (
    <Card className="shadow-md">
      <CardContent className="space-y-3 pt-4 p-3">
        <div className="space-y-1">
          <Label htmlFor="color-mode-select" className="text-xs text-muted-foreground flex items-center">
            <PaletteIcon className="mr-1.5 h-3.5 w-3.5" />
            Colorir equipamentos por
          </Label>
          <Select
            value={colorMode}
            onValueChange={(value) => onColorModeChange(value as ColorMode)}
          >
            <SelectTrigger id="color-mode-select" className="h-9">
              <SelectValue placeholder="Selecionar modo de coloração" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Equipamento">Equipamento (Cor Base)</SelectItem>
              <SelectItem value="Estado Operacional">Estado Operacional</SelectItem>
              <SelectItem value="Produto">Produto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

    