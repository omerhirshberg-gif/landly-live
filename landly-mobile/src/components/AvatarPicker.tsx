import { useState } from 'react'
import { ActionSheetIOS, ActivityIndicator, Modal, Platform, Pressable, StyleSheet, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import { GestureDetector } from 'react-native-gesture-handler'
import type { User } from 'firebase/auth'
import { AVATAR_QUALITY, AVATAR_SIZE, coverCrop } from '@shared/avatar/avatar'
import { uploadAvatar } from '@shared/firebase/avatar'
import AppText from './AppText'
import Avatar from './Avatar'
import AvatarViewer, { useAvatarPeek } from './AvatarViewer'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

type Source = 'camera' | 'library'

// The Profile tab's avatar: tap it to take a photo or choose one from the
// library (iOS action sheet; a bottom sheet on Android; straight to the file
// picker on web, whose input already offers the camera on phones). The pick
// shows at once, is cropped square and shrunk to a ≤1024px JPEG on the
// device, then uploaded to avatars/{uid} through the same helper as the web
// uploader; every avatar in the app switches when it lands. The camera badge
// marks it as editable: there is no separate "Add photo" link. With no photo
// yet, the avatar itself carries the spoken label (Add photo, Uploading); once
// there is one, tapping the avatar opens it full size (AvatarViewer, with a
// Change photo button), a long press peeks at it until let go
// (useAvatarPeek), and the camera badge goes straight to the picker.
export default function AvatarPicker({
  user,
  uri,
  initials,
  size = 96,
}: {
  user: User
  uri: string | null
  initials: string
  size?: number
}) {
  const { t } = useLang()
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [viewing, setViewing] = useState(false)
  // iOS: the action sheet waits for the viewer to finish closing (onDismiss).
  const [pickAfterViewer, setPickAfterViewer] = useState(false)

  const pick = async (source: Source) => {
    setSheetOpen(false)
    setError(null)
    // The photo library needs no permission (the system picker runs out of
    // process); the camera does.
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        setError(t('avatar_permission_denied'))
        return
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 }
    let result: ImagePicker.ImagePickerResult
    try {
      result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
    } catch {
      // No camera (simulator) or the picker failed to open.
      setError(t('avatar_error'))
      return
    }
    const asset = result.canceled ? null : result.assets[0]
    if (!asset) return
    setPreview(asset.uri)
    setBusy(true)
    try {
      const jpeg = await compress(asset.uri, asset.width, asset.height)
      const blob = await (await fetch(jpeg)).blob()
      await uploadAvatar(user, blob)
      // The preview stays: it's the same picture, so swapping to the
      // uploaded URL would only flash while that downloads.
    } catch {
      setPreview(null)
      setError(t('avatar_error'))
    } finally {
      setBusy(false)
    }
  }

  const open = () => {
    if (busy) return
    if (Platform.OS === 'web') {
      pick('library')
    } else if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [t('avatar_take_photo'), t('avatar_choose_library'), t('avatar_cancel')], cancelButtonIndex: 2 },
        (index) => {
          if (index === 0) pick('camera')
          else if (index === 1) pick('library')
        }
      )
    } else {
      setSheetOpen(true)
    }
  }

  const photo = preview ?? uri
  const hasPhoto = !!photo
  const peek = useAvatarPeek(photo)
  const label = busy ? t('avatar_uploading') : hasPhoto ? t('avatar_change') : t('avatar_add')

  const changeFromViewer = () => {
    setViewing(false)
    // Web must open the file input inside the tap; Android's sheet and picker
    // don't mind the closing modal.
    if (Platform.OS === 'ios') setPickAfterViewer(true)
    else open()
  }

  return (
    <View style={styles.wrap}>
      <View>
        <GestureDetector gesture={peek.gesture}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hasPhoto && !busy ? t('avatar_view') : label}
            accessibilityState={{ busy, disabled: busy && !hasPhoto }}
            onPressIn={peek.pressIn}
            onPress={() => {
              if (peek.wasPeek()) return
              if (hasPhoto) setViewing(true)
              else open()
            }}
            style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
          >
            <Avatar uri={photo} initials={initials} size={size} />
            {busy && (
              <View style={[styles.busy, { borderRadius: size / 2 }]}>
                <ActivityIndicator color={colors.white} />
              </View>
            )}
          </Pressable>
        </GestureDetector>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ busy, disabled: busy }}
          // With no photo the avatar is the same control, so this one stays out of the screen reader's way.
          accessibilityElementsHidden={!hasPhoto}
          importantForAccessibility={hasPhoto ? 'auto' : 'no-hide-descendants'}
          onPress={open}
          hitSlop={8}
          style={styles.badge}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.white} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
            <Circle cx="12" cy="13" r="3" />
          </Svg>
        </Pressable>
      </View>
      {photo && (
        <AvatarViewer
          uri={photo}
          visible={viewing}
          onClose={() => setViewing(false)}
          action={{ label: t('avatar_change'), onPress: changeFromViewer }}
          onDismissed={() => {
            if (!pickAfterViewer) return
            setPickAfterViewer(false)
            open()
          }}
        />
      )}
      {error && (
        <AppText accessibilityRole="alert" style={styles.error}>
          {error}
        </AppText>
      )}
      {Platform.OS === 'android' && <SourceSheet visible={sheetOpen} onPick={pick} onClose={() => setSheetOpen(false)} />}
    </View>
  )
}

// Android's camera / library choice: a Material bottom sheet with ripple rows.
function SourceSheet({ visible, onPick, onClose }: { visible: boolean; onPick: (source: Source) => void; onClose: () => void }) {
  const { t } = useLang()
  const insets = useSafeAreaInsets()
  const rows: { key: Source | 'cancel'; label: string }[] = [
    { key: 'camera', label: t('avatar_take_photo') },
    { key: 'library', label: t('avatar_choose_library') },
    { key: 'cancel', label: t('avatar_cancel') },
  ]
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t('avatar_cancel')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.handle} />
        {rows.map((row) => (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            android_ripple={{ color: 'rgba(0, 56, 184, 0.12)' }}
            onPress={() => (row.key === 'cancel' ? onClose() : onPick(row.key))}
            style={styles.sheetRow}
          >
            <AppText style={[styles.sheetLabel, row.key === 'cancel' && styles.sheetCancel]}>{row.label}</AppText>
          </Pressable>
        ))}
      </View>
    </Modal>
  )
}

// Centre square, ≤1024px, JPEG. The editors already return a square on iOS
// and Android; web (no editor) and odd results get the centre crop here.
async function compress(uri: string, width: number, height: number): Promise<string> {
  const context = ImageManipulator.manipulate(uri)
  if (width > 0 && height > 0) {
    const { originX, originY, side, output } = coverCrop(width, height)
    if (width !== height) context.crop({ originX, originY, width: side, height: side })
    context.resize({ width: output, height: output })
  } else {
    context.resize({ width: AVATAR_SIZE })
  }
  const image = await context.renderAsync()
  try {
    const saved = await image.saveAsync({ compress: AVATAR_QUALITY, format: SaveFormat.JPEG })
    return saved.uri
  } finally {
    image.release()
    context.release()
  }
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  pressable: { borderRadius: radius.pill, ...webOnly({ cursor: 'pointer' }) },
  pressed: { opacity: 0.85 },
  busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11, 27, 61, 0.4)', alignItems: 'center', justifyContent: 'center' },
  // Bottom-trailing camera badge: brand fill, white ring to lift it off the photo.
  badge: {
    position: 'absolute',
    bottom: 0,
    end: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },
  error: { marginTop: 10, fontSize: 13, fontWeight: '600', color: colors.danger, textAlign: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(11, 27, 61, 0.32)' },
  sheet: {
    backgroundColor: colors.surfaceContainer,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.textFaint, marginBottom: 8 },
  sheetRow: { minHeight: 56, paddingHorizontal: 24, justifyContent: 'center' },
  sheetLabel: { fontSize: 16, fontWeight: '500', color: colors.heading },
  sheetCancel: { color: colors.body },
})
