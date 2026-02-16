import React from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import styles from './FiltersDrawer.module.css';

export interface DiscoverFilters {
  distance: string;
  goals: string[];
  schedule: string[];
  experienceLevel: string;
}

const DISTANCE_OPTIONS = ['5 miles', '15 miles', '30 miles', '50 miles', 'Any'];
const GOAL_OPTIONS = ['Lose weight', 'Build muscle', 'Stay fit', 'Train for event', 'Have fun'];
const SCHEDULE_OPTIONS = ['Weekday mornings', 'Weekday evenings', 'Weekends', 'Flexible'];
const LEVEL_OPTIONS = ['Any', 'Beginner', 'Intermediate', 'Advanced', 'Pro'];

interface FiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: DiscoverFilters;
  onFiltersChange: (f: DiscoverFilters) => void;
  onApply: () => void;
}

export const FiltersDrawer: React.FC<FiltersDrawerProps> = ({
  open,
  onClose,
  filters,
  onFiltersChange,
  onApply,
}) => {
  const toggleGoal = (g: string) => {
    const next = filters.goals.includes(g)
      ? filters.goals.filter((x) => x !== g)
      : [...filters.goals, g];
    onFiltersChange({ ...filters, goals: next });
  };

  const toggleSchedule = (s: string) => {
    const next = filters.schedule.includes(s)
      ? filters.schedule.filter((x) => x !== s)
      : [...filters.schedule, s];
    onFiltersChange({ ...filters, schedule: next });
  };

  return (
    <Drawer open={open} onClose={onClose} title="Filters" anchor="right">
      <div className={styles.section}>
        <label className={styles.label}>Distance</label>
        <div className={styles.chips}>
          {DISTANCE_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={`${styles.chip} ${filters.distance === d ? styles.chipActive : ''}`}
              onClick={() => onFiltersChange({ ...filters, distance: d })}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Goals</label>
        <div className={styles.chips}>
          {GOAL_OPTIONS.map((g) => (
            <button
              key={g}
              type="button"
              className={`${styles.chip} ${filters.goals.includes(g) ? styles.chipActive : ''}`}
              onClick={() => toggleGoal(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Schedule</label>
        <div className={styles.chips}>
          {SCHEDULE_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.chip} ${filters.schedule.includes(s) ? styles.chipActive : ''}`}
              onClick={() => toggleSchedule(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Experience level</label>
        <select
          className={styles.select}
          value={filters.experienceLevel}
          onChange={(e) => onFiltersChange({ ...filters, experienceLevel: e.target.value })}
        >
          {LEVEL_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.actions}>
        <Button fullWidth variant="primary" onClick={() => { onApply(); onClose(); }}>
          Apply filters
        </Button>
      </div>
    </Drawer>
  );
};
