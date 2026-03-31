import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Slider,
  Box,
  Typography,
  Stack,
} from '@mui/material';
import { getCircularCroppedBlob } from '@/utils/cropProfilePhoto';
import styles from './PhotoCropModal.module.css';

interface PhotoCropModalProps {
  open: boolean;
  imageFile: File | null;
  onClose: () => void;
  onSave: (blob: Blob) => void;
  saving?: boolean;
}

export const PhotoCropModal: React.FC<PhotoCropModalProps> = ({
  open,
  imageFile,
  onClose,
  onSave,
  saving = false,
}) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  React.useEffect(() => {
    if (!imageFile || !open) {
      setImgSrc(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImgSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    return () => URL.revokeObjectURL(url);
  }, [imageFile, open]);

  const onCropComplete = useCallback((_a: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = async () => {
    if (!imgSrc || !croppedAreaPixels) return;
    try {
      const blob = await getCircularCroppedBlob(imgSrc, croppedAreaPixels);
      onSave(blob);
    } catch {
      /* caller shows snack */
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Position your photo</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Drag to reposition. Pinch or use the slider to zoom. Preview is circular like your profile.
        </Typography>
        <Box className={styles.cropShell}>
          {imgSrc && (
            <Cropper
              image={imgSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </Box>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 40 }}>
            Zoom
          </Typography>
          <Slider
            value={zoom}
            min={1}
            max={3}
            step={0.01}
            onChange={(_, v) => setZoom(v as number)}
            aria-label="Zoom"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !croppedAreaPixels}>
          {saving ? 'Saving…' : 'Save photo'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
