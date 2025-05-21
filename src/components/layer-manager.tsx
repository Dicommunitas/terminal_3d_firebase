
"use client";

import type { ColorMode } from '@/app/page'; // Assuming ColorMode is exported from page.tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card'; // Removed CardHeader, CardTitle
// Removed PaletteIcon import

interface LayerManagerProps {
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
}

export function LayerManager({ colorMode, onColorModeChange }: LayerManagerProps) {
  return (
    <Card className="shadow-md">
      {/* CardHeader removed */}
      <CardContent className="space-y-3 pt-4"> {/* Added pt-4 for padding since header is gone */}
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
      </CardContent>
    </Card>
  );
}
