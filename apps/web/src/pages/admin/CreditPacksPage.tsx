import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
} from '@mui/material';
import { adminApiService } from '@/services/adminApiService';

interface CreditPackAdmin {
  key: string;
  title: string;
  priceUsd: number;
  credits: number;
  isActive: boolean;
  sortOrder: number;
  isBestValue: boolean;
}

export const CreditPacksPage: React.FC = () => {
  const [packs, setPacks] = useState<CreditPackAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<CreditPackAdmin>>>({});

  useEffect(() => {
    loadPacks();
  }, []);

  const loadPacks = async () => {
    try {
      setLoading(true);
      const data = await adminApiService.get('/api/admin/credit-packs');
      setPacks(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load packs');
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    try {
      await adminApiService.post('/api/admin/credit-packs/seed', {});
      setToast({ message: 'Credit packs seeded', severity: 'success' });
      loadPacks();
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : 'Seed failed', severity: 'error' });
    }
  };

  const updateEdit = (key: string, field: keyof CreditPackAdmin, value: unknown) => {
    setEdits((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const getValue = (pack: CreditPackAdmin, field: keyof CreditPackAdmin): unknown => {
    const e = edits[pack.key];
    if (e && field in e) return (e as Record<string, unknown>)[field];
    return pack[field];
  };

  const handleSave = async (packKey: string) => {
    const pack = packs.find((p) => p.key === packKey);
    if (!pack) return;

    const e = edits[packKey] || {};
    const payload = {
      title: e.title ?? pack.title,
      priceUsd: e.priceUsd ?? pack.priceUsd,
      credits: e.credits ?? pack.credits,
      isActive: e.isActive ?? pack.isActive,
      sortOrder: e.sortOrder ?? pack.sortOrder,
      isBestValue: e.isBestValue ?? pack.isBestValue,
    };

    try {
      setSaving(packKey);
      await adminApiService.put(`/api/admin/credit-packs/${packKey}`, payload);
      setToast({ message: 'Pack saved', severity: 'success' });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[packKey];
        return next;
      });
      loadPacks();
    } catch (err: unknown) {
      setToast({ message: err instanceof Error ? err.message : 'Save failed', severity: 'error' });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <Typography>Loading…</Typography>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Credit Packs
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure credit packs shown on the pricing page. Prices are sent at checkout (no Stripe Price IDs required).
      </Typography>
      <Button variant="outlined" onClick={handleSeed} sx={{ mb: 2 }}>
        Seed default packs
      </Button>

      <Table component={Paper} sx={{ mt: 2 }}>
        <TableHead>
          <TableRow>
            <TableCell>Key</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>Price ($)</TableCell>
            <TableCell>Credits</TableCell>
            <TableCell>Best value</TableCell>
            <TableCell>Active</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {packs.map((pack) => (
            <TableRow key={pack.key}>
              <TableCell>{pack.key}</TableCell>
              <TableCell>
                <TextField
                  size="small"
                  value={getValue(pack, 'title')}
                  onChange={(e) => updateEdit(pack.key, 'title', e.target.value)}
                  fullWidth
                />
              </TableCell>
              <TableCell>
                <TextField
                  size="small"
                  type="number"
                  inputProps={{ step: 0.01 }}
                  value={getValue(pack, 'priceUsd')}
                  onChange={(e) => updateEdit(pack.key, 'priceUsd', parseFloat(e.target.value) || 0)}
                  sx={{ width: 90 }}
                />
              </TableCell>
              <TableCell>
                <TextField
                  size="small"
                  type="number"
                  value={getValue(pack, 'credits')}
                  onChange={(e) => updateEdit(pack.key, 'credits', parseInt(e.target.value, 10) || 0)}
                  sx={{ width: 80 }}
                />
              </TableCell>
              <TableCell>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!getValue(pack, 'isBestValue')}
                      onChange={(e) => updateEdit(pack.key, 'isBestValue', e.target.checked)}
                    />
                  }
                  label=""
                />
              </TableCell>
              <TableCell>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!getValue(pack, 'isActive')}
                      onChange={(e) => updateEdit(pack.key, 'isActive', e.target.checked)}
                    />
                  }
                  label=""
                />
              </TableCell>
              <TableCell align="right">
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleSave(pack.key)}
                  disabled={saving === pack.key}
                >
                  {saving === pack.key ? 'Saving…' : 'Save'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast?.message}
      />
    </Box>
  );
};
