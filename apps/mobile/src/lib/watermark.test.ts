import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: vi.fn(async (_uri: string, _ops: unknown[], _opts: unknown) => ({
    uri: 'file:///resized.jpg',
    width: 1600,
    height: 900,
  })),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));

vi.mock('react-native-view-shot', () => ({
  captureRef: vi.fn(async () => 'file:///watermarked.jpg'),
}));

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { captureRef } from 'react-native-view-shot';
import { resizePhoto, captureWatermarked, formatWatermarkLines } from './watermark';

describe('watermark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resizePhoto invokes manipulateAsync with width:1600 + JPEG', async () => {
    const out = await resizePhoto('file:///raw.jpg');
    expect(out.uri).toBe('file:///resized.jpg');
    expect(manipulateAsync).toHaveBeenCalledWith(
      'file:///raw.jpg',
      [{ resize: { width: 1600 } }],
      { compress: 0.85, format: SaveFormat.JPEG },
    );
  });

  it('captureWatermarked throws when view not mounted', async () => {
    const ref = { current: null };
    await expect(captureWatermarked(ref)).rejects.toThrow(/not mounted/);
  });

  it('captureWatermarked invokes captureRef and returns its uri', async () => {
    const ref = { current: { id: 'fake-view' } as unknown };
    const out = await captureWatermarked(ref as never);
    expect(out).toBe('file:///watermarked.jpg');
    expect(captureRef).toHaveBeenCalledOnce();
  });

  it('formatWatermarkLines produces the four expected fields', () => {
    const date = new Date('2026-01-15T10:30:00Z');
    const out = formatWatermarkLines({
      dateTime: date,
      username: 'aryan',
      habitName: 'Run 5km',
    });
    expect(out.user).toBe('@aryan');
    expect(out.habit).toBe('Run 5km');
    expect(typeof out.date).toBe('string');
    expect(typeof out.time).toBe('string');
  });
});
