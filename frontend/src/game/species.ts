// Offline species encyclopedia. The simulation service serves the same catalogue; this is the fallback and
// carries the in-game scan data (info text and scan duration).
export interface SpeciesDef { id: string; name: string; latin: string; category: string; size: 'small' | 'medium' | 'large' | 'deep'; scanTime: number; info: string }

export const SPECIES: SpeciesDef[] = [
  { id: 'sardine', name: 'Sardine', latin: 'Sardina pilchardus', category: 'Fish', size: 'small', scanTime: 3, info: 'Sardines school in the thousands. The group turns as one to confuse predators, and scatters when something large approaches.' },
  { id: 'clownfish', name: 'Clownfish', latin: 'Amphiprion ocellaris', category: 'Fish', size: 'small', scanTime: 3, info: 'Lives among anemone tentacles and defends its patch of reef. Its mucus coat protects it from the stings.' },
  { id: 'jellyfish', name: 'Moon jellyfish', latin: 'Aurelia aurita', category: 'Cnidarian', size: 'small', scanTime: 3, info: 'Has no brain or heart. It drifts with the current and pulses its bell to hold its depth.' },
  { id: 'sea_turtle', name: 'Green sea turtle', latin: 'Chelonia mydas', category: 'Reptile', size: 'medium', scanTime: 4, info: 'Grazes on seagrass and returns to the same reef for decades. It surfaces to breathe every few minutes.' },
  { id: 'reef_shark', name: 'Blacktip reef shark', latin: 'Carcharhinus melanopterus', category: 'Fish', size: 'medium', scanTime: 5, info: 'Curious about unfamiliar objects and will circle one before moving on. Startled easily by fast movement.' },
];
export const speciesById = (id: string) => SPECIES.find((s) => s.id === id);
