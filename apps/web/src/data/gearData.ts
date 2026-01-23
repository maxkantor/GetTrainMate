export interface GearProduct {
  id: string;
  name: string;
  asin: string;
  category: string;
  reasons: string[];
  imageUrl?: string;
}

export const gearProducts: GearProduct[] = [
  {
    id: 'gear_1',
    name: 'Nike Training Shoes',
    asin: 'B0CQVG9H4P',
    category: 'Footwear',
    reasons: [
      'Excellent stability for partner workouts',
      'Breathable mesh for long sessions',
      'Trusted by pro athletes',
    ],
  },
  {
    id: 'gear_2',
    name: 'Gym Grip Gloves',
    asin: 'B07WNWSCQH',
    category: 'Accessories',
    reasons: [
      'Enhanced grip for lifting',
      'Prevent calluses and blisters',
      'Wrist support included',
    ],
  },
  {
    id: 'gear_3',
    name: 'Premium Lifting Belt',
    asin: 'B07VFBP4KG',
    category: 'Accessories',
    reasons: [
      'Supports heavy compound lifts',
      'Adjustable for perfect fit',
      'Durable genuine leather',
    ],
  },
  {
    id: 'gear_4',
    name: 'BlenderBottle Shaker',
    asin: 'B001KADGMI',
    category: 'Nutrition',
    reasons: [
      'Leak-proof design',
      'Mixes protein perfectly',
      'Easy to clean',
    ],
  },
  {
    id: 'gear_5',
    name: 'Resistance Bands Set',
    asin: 'B08MVFN2DH',
    category: 'Equipment',
    reasons: [
      'Perfect for partner stretching',
      'Portable for outdoor workouts',
      '5 resistance levels included',
    ],
  },
  {
    id: 'gear_6',
    name: 'Garmin Forerunner Watch',
    asin: 'B0CWTDGX6Y',
    category: 'Tech',
    reasons: [
      'GPS tracking for runs',
      'Heart rate monitoring',
      'Sync with training partners',
    ],
  },
];
