import { Modal, View, Image, Pressable, Text, StyleSheet, Dimensions } from 'react-native';
import { theme } from '../../theme';

interface FullScreenProofViewerProps {
  visible: boolean;
  photoUrl: string | null;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

export function FullScreenProofViewer({ visible, photoUrl, onClose }: FullScreenProofViewerProps) {
  if (!photoUrl) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>X</Text>
        </Pressable>
        <Image source={{ uri: photoUrl }} style={styles.image} resizeMode="contain" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  image: { width: width, height: height * 0.8 },
});
