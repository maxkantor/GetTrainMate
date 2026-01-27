import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import { adminApiService } from '@/services/adminApiService';

interface Device {
  deviceId: string;
  deviceName: string;
  lastActive: string;
  tokenBalance: number;
  isPrimary: boolean;
}

interface WalletMergeResult {
  primaryWalletId: string;
  mergedWallets: string[];
  totalTokensMerged: number;
  message?: string;
}

export const DevicesPage: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeEmail, setMergeEmail] = useState('');
  const [mergeResult, setMergeResult] = useState<WalletMergeResult | null>(null);

  const loadDevices = async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await adminApiService.get(`/api/admin/users/${userId}/devices`);
      setDevices(data.devices || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  const handleMergeByEmail = async () => {
    if (!userId || !mergeEmail) {
      setError('User ID and email are required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await adminApiService.post(
        `/api/admin/users/${userId}/tokens/merge-by-email`,
        { email: mergeEmail, reason: 'Admin merge action' }
      );
      setMergeResult(result);
      setMergeDialogOpen(false);
      loadDevices(); // Reload to show updated balances
    } catch (err: any) {
      setError(err.message || 'Failed to merge wallets');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Devices & Tokens Management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {mergeResult && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMergeResult(null)}>
          {mergeResult.message || `Successfully merged ${mergeResult.mergedWallets.length} wallets. Total tokens merged: ${mergeResult.totalTokensMerged}`}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="User ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter user ID to view devices"
              sx={{ flexGrow: 1 }}
            />
            <Button variant="contained" onClick={loadDevices} disabled={!userId || loading}>
              Load Devices
            </Button>
          </Box>

          <Button
            variant="outlined"
            color="primary"
            onClick={() => setMergeDialogOpen(true)}
            disabled={!userId}
          >
            Merge Wallets by Stripe Email
          </Button>
        </CardContent>
      </Card>

      {devices.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Device ID</TableCell>
                <TableCell>Device Name</TableCell>
                <TableCell>Token Balance</TableCell>
                <TableCell>Last Active</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.deviceId}>
                  <TableCell>{device.deviceId}</TableCell>
                  <TableCell>{device.deviceName}</TableCell>
                  <TableCell>{device.tokenBalance}</TableCell>
                  <TableCell>{new Date(device.lastActive).toLocaleString()}</TableCell>
                  <TableCell>
                    {device.isPrimary && <Chip label="Primary" color="primary" size="small" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={mergeDialogOpen} onClose={() => setMergeDialogOpen(false)}>
        <DialogTitle>Merge Wallets by Stripe Email</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Stripe Email"
            value={mergeEmail}
            onChange={(e) => setMergeEmail(e.target.value)}
            placeholder="user@example.com"
            sx={{ mt: 2 }}
          />
          <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
            This will find all wallets linked to this email and merge them into the primary wallet.
            Token balances will be transferred and ledger entries created.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMergeDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleMergeByEmail} variant="contained" disabled={!mergeEmail}>
            Merge Wallets
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
