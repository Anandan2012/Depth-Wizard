export interface SampleImage {
  id: string;
  name: string;
  category: string;
  url: string;
  width: number;
  height: number;
  description: string;
  suggestedReference: {
    name: string;
    points: [{ x: number; y: number }, { x: number; y: number }];
    distanceMeters: number;
  };
}

export const SAMPLE_IMAGES: SampleImage[] = [
  {
    id: 'sample-room',
    name: 'Modern Living Room',
    category: 'Interior',
    url: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80',
    width: 1200,
    height: 800,
    description: 'Interior space with couch, coffee table, and layered lighting.',
    suggestedReference: {
      name: 'Coffee Table Width',
      points: [{ x: 380, y: 620 }, { x: 790, y: 620 }],
      distanceMeters: 1.20,
    },
  },
  {
    id: 'sample-street',
    name: 'European Street & Architecture',
    category: 'Architecture',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
    width: 1200,
    height: 800,
    description: 'City perspective with cobblestones, building facades, and depth corridor.',
    suggestedReference: {
      name: 'Door Height',
      points: [{ x: 420, y: 350 }, { x: 420, y: 680 }],
      distanceMeters: 2.10,
    },
  },
  {
    id: 'sample-desk',
    name: 'Workspace Desk Setup',
    category: 'Object / Table',
    url: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=1200&q=80',
    width: 1200,
    height: 800,
    description: 'Studio desk with laptop, keyboard, monitor, and desk accessories.',
    suggestedReference: {
      name: 'Keyboard Width',
      points: [{ x: 460, y: 550 }, { x: 740, y: 550 }],
      distanceMeters: 0.44,
    },
  },
  {
    id: 'sample-nature',
    name: 'Forest Trail Perspective',
    category: 'Landscape',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80',
    width: 1200,
    height: 800,
    description: 'Scenic winding path through pine trees with vanishing horizon line.',
    suggestedReference: {
      name: 'Trail Width',
      points: [{ x: 450, y: 720 }, { x: 780, y: 720 }],
      distanceMeters: 1.80,
    },
  },
];
