// components/Layout.jsx
import React from 'react';
import {
  Box, Container, Drawer, List, ListItemButton, ListItemIcon,
  ListItemText, Toolbar, ListSubheader
} from '@mui/material';
import AppHeader from './AppHeader';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import SettingsIcon from '@mui/icons-material/Settings';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import ListAltIcon from '@mui/icons-material/ListAlt';
import TaskIcon from '@mui/icons-material/Task';
import SaveIcon from '@mui/icons-material/Save';

// 👉 NEW icons for Cashbook
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';

import { useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 240;

export default function Layout({ title, subtitle, children, maxWidth = 'lg' }) {
  const [open, setOpen] = React.useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const go = (path) => { nav(path); setOpen(false); };

  const DrawerContent = (
    <Box role="presentation">
      <Toolbar /> {/* creates space equal to AppBar height */}
      <List
        subheader={<ListSubheader disableSticky>Core</ListSubheader>}
      >
        <ListItemButton selected={loc.pathname === '/'} onClick={()=>go('/')}>
          <ListItemIcon><DashboardIcon/></ListItemIcon><ListItemText primary="Dashboard"/>
        </ListItemButton>
        <ListItemButton selected={loc.pathname === '/admin/add-facility'} onClick={()=>go('/admin/add-facility')}>
          <ListItemIcon><AddBusinessIcon/></ListItemIcon><ListItemText primary="Add Facility"/>
        </ListItemButton>
        <ListItemButton selected={loc.pathname === '/admin/catalog'} onClick={()=>go('/admin/catalog')}>
          <ListItemIcon><SettingsIcon/></ListItemIcon><ListItemText primary="Catalog"/>
        </ListItemButton>
      </List>

      <List
        subheader={<ListSubheader disableSticky>Budgeting</ListSubheader>}
      >
        <ListItemButton selected={loc.pathname.startsWith('/budget/lines')} onClick={()=>go('/budget/lines')}>
          <ListItemIcon><ListAltIcon/></ListItemIcon><ListItemText primary="Budget Lines"/>
        </ListItemButton>
        <ListItemButton selected={loc.pathname.startsWith('/budget/activities')} onClick={()=>go('/budget/activities')}>
          <ListItemIcon><TaskIcon/></ListItemIcon><ListItemText primary="Activities"/>
        </ListItemButton>
        <ListItemButton selected={loc.pathname.startsWith('/budget/new')} onClick={()=>go('/budget/new')}>
          <ListItemIcon><MonetizationOnIcon/></ListItemIcon><ListItemText primary="New Budget"/>
        </ListItemButton>
        <ListItemButton selected={loc.pathname.startsWith('/budget/sheet')} onClick={()=>go('/budget/sheet')}>
          <ListItemIcon><SaveIcon/></ListItemIcon><ListItemText primary="Budget Sheet"/>
        </ListItemButton>
      </List>

      {/* 👉 NEW: Cashbook section */}
      <List
        subheader={<ListSubheader disableSticky>Cashbook</ListSubheader>}
      >
        <ListItemButton selected={loc.pathname.startsWith('/cashbook/sheet')} onClick={()=>go('/cashbook/sheet')}>
          <ListItemIcon><ReceiptLongIcon/></ListItemIcon><ListItemText primary="Cashbook Sheet"/>
        </ListItemButton>
        <ListItemButton selected={loc.pathname.startsWith('/cashbook/accounts')} onClick={()=>go('/cashbook/accounts')}>
          <ListItemIcon><AccountBalanceIcon/></ListItemIcon><ListItemText primary="Accounts"/>
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <>
      <AppHeader title={title} subtitle={subtitle} onMenuClick={()=>setOpen(true)} />

      {/* Temporary drawer on mobile */}
      <Drawer
        open={open}
        onClose={()=>setOpen(false)}
        sx={{ display:{ xs:'block', md:'none' } }}
      >
        {DrawerContent}
      </Drawer>

      {/* Permanent drawer on desktop; starts below the fixed AppBar */}
      <Drawer
        variant="permanent"
        open
        sx={{
          display:{ xs:'none', md:'block' },
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            top: { xs: 56, sm: 64 },                // offset under AppBar
            height: { xs: 'calc(100% - 56px)', sm: 'calc(100% - 64px)' },
          }
        }}
      >
        {DrawerContent}
      </Drawer>

      {/* Main content area; margin-left equals drawer width on desktop */}
      <Box
        component="main"
        sx={{ ml: { xs: 0, md: `${drawerWidth}px` } }}
      >
        <Toolbar />
        <Container maxWidth={maxWidth} sx={{ py: { xs: 2, md: 4 } }}>
          {children}
        </Container>
      </Box>
    </>
  );
}
