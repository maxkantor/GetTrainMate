import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { AcquisitionCustomer, PanelSharedProps } from './types';
import {
  API,
  EmptyState,
  PanelSkeleton,
  asArray,
  formatCents,
  formatDate,
  formatEntityType,
  formatCustomerStatus,
} from './components';
import { adminApiService } from '@/services/adminApiService';

export const CustomersPanel: React.FC<PanelSharedProps> = ({ onError, refreshKey }) => {
  const [customers, setCustomers] = useState<AcquisitionCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'any' | 'individual' | 'organization'>('any');
  const [payingOnly, setPayingOnly] = useState<'any' | 'paying'>('any');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const data = await adminApiService.get(`${API}/acquisition/customers`);
      setCustomers(asArray<AcquisitionCustomer>(data));
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to load acquisition customers');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const entity = (c.entityType || c.prospectType || '').toLowerCase();
      if (typeFilter === 'individual' && !entity.includes('individual') && !entity.includes('person')) {
        return false;
      }
      if (typeFilter === 'organization' && (entity.includes('individual') || entity.includes('person'))) {
        return false;
      }
      if (typeFilter === 'organization' && !entity) {
        // default treat missing as org
      }
      const revenue = c.revenueCents ?? (c.directRevenueCents ?? 0) + (c.attributedRevenueCents ?? 0);
      const buyers = c.buyers ?? c.paidCustomers ?? c.creditPurchases ?? 0;
      const paying = buyers > 0 || revenue > 0 || (c.customerStatus || '').toUpperCase() === 'PAYING_CUSTOMER';
      if (payingOnly === 'paying' && !paying) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [c.name, c.organizationName, c.source, c.discoverySource, c.campaignName, c.campaignId]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [customers, typeFilter, payingOnly, search]);

  if (loading && customers.length === 0) return <PanelSkeleton rows={6} />;

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }} useFlexGap flexWrap="wrap">
        <TextField
          size="small"
          label="Search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput.trim())}
          sx={{ minWidth: 200 }}
        />
        <Button variant="outlined" size="small" onClick={() => setSearch(searchInput.trim())}>
          Search
        </Button>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Type</InputLabel>
          <Select
            label="Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          >
            <MenuItem value="any">Any</MenuItem>
            <MenuItem value="individual">Individual</MenuItem>
            <MenuItem value="organization">Organization</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Paying</InputLabel>
          <Select
            label="Paying"
            value={payingOnly}
            onChange={(e) => setPayingOnly(e.target.value as typeof payingOnly)}
          >
            <MenuItem value="any">Any</MenuItem>
            <MenuItem value="paying">Paying only</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {filtered.length === 0 ? (
        <EmptyState
          title="No attributed customers yet — send approved outreach to start attribution."
          detail={customers.length > 0 ? 'No rows match the current filters.' : undefined}
        />
      ) : (
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Source</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Campaign</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Signup</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Activation</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Credits / Buyers</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Revenue</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Last Active</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((c) => {
                const id = c.prospectId || c.customerId || c.organizationName || 'row';
                const revenue = c.revenueCents ?? (c.directRevenueCents ?? 0) + (c.attributedRevenueCents ?? 0);
                const buyers = c.buyers ?? c.paidCustomers ?? c.creditPurchases ?? 0;
                const credits = c.creditPurchases ?? c.paidCustomers ?? buyers;
                return (
                  <TableRow key={id} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600, fontSize: 13 }}>
                        {c.name || c.organizationName || '—'}
                      </Typography>
                      {c.customerStatus && (
                        <Typography variant="caption" color="text.secondary">
                          {formatCustomerStatus(c.customerStatus)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{formatEntityType(c.entityType || c.prospectType || 'ORGANIZATION')}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{c.source || c.discoverySource || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{c.campaignName || c.campaignId || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{formatDate(c.signupAt)}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{formatDate(c.activatedAt)}</TableCell>
                    <TableCell sx={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {credits}/{buyers}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{formatCents(revenue)}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{formatDate(c.lastActiveAt || c.lastContactedAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};
