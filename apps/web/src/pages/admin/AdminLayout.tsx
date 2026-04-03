import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Container,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import DevicesIcon from '@mui/icons-material/Devices';
import ChatIcon from '@mui/icons-material/Chat';
import EventIcon from '@mui/icons-material/Event';
import SupportIcon from '@mui/icons-material/Support';
import PaymentIcon from '@mui/icons-material/Payment';
import ContactsIcon from '@mui/icons-material/Contacts';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ScienceIcon from '@mui/icons-material/Science';
import FavoriteIcon from '@mui/icons-material/Favorite';
import LogoutIcon from '@mui/icons-material/Logout';
import { clearAdminSession, getAdminSession } from '@/services/adminAuthStorage';
import { adminApiService } from '@/services/adminApiService';

const drawerWidth = 240;

const menuItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { path: '/admin/users', label: 'Users CRM', icon: <PeopleIcon /> },
  { path: '/admin/matches', label: 'Matches', icon: <FavoriteIcon /> },
  { path: '/admin/test-users', label: 'Test Users', icon: <ScienceIcon /> },
  { path: '/admin/devices', label: 'Devices & Tokens', icon: <DevicesIcon /> },
  { path: '/admin/chats', label: 'Chat Moderation', icon: <ChatIcon /> },
  { path: '/admin/events', label: 'Events CRM', icon: <EventIcon /> },
  { path: '/admin/tickets', label: 'Support Tickets', icon: <SupportIcon /> },
  { path: '/admin/stripe', label: 'Stripe / Payments', icon: <PaymentIcon /> },
  { path: '/admin/credit-packs', label: 'Credit Packs', icon: <PaymentIcon /> },
  { path: '/admin/contacts', label: 'Contacts CRM', icon: <ContactsIcon /> },
  { path: '/admin/audit', label: 'Audit Logs', icon: <AssessmentIcon /> },
];

export const AdminLayout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const adminEmail = getAdminSession()?.email ?? '';

  const handleLogout = async () => {
    try {
      await adminApiService.post('/api/admin/auth/logout', {});
    } catch {
      /* ignore */
    }
    clearAdminSession();
    navigate('/admin/login', { replace: true });
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          GetTrainMate Admin
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              selected={location.pathname === item.path}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        color="default"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          bgcolor: 'rgba(12, 14, 24, 0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Admin Portal
          </Typography>
          {adminEmail && (
            <Typography variant="body2" sx={{ mr: 2, opacity: 0.85 }} noWrap>
              {adminEmail}
            </Typography>
          )}
          <IconButton color="inherit" onClick={() => void handleLogout()} aria-label="Sign out" title="Sign out">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              bgcolor: 'rgba(10, 12, 22, 0.98)',
              borderRight: '1px solid rgba(255,255,255,0.08)',
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              bgcolor: 'rgba(10, 12, 22, 0.98)',
              borderRight: '1px solid rgba(255,255,255,0.08)',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar />
        <Container maxWidth="xl">
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
};
