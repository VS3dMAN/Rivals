import { describe, it, expect } from 'vitest';
import { computePersonalStreak } from './streak';

describe('computePersonalStreak', () => {
  it('returns zeros for no logs', () => {
    expect(computePersonalStreak([], '2026-07-10', 0)).toEqual({
      current: 0,
      longest: 0,
      lastCompletedDate: null,
    });
  });

  it('counts a single log today', () => {
    const r = computePersonalStreak(['2026-07-10'], '2026-07-10', 0);
    expect(r).toEqual({ current: 1, longest: 1, lastCompletedDate: '2026-07-10' });
  });

  it('counts consecutive days ending today', () => {
    const r = computePersonalStreak(
      ['2026-07-08', '2026-07-09', '2026-07-10'],
      '2026-07-10',
      0,
    );
    expect(r.current).toBe(3);
    expect(r.longest).toBe(3);
  });

  it('keeps the streak alive when today is not yet logged (grace 0)', () => {
    const r = computePersonalStreak(['2026-07-08', '2026-07-09'], '2026-07-10', 0);
    expect(r.current).toBe(2);
  });

  it('kills the streak one full day past the pending window (grace 0)', () => {
    const r = computePersonalStreak(['2026-07-07', '2026-07-08'], '2026-07-10', 0);
    expect(r.current).toBe(0);
    expect(r.longest).toBe(2);
  });

  it('tolerates a one-day gap within grace 1', () => {
    // logged 7th, missed 8th, logged 9th → one run of 2 logged days
    const r = computePersonalStreak(['2026-07-07', '2026-07-09'], '2026-07-09', 1);
    expect(r.current).toBe(2);
    expect(r.longest).toBe(2);
  });

  it('breaks the run when the gap exceeds grace', () => {
    // gap of 2 with grace 1 → two separate runs
    const r = computePersonalStreak(
      ['2026-07-04', '2026-07-05', '2026-07-08', '2026-07-09'],
      '2026-07-09',
      1,
    );
    expect(r.current).toBe(2);
    expect(r.longest).toBe(2);
  });

  it('missed days never add to streak length', () => {
    // 5 logged days with single-day gaps, grace 2 → all one run of length 5
    const r = computePersonalStreak(
      ['2026-07-01', '2026-07-03', '2026-07-05', '2026-07-07', '2026-07-09'],
      '2026-07-09',
      2,
    );
    expect(r.current).toBe(5);
    expect(r.longest).toBe(5);
  });

  it('grace extends the pending window (grace 1, last log 2 days ago)', () => {
    const r = computePersonalStreak(['2026-07-07', '2026-07-08'], '2026-07-10', 1);
    expect(r.current).toBe(2);
  });

  it('grace 1: dead when last log is 3 days ago', () => {
    const r = computePersonalStreak(['2026-07-07'], '2026-07-10', 1);
    expect(r.current).toBe(0);
    expect(r.longest).toBe(1);
  });

  it('longest survives from an older, better run', () => {
    const r = computePersonalStreak(
      ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-07-10'],
      '2026-07-10',
      0,
    );
    expect(r.current).toBe(1);
    expect(r.longest).toBe(4);
    expect(r.lastCompletedDate).toBe('2026-07-10');
  });

  it('deduplicates repeated dates', () => {
    const r = computePersonalStreak(
      ['2026-07-10', '2026-07-10', '2026-07-09'],
      '2026-07-10',
      0,
    );
    expect(r.current).toBe(2);
  });
});
