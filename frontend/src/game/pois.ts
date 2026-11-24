import type { ItemId } from './constants.ts';
import { heightAt } from './terrainData.ts';

export type PoiKind = 'cave' | 'pillar' | 'wreck_chest' | 'garden' | 'copper' | 'titanium' | 'sample' | 'crystal' | 'rare';

export interface PoiDef {
  id: string; name: string; kind: PoiKind; x: number; z: number; yOffset: number;
  category: string; info: string; scanTime: number; hidden: boolean;
  reward?: { item: ItemId; qty: number };
  journal: boolean;
}

const nodes = (kind: PoiKind, name: string, item: ItemId, qty: number, pts: [number, number][], info: string): PoiDef[] =>
  pts.map(([x, z], i) => ({ id: `${kind}_${i + 1}`, name, kind, x, z, yOffset: 0.6, category: 'Resource', info, scanTime: 1.4, hidden: false, reward: { item, qty }, journal: false }));

export const POIS: PoiDef[] = [
  { id: 'reef_cave', name: 'Hidden reef cave', kind: 'cave', x: -95, z: 20, yOffset: 3, category: 'Cave', info: 'A shallow cave worn into the reef wall. The walls are lined with pale coral that never sees direct sunlight.', scanTime: 3.5, hidden: true, journal: true, reward: { item: 'rare_mineral', qty: 1 } },
  { id: 'ancient_pillar', name: 'Carved pillar', kind: 'pillar', x: 70, z: 150, yOffset: 0, category: 'Ancient structure', info: 'A stone column covered in spiral inscriptions. Its base is far older than any shipwreck nearby.', scanTime: 4, hidden: false, journal: true, reward: { item: 'artifact', qty: 1 } },
  { id: 'wreck_chest', name: 'Cargo chest', kind: 'wreck_chest', x: 120, z: -40, yOffset: 0.6, category: 'Shipwreck', info: 'A sealed chest from the wreck of a supply ship. Its lock has long since rusted through.', scanTime: 2.5, hidden: true, journal: true, reward: { item: 'titanium', qty: 3 } },
  { id: 'coral_garden', name: 'Luminous coral garden', kind: 'garden', x: -40, z: -90, yOffset: 0, category: 'Coral reef', info: 'A dense patch of coral that glows faintly. A previously uncharted reef section.', scanTime: 3, hidden: false, journal: true },
  ...nodes('copper', 'Copper outcrop', 'copper', 2, [[-20, 40], [55, -20], [-70, -50], [30, 90]], 'Green-streaked rock rich in copper ore.'),
  ...nodes('titanium', 'Titanium vein', 'titanium', 1, [[100, 40], [-120, 90]], 'A dark metallic vein exposed by the current.'),
  ...nodes('sample', 'Sample site', 'sample', 1, [[10, -60], [-60, 10], [85, 70]], 'Mineral-rich water seeping from the seabed. Good for a water sample.'),
  ...nodes('crystal', 'Energy crystal', 'energy_crystal', 1, [[-10, 160]], 'A cluster of humming crystals.'),
];

export function poiPosition(p: PoiDef): [number, number, number] {
  return [p.x, heightAt(p.x, p.z) + p.yOffset, p.z];
}
