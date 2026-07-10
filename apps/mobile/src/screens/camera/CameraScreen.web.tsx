// Web variant of CameraScreen, picked up automatically by Metro on the web
// platform. Uses navigator.mediaDevices.getUserMedia + a hidden <canvas> for
// the watermark, then PUTs the resulting Blob via the shared useLogCompletion
// hook.
//
// The component is intentionally written with web-specific JSX (raw <video>,
// <canvas>) wrapped in `as any` casts because RN Web allows DOM elements via
// the underlying React DOM renderer. Native (.tsx) version stays Expo-Camera.

import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../../theme';
import { useSessionStore } from '../../stores/session';
import { useLogCompletion } from '../../hooks/useLogCompletion';
import { HttpsRequiredError } from './HttpsRequiredError';
import type { GroupsStackParamList } from '../../navigation/GroupsStack';

type Nav = NativeStackNavigationProp<GroupsStackParamList, 'CaptureProof'>;
type Route = RouteProp<GroupsStackParamList, 'CaptureProof'>;

type Phase = 'idle' | 'captured' | 'uploading';

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lines: string[],
) {
  const padding = 12;
  const lineHeight = 22;
  const fontSize = 18;
  const boxHeight = lines.length * lineHeight + padding * 2;
  const boxWidth = 320;
  const x = width - boxWidth - padding;
  const y = height - boxHeight - padding;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(x, y, boxWidth, boxHeight);

  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    ctx.fillText(line, x + padding, y + padding + i * lineHeight);
  }
}

export function CameraScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { groupId, habitId, habitName } = route.params;
  const user = useSessionStore((s) => s.user);
  const username = user?.username ?? 'me';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [capturedAt, setCapturedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useLogCompletion();

  const isSecure =
    typeof window !== 'undefined' && (window.isSecureContext || window.location.hostname === 'localhost');

  useEffect(() => {
    if (!isSecure) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        setError((e as Error).message || 'Camera access denied');
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [isSecure]);

  if (!isSecure) return <HttpsRequiredError />;

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    const now = new Date();
    const date = now.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
    const time = now.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    drawWatermark(ctx, w, h, [date, time, `@${username}`, habitName]);

    canvas.toBlob(
      (b) => {
        if (!b) {
          setError('Could not encode photo');
          return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        setCapturedAt(now);
        setPhase('captured');
      },
      'image/jpeg',
      0.85,
    );
  };

  const confirm = async () => {
    if (!blob || !capturedAt) return;
    setPhase('uploading');
    setError(null);
    try {
      await upload.mutateAsync({
        groupId,
        habitId,
        body: blob,
        clientTimestamp: capturedAt.toISOString(),
      });
      nav.goBack();
    } catch (e) {
      setError((e as Error).message);
      setPhase('captured');
    }
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    setCapturedAt(null);
    setError(null);
    setPhase('idle');
  };

  // RN Web allows raw DOM elements via React DOM. We cast through `unknown` to
  // satisfy TS without pulling in @types/react-dom for the entire mobile app.
  const Video = 'video' as unknown as React.ComponentType<
    Record<string, unknown> & { ref: React.Ref<HTMLVideoElement> }
  >;
  const Canvas = 'canvas' as unknown as React.ComponentType<
    Record<string, unknown> & { ref: React.Ref<HTMLCanvasElement> }
  >;
  const Img = 'img' as unknown as React.ComponentType<Record<string, unknown>>;

  return (
    <View style={styles.root}>
      {phase === 'idle' && (
        <>
          <Video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <View style={styles.topBar}>
            <Pressable style={styles.iconBtn} onPress={() => nav.goBack()}>
              <Text style={styles.iconBtnText}>X</Text>
            </Pressable>
          </View>
          <View style={styles.bottomBar}>
            <Pressable style={styles.shutter} onPress={takePhoto}>
              <View style={styles.shutterInner} />
            </Pressable>
            <Text style={styles.hint}>{habitName}</Text>
          </View>
        </>
      )}

      {phase !== 'idle' && previewUrl && (
        <>
          <Img
            src={previewUrl}
            style={{ width: '100%', height: '70%', objectFit: 'contain', backgroundColor: '#000' }}
          />
          <View style={styles.previewActions}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {phase === 'uploading' ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme.colors.accent} />
                <Text style={styles.uploadingText}>Uploading…</Text>
              </View>
            ) : (
              <View style={styles.actionRow}>
                <Pressable style={styles.btnSecondary} onPress={retake}>
                  <Text style={styles.btnSecondaryText}>Retake</Text>
                </Pressable>
                <Pressable style={styles.btnPrimary} onPress={confirm}>
                  <Text style={styles.btnPrimaryText}>Confirm</Text>
                </Pressable>
              </View>
            )}
          </View>
        </>
      )}

      <Canvas ref={canvasRef} style={{ display: 'none' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    position: 'absolute',
    top: theme.spacing.lg,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    flexDirection: 'row',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { color: '#fff', fontWeight: '600' },
  bottomBar: {
    position: 'absolute',
    bottom: theme.spacing.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  hint: { ...theme.typography.body, color: '#fff' },
  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  previewActions: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  actionRow: { flexDirection: 'row', gap: theme.spacing.md },
  uploadingText: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  btnPrimary: {
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    flex: 1,
  },
  btnPrimaryText: { ...theme.typography.heading, color: '#0B1220' },
  btnSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    flex: 1,
  },
  btnSecondaryText: { ...theme.typography.heading, color: theme.colors.text },
  error: { color: theme.colors.danger, ...theme.typography.caption },
});
