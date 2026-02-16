import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { AdminNoAccessPage } from './AdminNoAccess';
import PeopleIcon from '@mui/icons-material/People';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EventIcon from '@mui/icons-material/Event';
import PaymentIcon from '@mui/icons-material/Payment';
import { adminApiService } from '@/services/adminApiService';

interface Metrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  totalMatches: number;
  totalMessages: number;
  totalEvents: number;
  premiumSubscriptions: number;
  revenue: number;
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
}

export const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const data = await adminApiService.get('/api/admin/metrics?range=7d');
      setMetrics(data ?? {
        totalUsers: 0,
        activeUsers: 0,
        newUsers: 0,
        totalMatches: 0,
        totalMessages: 0,
        totalEvents: 0,
        premiumSubscriptions: 0,
        revenue: 0,
        recentActivity: [],
      });
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.message ?? '';
      if (status === 403 || /forbidden/i.test(msg)) {
        setError('FORBIDDEN');
        return;
      }
      setError(msg || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error === 'FORBIDDEN') {
    return <AdminNoAccessPage />;
  }
  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  const statCards = [
    { title: 'Revenue (MTD)', value: `$${(metrics?.revenue ?? 0).toLocaleString()}`, icon: <PaymentIcon sx={{ fontSize: 40 }} />, color: '#2e7d32' },
    { title: 'Orders (7d)', value: metrics?.recentActivity?.length ?? 0, icon: <TrendingUpIcon sx={{ fontSize: 40 }} />, color: '#1976d2' },
    { title: 'New Users', value: metrics?.newUsers ?? 0, icon: <PeopleIcon sx={{ fontSize: 40 }} />, color: '#6366f1' },
    { title: 'Active Users', value: metrics?.activeUsers ?? 0, icon: <PeopleIcon sx={{ fontSize: 40 }} />, color: '#ed6c02' },
    { title: 'Total Matches', value: metrics?.totalMatches ?? 0, icon: <EventIcon sx={{ fontSize: 40 }} />, color: '#9c27b0' },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Admin Dashboard
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      {card.title}
                    </Typography>
                    <Typography variant="h4">{card.value.toLocaleString()}</Typography>
                  </Box>
                  <Box sx={{ color: card.color }}>{card.icon}</Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Activity
          </Typography>
          {metrics?.recentActivity && metrics.recentActivity.length > 0 ? (
            <Box component="ul" sx={{ pl: 2 }}>
              {metrics.recentActivity.map((activity, index) => (
                <li key={index}>
                  <Typography variant="body2">
                    <strong>{activity.type}:</strong> {activity.description} -{' '}
                    {new Date(activity.timestamp).toLocaleString()}
                  </Typography>
                </li>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="textSecondary">
              No recent activity
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
