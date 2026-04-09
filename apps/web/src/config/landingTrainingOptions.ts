/**
 * Landing "Quick setup" training dropdown: user-facing labels → canonical PROFILE_SPORTS tags.
 */
export type LandingTrainingOption = { label: string; sportTag: string };

export const LANDING_TRAINING_OPTIONS: readonly LandingTrainingOption[] = [
  { label: 'HYROX / hybrid racing', sportTag: 'Hyrox' },
  { label: 'CrossFit / functional fitness', sportTag: 'CrossFit' },
  { label: 'Strength & conditioning', sportTag: 'Gym' },
  { label: 'Powerlifting / Olympic lifting', sportTag: 'Powerlifting' },
  { label: 'HIIT & metabolic conditioning', sportTag: 'HIIT' },
  { label: 'Running / road & track', sportTag: 'Running' },
  { label: 'Trail running & ultramarathon', sportTag: 'Ultramarathon' },
  { label: 'Cycling / indoor & outdoor', sportTag: 'Cycling' },
  { label: 'Swimming & pool training', sportTag: 'Swimming' },
  { label: 'Triathlon / multi-sport', sportTag: 'Triathlon' },
  { label: 'Rowing & crew', sportTag: 'Rowing' },
  { label: 'Walking & light cardio', sportTag: 'Walking' },
  { label: 'Hiking & trekking', sportTag: 'Hiking' },
  { label: 'Yoga & mobility', sportTag: 'Yoga' },
  { label: 'Pilates & barre', sportTag: 'Pilates' },
  { label: 'Climbing & bouldering', sportTag: 'Climbing' },
  { label: 'Rock climbing / ropes', sportTag: 'Rock Climbing' },
  { label: 'Tennis', sportTag: 'Tennis' },
  { label: 'Pickleball', sportTag: 'Pickleball' },
  { label: 'Basketball', sportTag: 'Basketball' },
  { label: 'Soccer / football', sportTag: 'Soccer' },
  { label: 'Volleyball', sportTag: 'Volleyball' },
  { label: 'Rugby', sportTag: 'Rugby' },
  { label: 'Baseball / softball', sportTag: 'Baseball' },
  { label: 'Boxing & striking', sportTag: 'Boxing' },
  { label: 'MMA & combat sports', sportTag: 'MMA' },
  { label: 'Martial arts (traditional)', sportTag: 'Martial Arts' },
  { label: 'Dance fitness', sportTag: 'Dancing' },
  { label: 'Golf', sportTag: 'Golf' },
  { label: 'Skiing & snow sports', sportTag: 'Skiing' },
  { label: 'Surfing', sportTag: 'Surfing' },
  { label: 'Paddleboarding & SUP', sportTag: 'Paddleboarding' },
  { label: 'Kayaking & canoeing', sportTag: 'Kayaking' },
  { label: 'Fishing & outdoor lifestyle', sportTag: 'Fishing' },
  { label: 'Archery', sportTag: 'Archery' },
  { label: 'Badminton / squash / racquetball', sportTag: 'Badminton' },
  { label: 'Table tennis', sportTag: 'Table Tennis' },
] as const;

export function landingTrainingLabelToSportTag(label: string): string {
  const hit = LANDING_TRAINING_OPTIONS.find((o) => o.label === label);
  return hit?.sportTag ?? 'Gym';
}
