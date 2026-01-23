import React, { useState } from 'react';
import { AppBar, Box, Button, Container, IconButton, Menu, MenuItem, Toolbar, Select, FormControl, Avatar } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { SUPPORTED_LOCALES } from '@/i18n';
import styles from '@/styles/Header.module.css';

export const Header: React.FC = () => {
  const { t, locale, setLocale } = useI18n();
  const { isAuthenticated, user, logout } = useAuthContext();
  const navigate = useNavigate();
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState<null | HTMLElement>(null);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);

  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMenuAnchor(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileMenuAnchor(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileMenuAnchor(null);
  };

  const handleLogout = async () => {
    handleProfileMenuClose();
    await logout();
    navigate('/');
  };

  const navItems = [
    { label: t('header.pricing'), href: '/pricing' },
    { label: t('header.about'), href: '/about' },
    { label: t('header.faq'), href: '/faq' },
    { label: t('header.contact'), href: '/contact' },
  ];

  const appNavItems = [
    { label: t('nav.dashboard'), href: '/app/discover' },
    { label: t('nav.match'), href: '/app/matches' },
    { label: t('nav.chat'), href: '/app/chat' },
    { label: t('nav.events'), href: '/app/events' },
  ];

  return (
    <AppBar position="sticky" className={styles.header}>
      <Container maxWidth="lg">
        <Toolbar disableGutters>
          {/* Logo */}
          <Box component={RouterLink} to="/" className={styles.logo}>
            {t('common.appName')}
          </Box>

          {/* Desktop Navigation */}
          <Box className={styles.desktopNav}>
            {isAuthenticated
              ? appNavItems.map((item) => (
                  <Button
                    key={item.href}
                    component={RouterLink}
                    to={item.href}
                    color="inherit"
                    sx={{ mx: 1 }}
                  >
                    {item.label}
                  </Button>
                ))
              : navItems.map((item) => (
                  <Button
                    key={item.href}
                    component={RouterLink}
                    to={item.href}
                    color="inherit"
                    sx={{ mx: 1 }}
                  >
                    {item.label}
                  </Button>
                ))}
          </Box>

          {/* Language Selector */}
          <FormControl variant="standard" size="small" sx={{ minWidth: 80, mx: 2 }}>
            <Select
              value={locale}
              onChange={(e) => setLocale(e.target.value as any)}
              className={styles.languageSelect}
            >
              {SUPPORTED_LOCALES.map((loc) => (
                <MenuItem key={loc} value={loc}>
                  {loc.toUpperCase()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Auth Buttons / User Menu */}
          <Box className={styles.authButtons}>
            {isAuthenticated && user ? (
              <>
                <IconButton
                  onClick={handleProfileMenuOpen}
                  sx={{ ml: 1 }}
                >
                  <Avatar sx={{ width: 32, height: 32, backgroundColor: 'primary.main' }}>
                    {user.name?.charAt(0).toUpperCase()}
                  </Avatar>
                </IconButton>
                <Menu
                  anchorEl={profileMenuAnchor}
                  open={Boolean(profileMenuAnchor)}
                  onClose={handleProfileMenuClose}
                >
                  <MenuItem component={RouterLink} to="/app/profile" onClick={handleProfileMenuClose}>
                    {t('header.profile')}
                  </MenuItem>
                  <MenuItem component={RouterLink} to="/app/settings" onClick={handleProfileMenuClose}>
                    {t('header.settings')}
                  </MenuItem>
                  {user.groups?.includes('Admin') && (
                    <MenuItem component={RouterLink} to="/admin" onClick={handleProfileMenuClose}>
                      {t('header.admin')}
                    </MenuItem>
                  )}
                  <MenuItem onClick={handleLogout}>
                    {t('common.logout')}
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <>
                <Button component={RouterLink} to="/login" color="inherit" variant="text">
                  {t('header.login')}
                </Button>
                <Button
                  component={RouterLink}
                  to="/signup"
                  variant="contained"
                  color="primary"
                  sx={{ ml: 1 }}
                >
                  {t('header.signup')}
                </Button>
              </>
            )}
          </Box>

          {/* Mobile Menu */}
          <IconButton
            className={styles.mobileMenuButton}
            color="inherit"
            onClick={handleMobileMenuOpen}
          >
            <MenuIcon />
          </IconButton>

          <Menu
            anchorEl={mobileMenuAnchor}
            open={Boolean(mobileMenuAnchor)}
            onClose={handleMobileMenuClose}
          >
            {(isAuthenticated ? appNavItems : navItems).map((item) => (
              <MenuItem
                key={item.href}
                component={RouterLink}
                to={item.href}
                onClick={handleMobileMenuClose}
              >
                {item.label}
              </MenuItem>
            ))}
            {isAuthenticated && user ? (
              <>
                <MenuItem
                  component={RouterLink}
                  to="/app/profile"
                  onClick={handleMobileMenuClose}
                >
                  {t('header.profile')}
                </MenuItem>
                <MenuItem
                  component={RouterLink}
                  to="/app/settings"
                  onClick={handleMobileMenuClose}
                >
                  {t('header.settings')}
                </MenuItem>
                {user.groups?.includes('Admin') && (
                  <MenuItem
                    component={RouterLink}
                    to="/admin"
                    onClick={handleMobileMenuClose}
                  >
                    {t('header.admin')}
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    handleMobileMenuClose();
                    handleLogout();
                  }}
                >
                  {t('common.logout')}
                </MenuItem>
              </>
            ) : (
              <>
                <MenuItem component={RouterLink} to="/login" onClick={handleMobileMenuClose}>
                  {t('header.login')}
                </MenuItem>
                <MenuItem component={RouterLink} to="/signup" onClick={handleMobileMenuClose}>
                  {t('header.signup')}
                </MenuItem>
              </>
            )}
          </Menu>
        </Toolbar>
      </Container>
    </AppBar>
  );
};
