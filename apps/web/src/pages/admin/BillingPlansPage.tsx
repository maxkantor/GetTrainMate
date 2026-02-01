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

interface BillingPlanAdmin {
  key: string;
  displayName: string;
  monthlyPrice: number;
  features: string[];
  isActive: boolean;
  sortOrder: number;
  stripePriceIdMonthly: string;
}

export const BillingPlansPage: React.FC = () => {
  const [plans, setPlans] = useState<BillingPlanAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const [edits, setEdits] = useState<Record<string, Partial<BillingPlanAdmin>>>({});

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const data = await adminApiService.get('/api/admin/billing/plans');
      setPlans(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    try {
      await adminApiService.post('/api/admin/billing/plans/seed', {});
      setToast({ message: 'Plans seeded', severity: 'success' });
      loadPlans();
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : 'Seed failed', severity: 'error' });
    }
  };

  const updateEdit = (key: string, field: keyof BillingPlanAdmin, value: unknown) => {
    setEdits((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const getValue = (plan: BillingPlanAdmin, field: keyof BillingPlanAdmin): unknown => {
    const e = edits[plan.key];
    if (e && field in e) return (e as Record<string, unknown>)[field];
    return plan[field];
  };

  const handleSave = async (planKey: string) => {
    const plan = plans.find((p) => p.key === planKey);
    if (!plan) return;

    const e = edits[planKey] || {};
    const payload = {
      displayName: e.displayName ?? plan.displayName,
      monthlyPrice: e.monthlyPrice ?? plan.monthlyPrice,
      features: e.features ?? plan.features,
      isActive: e.isActive ?? plan.isActive,
      sortOrder: e.sortOrder ?? plan.sortOrder,
      stripePriceIdMonthly: e.stripePriceIdMonthly ?? plan.stripePriceIdMonthly,
    };

    try {
      setSaving(planKey);
      await adminApiService.put(`/api/admin/billing/plans/${planKey}`, payload);
      setToast({ message: 'Plan saved', severity: 'success' });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[planKey];
        return next;
      });
      loadPlans();
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
        Billing Plans
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure plans and Stripe Price IDs. Pro and Elite require stripePriceIdMonthly for checkout.
      </Typography>
      <Button variant="outlined" onClick={handleSeed} sx={{ mb: 2 }}>
        Seed default plans
      </Button>

      <Table component={Paper} sx={{ mt: 2 }}>
        <TableHead>
          <TableRow>
            <TableCell>Key</TableCell>
            <TableCell>Display Name</TableCell>
            <TableCell>Monthly Price</TableCell>
            <TableCell>Stripe Price ID (Pro/Elite)</TableCell>
            <TableCell>Active</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {plans.map((plan) => (
            <TableRow key={plan.key}>
              <TableCell>{plan.key}</TableCell>
              <TableCell>
                <TextField
                  size="small"
                  value={getValue(plan, 'displayName')}
                  onChange={(e) => updateEdit(plan.key, 'displayName', e.target.value)}
                  fullWidth
                />
              </TableCell>
              <TableCell>
                <TextField
                  size="small"
                  type="number"
                  inputProps={{ step: 0.01 }}
                  value={getValue(plan, 'monthlyPrice')}
                  onChange={(e) => updateEdit(plan.key, 'monthlyPrice', parseFloat(e.target.value) || 0)}
                  sx={{ width: 100 }}
                />
              </TableCell>
              <TableCell>
                {(plan.key === 'pro' || plan.key === 'elite') && (
                  <TextField
                    size="small"
                    placeholder="price_xxx"
                    value={getValue(plan, 'stripePriceIdMonthly')}
                    onChange={(e) => updateEdit(plan.key, 'stripePriceIdMonthly', e.target.value)}
                    fullWidth
                  />
                )}
              </TableCell>
              <TableCell>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!getValue(plan, 'isActive')}
                      onChange={(e) => updateEdit(plan.key, 'isActive', e.target.checked)}
                    />
                  }
                  label=""
                />
              </TableCell>
              <TableCell align="right">
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleSave(plan.key)}
                  disabled={saving === plan.key}
                >
                  {saving === plan.key ? 'Saving…' : 'Save'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Features are edited as JSON array. Use Seed to reset defaults.
        </Typography>
      </Box>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast?.message}
      />
    </Box>
  );
};
