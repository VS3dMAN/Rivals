import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { captureRef } from 'react-native-view-shot';
import type { RefObject } from 'react';
import type { View } from 'react-native';

// Resize the captured photo to a max long-edge of 1600px and re-encode as JPEG
// quality 0.85. Keeps the upload size under ~500KB for typical phone photos
// and gives the watermark text crisp pixels to draw on top of.
export async function resizePhoto(uri: string): Promise<{
  uri: string;
  width: number;
  height: number;
}> {
  const out = await manipulateAsync(uri, [{ resize: { width: 1600 } }], {
    compress: 0.85,
    format: SaveFormat.JPEG,
  });
  return { uri: out.uri, width: out.width, height: out.height };
}

// Flatten a `<View>` containing the resized image and overlaid watermark text
// into a single JPEG file. CameraScreen owns the JSX; this lib owns the call.
export async function captureWatermarked(
  viewRef: RefObject<View | null>,
): Promise<string> {
  if (!viewRef.current) {
    throw new Error('Cannot capture watermark: view not mounted');
  }
  const uri = await captureRef(viewRef as RefObject<View>, {
    format: 'jpg',
    quality: 0.85,
    result: 'tmpfile',
  });
  return uri;
}

// Helper used by the watermark overlay JSX to format the four lines.
export function formatWatermarkLines(opts: {
  dateTime: Date;
  username: string;
  habitName: string;
}): { date: string; time: string; user: string; habit: string } {
  const d = opts.dateTime;
  const date = d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return {
    date,
    time,
    user: `@${opts.username}`,
    habit: opts.habitName,
  };
}
