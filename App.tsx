import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type FilterKey = 'normal' | 'mono' | 'vivid';
type DraftImage = {
  uri: string;
  width?: number;
  height?: number;
  fileName?: string | null;
  fileSize?: number;
  mimeType?: string;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const filters: Array<{ key: FilterKey; label: string; description: string }> = [
  { key: 'normal', label: 'ปกติ', description: 'สีจริงของภาพ' },
  { key: 'mono', label: 'ขาวดำ', description: 'ลดสีให้เรียบเท่' },
  { key: 'vivid', label: 'สดใส', description: 'เพิ่มความอุ่นและสว่าง' },
];

export default function App() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [image, setImage] = useState<DraftImage | null>(null);
  const [filter, setFilter] = useState<FilterKey>('normal');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [message, setMessage] = useState('ยังไม่มีรูปกิจกรรม');
  const cameraRef = useRef<React.ComponentRef<typeof CameraView>>(null);
  const selectedFilter = useMemo(() => filters.find((item) => item.key === filter) ?? filters[0], [filter]);

  async function chooseEventImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      handlePermissionDenied('คลังรูป', permission.canAskAgain, chooseEventImage);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) {
      setMessage('ยกเลิกแล้ว ข้อมูลเดิมยังอยู่ครบ');
      return;
    }
    const asset = result.assets[0];
    const nextImage: DraftImage = {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      fileName: asset.fileName,
      fileSize: asset.fileSize,
      mimeType: asset.mimeType,
    };
    setImage(nextImage);
    setMessage(validateImage(nextImage.fileSize, nextImage.mimeType));
  }

  async function openCamera() {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        handlePermissionDenied('กล้อง', permission.canAskAgain, openCamera);
        return;
      }
    }
    setCameraOpen(true);
  }

  async function takePhoto() {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (!photo) return;
      setImage({ uri: photo.uri, width: photo.width, height: photo.height, mimeType: 'image/jpeg' });
      setMessage('ถ่ายรูปสำเร็จ เก็บเป็น draft URI แล้ว');
      setCameraOpen(false);
    } catch {
      Alert.alert('ถ่ายรูปไม่สำเร็จ', 'ลองถ่ายใหม่อีกครั้ง');
    }
  }

  function openAddPhotoSheet() {
    const options = ['ถ่ายรูป', 'เลือกจากคลัง', 'ยกเลิก'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2, title: 'เพิ่มรูปกิจกรรม' }, (index) => {
        if (index === 0) void openCamera();
        if (index === 1) void chooseEventImage();
      });
      return;
    }
    Alert.alert('เพิ่มรูปกิจกรรม', 'เลือกแหล่งรูปภาพ', [
      { text: 'ถ่ายรูป', onPress: () => void openCamera() },
      { text: 'เลือกจากคลัง', onPress: () => void chooseEventImage() },
      { text: 'ยกเลิก', style: 'cancel' },
    ]);
  }

  function handlePermissionDenied(name: string, canAskAgain: boolean, retry: () => void) {
    if (canAskAgain) {
      Alert.alert(`ยังไม่ได้อนุญาต${name}`, `ต้องใช้${name}เพื่อเพิ่มรูปกิจกรรม`, [
        { text: 'ยกเลิก', style: 'cancel' },
        { text: 'ลองอีกครั้ง', onPress: () => retry() },
      ]);
      return;
    }
    Alert.alert(`เปิดสิทธิ์${name}ใน Settings`, 'ระบบไม่สามารถถาม permission ซ้ำได้แล้ว', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'เปิด Settings', onPress: () => void Linking.openSettings() },
    ]);
  }

  function simulateUpload() {
    if (!image) {
      Alert.alert('ยังไม่มีรูป', 'เพิ่มรูปก่อนจำลองการ upload');
      return;
    }
    const validation = validateImage(image.fileSize, image.mimeType);
    if (validation !== 'ตรวจสอบไฟล์แล้ว: พร้อมจำลอง Upload') {
      Alert.alert('ตรวจสอบไฟล์ไม่ผ่าน', validation);
      return;
    }
    Alert.alert('Upload สำเร็จ', 'จำลองการส่งรูปไป backend แล้ว');
  }

  return (
    <View style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>LAB 9</Text>
            <Text style={styles.title}>Event Photo</Text>
          </View>
          <Pressable accessibilityLabel="เพิ่มรูป" style={styles.roundButton} onPress={openAddPhotoSheet}>
            <Ionicons name="add" size={26} color="#101828" />
          </Pressable>
        </View>

        <View style={styles.previewPanel}>
          {image ? <><Image source={{ uri: image.uri }} style={styles.previewImage} /><FilterOverlay filter={filter} /><View style={styles.previewBadge}><Ionicons name="sparkles" size={15} color="#fff" /><Text style={styles.previewBadgeText}>{selectedFilter.label}</Text></View></> : <View style={styles.emptyState}><Ionicons name="camera-outline" size={58} color="#98A2B3" /><Text style={styles.emptyTitle}>เพิ่มรูปประกอบกิจกรรม</Text><Text style={styles.emptyText}>เลือกถ่ายรูปหรือเลือกจากคลังได้เมื่อพร้อม แอปจะขอ permission ตอนใช้งานเท่านั้น</Text></View>}
        </View>

        <Text style={styles.sectionTitle}>ฟิลเตอร์รูปภาพ</Text>
        <View style={styles.filterRow}>
          {filters.map((item) => <Pressable accessibilityRole="button" key={item.key} style={[styles.filterCard, filter === item.key && styles.filterCardActive]} onPress={() => setFilter(item.key)}><View style={styles.filterThumb}><FilterOverlay filter={item.key} rounded /></View><Text style={[styles.filterLabel, filter === item.key && styles.filterLabelActive]}>{item.label}</Text><Text style={styles.filterDescription}>{item.description}</Text></Pressable>)}
        </View>

        <View style={styles.infoBox}><Text style={styles.infoText}>{message}</Text>{image && <Text style={styles.metaText}>{image.width ?? '-'} × {image.height ?? '-'} px{image.fileSize ? ` • ${(image.fileSize / 1024 / 1024).toFixed(2)} MB` : ''}{image.mimeType ? ` • ${image.mimeType}` : ''}</Text>}</View>
        <View style={styles.actions}>
          <Pressable style={styles.primaryButton} onPress={openAddPhotoSheet}><Ionicons name={image ? 'swap-horizontal' : 'image'} size={19} color="#fff" /><Text style={styles.primaryButtonText}>{image ? 'Replace' : 'เพิ่มรูป'}</Text></Pressable>
          <Pressable style={styles.secondaryButton} onPress={simulateUpload}><Text style={styles.secondaryButtonText}>จำลอง Upload</Text></Pressable>
          {image && <Pressable accessibilityLabel="ลบรูป" style={styles.removeButton} onPress={() => { setImage(null); setMessage('ลบรูปแล้ว สามารถเพิ่มรูปใหม่ได้'); }}><Ionicons name="trash-outline" size={19} color="#B42318" /></Pressable>}
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem} accessibilityRole="button"><Ionicons name="camera" size={21} color="#B9A7FF" /><Text style={styles.navLabelActive}>Create</Text></Pressable>
        <Pressable style={styles.navItem} accessibilityRole="button"><Ionicons name="images-outline" size={21} color="#98A2B3" /><Text style={styles.navLabel}>Library</Text></Pressable>
        <Pressable style={styles.navAddButton} onPress={openAddPhotoSheet} accessibilityLabel="à¹€à¸žà¸´à¹ˆà¸¡à¸£à¸¹à¸›"><Ionicons name="add" size={27} color="#fff" /></Pressable>
        <Pressable style={styles.navItem} accessibilityRole="button"><Ionicons name="sparkles-outline" size={21} color="#98A2B3" /><Text style={styles.navLabel}>Styles</Text></Pressable>
        <Pressable style={styles.navItem} accessibilityRole="button"><Ionicons name="person-outline" size={21} color="#98A2B3" /><Text style={styles.navLabel}>Profile</Text></Pressable>
      </View>

      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <View style={styles.cameraScreen}><CameraView ref={cameraRef} style={styles.camera} facing="back"><FilterOverlay filter={filter} /><View style={styles.cameraControls}><Pressable accessibilityLabel="ปิดกล้อง" style={styles.cameraClose} onPress={() => setCameraOpen(false)}><Ionicons name="close" size={26} color="#fff" /></Pressable><View style={styles.cameraFilterPill}><Text style={styles.cameraFilterText}>{selectedFilter.label}</Text></View><Pressable accessibilityLabel="ถ่ายรูป" style={styles.shutter} onPress={() => void takePhoto()}><View style={styles.shutterInner} /></Pressable></View></CameraView></View>
      </Modal>
    </View>
  );
}

function validateImage(fileSize?: number, mimeType?: string) {
  if (mimeType && !mimeType.startsWith('image/')) return 'ไฟล์นี้ไม่ใช่รูปภาพ (MIME type ไม่ถูกต้อง)';
  if (fileSize && fileSize > MAX_FILE_SIZE) return 'ไฟล์ใหญ่กว่า 5 MB ควรลดขนาดก่อน upload';
  return 'ตรวจสอบไฟล์แล้ว: พร้อมจำลอง Upload';
}

function FilterOverlay({ filter, rounded = false }: { filter: FilterKey; rounded?: boolean }) {
  if (filter === 'normal') return null;
  return <View pointerEvents="none" style={[styles.overlay, rounded && styles.rounded, filter === 'mono' ? styles.monoOverlay : styles.vividOverlay]} />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#090B1A' },
  container: { padding: 20, gap: 18, paddingBottom: 122 },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  headerCopy: { flexShrink: 1 },
  eyebrow: { color: '#B9A7FF', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  roundButton: { alignItems: 'center', backgroundColor: '#6D4AFF', borderColor: '#B9A7FF', borderRadius: 18, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 },
  previewPanel: { aspectRatio: 0.82, backgroundColor: '#151A31', borderColor: '#293056', borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  previewImage: { height: '100%', width: '100%' },
  emptyState: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 28 },
  emptyTitle: { color: '#fff', fontSize: 21, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  emptyText: { color: '#D0D5DD', fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: 'center' },
  previewBadge: { alignItems: 'center', backgroundColor: 'rgba(109,74,255,0.9)', borderRadius: 18, flexDirection: 'row', gap: 6, left: 14, paddingHorizontal: 12, paddingVertical: 8, position: 'absolute', bottom: 14 },
  previewBadgeText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  filterRow: { flexDirection: 'row', gap: 10 },
  filterCard: { backgroundColor: '#151A31', borderColor: '#293056', borderRadius: 16, borderWidth: 1, flex: 1, minWidth: 0, padding: 10 },
  filterCardActive: { backgroundColor: '#211B43', borderColor: '#A78BFA', borderWidth: 1.5 },
  filterThumb: { backgroundColor: '#667085', borderRadius: 10, height: 52, marginBottom: 9, overflow: 'hidden' },
  filterLabel: { color: '#EAECF0', fontSize: 14, fontWeight: '800' },
  filterLabelActive: { color: '#D6CCFF' },
  filterDescription: { color: '#98A2B3', fontSize: 11, marginTop: 3 },
  infoBox: { backgroundColor: '#11162A', borderColor: '#293056', borderRadius: 16, borderWidth: 1, padding: 15 },
  infoText: { color: '#F2F4F7', fontSize: 14, fontWeight: '700' },
  metaText: { color: '#98A2B3', fontSize: 12, marginTop: 5 },
  actions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  primaryButton: { alignItems: 'center', backgroundColor: '#6D4AFF', borderRadius: 14, flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minWidth: 140, paddingVertical: 15 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryButton: { backgroundColor: '#1A2140', borderColor: '#38416D', borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 15 },
  secondaryButtonText: { color: '#D6CCFF', fontSize: 15, fontWeight: '800' },
  removeButton: { alignItems: 'center', backgroundColor: '#2A1828', borderColor: '#6B2737', borderRadius: 14, borderWidth: 1, height: 50, justifyContent: 'center', width: 50 },
  bottomNav: { alignItems: 'center', backgroundColor: 'rgba(14,17,38,0.97)', borderColor: '#293056', borderTopWidth: 1, bottom: 0, flexDirection: 'row', justifyContent: 'space-around', left: 0, minHeight: 78, paddingHorizontal: 12, paddingTop: 8, position: 'absolute', right: 0 },
  navItem: { alignItems: 'center', gap: 4, minWidth: 52 },
  navLabel: { color: '#98A2B3', fontSize: 10, fontWeight: '700' },
  navLabelActive: { color: '#B9A7FF', fontSize: 10, fontWeight: '800' },
  navAddButton: { alignItems: 'center', backgroundColor: '#6D4AFF', borderColor: '#B9A7FF', borderRadius: 20, borderWidth: 2, height: 50, justifyContent: 'center', marginTop: -22, width: 50 },
  cameraScreen: { backgroundColor: '#000', flex: 1 }, camera: { flex: 1 },
  cameraControls: { flex: 1, justifyContent: 'space-between', padding: 22 },
  cameraClose: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.38)', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  cameraFilterPill: { alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
  cameraFilterText: { color: '#fff', fontWeight: '800' },
  shutter: { alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.35)', borderColor: '#fff', borderRadius: 42, borderWidth: 4, height: 84, justifyContent: 'center', width: 84 },
  shutterInner: { backgroundColor: '#fff', borderRadius: 30, height: 60, width: 60 },
  overlay: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }, rounded: { borderRadius: 6 },
  monoOverlay: { backgroundColor: 'rgba(0,0,0,0.42)' }, vividOverlay: { backgroundColor: 'rgba(255,184,0,0.22)' },
});
