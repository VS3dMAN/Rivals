import { useState } from 'react';
import {
  View,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Text,
} from 'react-native';

export interface ProofPhotoThumbnailProps {
  // Signed photo URL (or undefined while loading). Consumers fetch the URL
  // via useSignedPhotoUrl(logId) and pass the result here — keeps this
  // component free of React Query so packages/ui has no app-layer deps.
  signedUrl: string | null | undefined;
  isLoading?: boolean;
  size?: number;
  // Optional preview-overlay label, e.g. "Today's proof".
  label?: string;
}

export function ProofPhotoThumbnail({
  signedUrl,
  isLoading,
  size = 64,
  label,
}: ProofPhotoThumbnailProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        style={[styles.thumb, { width: size, height: size }]}
        disabled={!signedUrl}
        onPress={() => setOpen(true)}
      >
        {isLoading || !signedUrl ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : (
          <Image source={{ uri: signedUrl }} style={styles.image} resizeMode="cover" />
        )}
        {label ? <Text style={styles.label}>{label}</Text> : null}
      </Pressable>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {signedUrl ? (
            <Image source={{ uri: signedUrl }} style={styles.fullImage} resizeMode="contain" />
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  thumb: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0B1220',
  },
  image: { width: '100%', height: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    color: '#fff',
    fontSize: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: { width: '100%', height: '100%' },
});
