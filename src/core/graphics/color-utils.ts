
import * as THREE from 'three';
import type { Equipment } from '@/lib/types';
import type { ColorMode } from '@/components/layer-manager'; // Assuming ColorMode is exported

// Helper function to convert char to numeric value for color generation
// Maps '0'-'9' to 0-9, and 'A'-'Z' to 10-35
function getCharNumericValue(char: string): number {
  const upperChar = char.toUpperCase();
  if (char >= '0' && char <= '9') {
    return parseInt(char, 10);
  } else if (upperChar >= 'A' && upperChar <= 'Z') {
    return upperChar.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
  }
  return 0; // Default for other characters or if logic fails
}

export function getEquipmentColor(item: Equipment, colorMode: ColorMode): THREE.Color {
  const baseColor = new THREE.Color(item.color);
  let finalColor = new THREE.Color();
  let stateColor = new THREE.Color();

  switch (colorMode) {
    case 'Produto':
      if (item.product && item.product !== "Não aplicável" && item.product.length >= 3) {
        const rVal = getCharNumericValue(item.product.charAt(0));
        const gVal = getCharNumericValue(item.product.charAt(1));
        const bVal = getCharNumericValue(item.product.charAt(2));
        // Normalize based on the range 0-35
        finalColor.setRGB(rVal / 35.0, gVal / 35.0, bVal / 35.0);
      } else {
        finalColor.copy(baseColor);
      }
      break;
    case 'Estado Operacional':
      switch (item.operationalState) {
        case 'operando': stateColor.setHex(0xFF0000); break; // Vermelho
        case 'não operando': stateColor.setHex(0x00FF00); break; // Verde
        case 'manutenção': stateColor.setHex(0xFFFF00); break; // Amarelo
        case 'em falha': stateColor.setHex(0xDA70D6); break; // Roxo Orchid (quase rosa)
        case 'Não aplicável':
        default:
          stateColor.copy(baseColor);
          break;
      }
      finalColor.copy(stateColor);
      break;
    case 'Equipamento':
    default:
      finalColor.copy(baseColor);
      break;
  }
  return finalColor;
}
