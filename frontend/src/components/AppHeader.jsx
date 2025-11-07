import React from 'react';
import {
  AppBar, Toolbar, Typography, Box, Avatar, Button, IconButton, Menu, MenuItem, Tooltip
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useColorMode } from '../theme/ColorMode';

export default function AppHeader({ title = 'Financial Reports Portal', subtitle, onMenuClick, actions }) {
  const nav = useNavigate();
  const { signOut } = useAuth();
  const { mode, toggle } = useColorMode();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  return (
    <AppBar
          position="fixed"                         // was "sticky"
          color="inherit"
          elevation={1}
          sx={(theme) => ({
            backdropFilter: 'saturate(140%) blur(6px)',
            zIndex: theme.zIndex.drawer + 1        // <<< keeps header above the Drawer
          })}
        >
      <Toolbar sx={{ gap: 1.5 }}>
        <IconButton onClick={onMenuClick} sx={{ display: { xs:'inline-flex', md: 'none' } }}>
          <MenuIcon />
        </IconButton>
        <Avatar alt="MOH" src="/moh.svg" variant="rounded" sx={{ width: 44, height: 44 }} />
        <Box sx={{ flex: 1, ml: 1 }}>
          <Typography variant="h6" fontWeight={800}>{title}</Typography>
          {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
        </Box>

        <IconButton onClick={toggle} title="Toggle dark mode">
          {mode === 'light' ? <DarkModeIcon/> : <LightModeIcon/>}
        </IconButton>

        {actions ?? (
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, mr: 1 }}>
            <Button component={Link} to="/" startIcon={<DashboardIcon />} variant="text">Dashboard</Button>
            <Button component={Link} to="/admin/add-facility" startIcon={<AddBusinessIcon />} variant="text">Add Facility</Button>
            <Button component={Link} to="/admin/catalog" startIcon={<SettingsIcon />} variant="text">Catalog</Button>
          </Box>
        )}

        <Tooltip title="Account">
          <IconButton onClick={(e)=>setAnchorEl(e.currentTarget)} size="small">
            <Avatar sx={{ width: 36, height: 36 }}>U</Avatar>
          </IconButton>
        </Tooltip>
        <Menu open={open} anchorEl={anchorEl} onClose={()=>setAnchorEl(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
          <MenuItem onClick={()=>{ setAnchorEl(null); nav('/'); }}>
            <DashboardIcon fontSize="small" style={{ marginRight: 8 }}/> Dashboard
          </MenuItem>
          <MenuItem onClick={()=>{ setAnchorEl(null); nav('/admin/add-facility'); }}>
            <AddBusinessIcon fontSize="small" style={{ marginRight: 8 }}/> Add Facility
          </MenuItem>
          <MenuItem onClick={()=>{ setAnchorEl(null); nav('/admin/catalog'); }}>
            <SettingsIcon fontSize="small" style={{ marginRight: 8 }}/> Catalog
          </MenuItem>
          <MenuItem onClick={()=>{ setAnchorEl(null); signOut(); }}>
            <LogoutIcon fontSize="small" style={{ marginRight: 8 }}/> Sign out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
