import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../../theme';
import { useSessionStore } from '../../stores/session';
import { useLogCompletion } from '../../hooks/useLogCompletion';
import { track } from '../../lib/analytics';
import {
  resizePhoto,
  captureWatermarked,
  formatWatermarkLines,
} from '../../lib/watermark';
import type { GroupsStackParamList } from '../../navigation/GroupsStack';

type Nav = NativeStackNavigationProp<GroupsStackParamList, 'CaptureProof'>;
type Route = RouteProp<GroupsStackParamList, 'CaptureProof'>;

type Phase = 'idle' | 'captured' | 'uploading';

interface ResizedPhoto {
  uri: string;
  width: number;
  height: number;
  capturedAt: Date;
}

export function CameraScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { groupId, habitId, habitName } = route.params;

  const user = useSessionStore((s) => s.user);
  const username = user?.username ?? 'me';

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [phase, setPhase] = useState<Phase>('idle');
  const [resized, setResized] = useState<ResizedPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cameraRef = useRef<CameraView | null>(null);
  const composedRef = useRef<View | null>(null);

  const upload = useLogCompletion();

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionDenied}>
        <Text style={styles.permTitle}>Camera permission required</Text>
        <Text style={styles.permBody}>
          Rivals needs your camera to capture live proof photos. Gallery uploads are
          never allowed.
        </Text>
        <Pressable
          style={styles.btnPrimary}
          onPress={() => {
            if (permission.canAskAgain) {
              requestPermission();
            } else {
              Linking.openSettings();
            }
          }}
        >
          <Text style={styles.btnPrimaryText}>
            {permission.canAskAgain ? 'Grant access' : 'Open Settings'}
          </Text>
        </Pressable>
        <Pressable style={styles.btnSecondary} onPress={() => nav.goBack()}>
          <Text style={styles.btnSecondaryText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const takePhoto = async () => {
    const cam = cameraRef.current;
    if (!cam) return;
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => void 0);
    try {
      const raw = await cam.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (!raw?.uri) throw new Error('Capture returned no URI');
      const resizedOut = await resizePhoto(raw.uri);
      setResized({ ...resizedOut, capturedAt: new Date() });
      setPhase('captured');
      track('proof_captured', { groupId, habitId });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const confirm = async () => {
    if (!resized) return;
    setPhase('uploading');
    setError(null);
    try {
      // Capture the composed view (resized photo + overlaid watermark text)
      // into a single flattened JPEG file, then upload that.
      const watermarkedUri = await captureWatermarked(composedRef);
      await upload.mutateAsync({
        groupId,
        habitId,
        body: { uri: watermarkedUri },
        clientTimestamp: resized.capturedAt.toISOString(),
      });
      Alert.alert('Proof recorded', 'Nice work.');
      nav.goBack();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      setPhase('captured');
    }
  };

  const retake = () => {
    setResized(null);
    setError(null);
    setPhase('idle');
  };

  const lines = resized
    ? formatWatermarkLines({
        dateTime: resized.capturedAt,
        username,
        habitName,
      })
    : null;

  return (
    <View style={styles.root}>
      {phase === 'idle' && (
        <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
          <View style={styles.topBar}>
            <Pressable style={styles.iconBtn} onPress={() => nav.goBack()}>
              <Text style={styles.iconBtnText}>X</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              style={styles.iconBtn}
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            >
              <Text style={styles.iconBtnText}>Flip</Text>
            </Pressable>
          </View>
          <View style={styles.bottomBar}>
            <Pressable
              style={styles.shutter}
              onPress={takePhoto}
              accessibilityRole="button"
              accessibilityLabel="Take proof photo"
            >
              <View style={styles.shutterInner} />
            </Pressable>
            <Text style={styles.hint}>{habitName}</Text>
          </View>
        </CameraView>
      )}

      {phase !== 'idle' && resized && lines && (
        <>
          <View
            ref={composedRef}
            collapsable={false}
            style={[
              styles.composed,
              { aspectRatio: resized.width / resized.height },
            ]}
          >
            <Image
              source={{ uri: resized.uri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <View style={styles.watermarkBox}>
              <Text style={styles.watermarkLine}>{lines.date}</Text>
              <Text style={styles.watermarkLine}>{lines.time}</Text>
              <Text style={styles.watermarkLine}>{lines.user}</Text>
              <Text style={styles.watermarkLine}>{lines.habit}</Text>
            </View>
          </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  camera: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
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
  bottomBar: { alignItems: 'center', paddingBottom: theme.spacing.xl, gap: theme.spacing.md },
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
  composed: {
    width: '100%',
    backgroundColor: '#000',
  },
  watermarkBox: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  watermarkLine: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  permissionDenied: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  permTitle: { ...theme.typography.title, color: theme.colors.text },
  permBody: { ...theme.typography.body, color: theme.colors.textMuted },
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
