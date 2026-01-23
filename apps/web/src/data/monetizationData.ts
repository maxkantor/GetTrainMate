export interface BoostPack {
  id: string;
  name: string;
  count: number;
  price: number;
  savings?: string;
  badge?: string;
}

export const boostPacks: BoostPack[] = [
  {
    id: 'boost_1',
    name: '1 Boost',
    count: 1,
    price: 2.99,
  },
  {
    id: 'boost_5',
    name: '5 Boosts',
    count: 5,
    price: 9.99,
    savings: 'Save 30%',
  },
  {
    id: 'boost_15',
    name: '15 Boosts',
    count: 15,
    price: 19.99,
    savings: 'Save 55%',
    badge: 'Best Value',
  },
];

export interface Challenge {
  id: string;
  title: string;
  description: string;
  sponsor?: string;
  price: number;
  duration: string;
  participants: number;
  image?: string;
}

export const sponsoredChallenges: Challenge[] = [
  {
    id: 'challenge_1',
    title: 'Weekend Partner Challenge',
    description: 'Complete 3 training sessions with partners this weekend',
    sponsor: 'Nike Training',
    price: 0,
    duration: '3 days',
    participants: 1240,
  },
  {
    id: 'challenge_2',
    title: 'Strength + Cardio Buddy Week',
    description: 'Mix strength and cardio workouts with a partner for 7 days',
    sponsor: 'Under Armour',
    price: 4.99,
    duration: '7 days',
    participants: 856,
  },
  {
    id: 'challenge_3',
    title: 'New Year Transformation Sprint',
    description: 'Train with partners 5x/week for 30 days. Win prizes!',
    sponsor: 'Gatorade',
    price: 4.99,
    duration: '30 days',
    participants: 2103,
  },
];
