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
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PeopleIcon from '@mui/icons-material/People';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';

import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../hooks/useUser';
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";

const drawerWidth = 240;

export default function Layout({ title, subtitle, children, maxWidth = 'lg' }) {
  const [open, setOpen] = React.useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const { isCountry } = useUser();

  const go = (path) => { nav(path); setOpen(false); };

  const DrawerContent = (
    <Box role="presentation">
      <Toolbar />

      {/* CORE */}
      <List subheader={<ListSubheader disableSticky>Core</ListSubheader>}>
        <ListItemButton selected={loc.pathname === '/'} onClick={()=>go('/')}>
          <ListItemIcon><DashboardIcon/></ListItemIcon>
          <ListItemText primary="Dashboard"/>
        </ListItemButton>

        <ListItemButton selected={loc.pathname === '/admin/add-facility'} onClick={()=>go('/admin/add-facility')}>
          <ListItemIcon><AddBusinessIcon/></ListItemIcon>
          <ListItemText primary="Add Facility"/>
        </ListItemButton>

        <ListItemButton selected={loc.pathname === '/admin/catalog'} onClick={()=>go('/admin/catalog')}>
          <ListItemIcon><SettingsIcon/></ListItemIcon>
          <ListItemText primary="Locations Catalog"/>
        </ListItemButton>
      </List>

      {/* BUDGETING */}
      <List subheader={<ListSubheader disableSticky>Budgeting</ListSubheader>}>
        <ListItemButton selected={loc.pathname.startsWith('/budget/lines')} onClick={()=>go('/budget/lines')}>
          <ListItemIcon><ListAltIcon/></ListItemIcon>
          <ListItemText primary="Budget Lines"/>
        </ListItemButton>

        <ListItemButton selected={loc.pathname.startsWith('/budget/activities')} onClick={()=>go('/budget/activities')}>
          <ListItemIcon><TaskIcon/></ListItemIcon>
          <ListItemText primary="Activities"/>
        </ListItemButton>

        <ListItemButton selected={loc.pathname.startsWith('/budget/new')} onClick={()=>go('/budget/new')}>
          <ListItemIcon><MonetizationOnIcon/></ListItemIcon>
          <ListItemText primary="New Budget"/>
        </ListItemButton>

        <ListItemButton selected={loc.pathname.startsWith('/budget/sheet')} onClick={()=>go('/budget/sheet')}>
          <ListItemIcon><SaveIcon/></ListItemIcon>
          <ListItemText primary="Budget Sheet"/>
        </ListItemButton>
      </List>

      {/* CASHBOOK */}
      <List subheader={<ListSubheader disableSticky>Cashbook</ListSubheader>}>
        <ListItemButton selected={loc.pathname.startsWith('/cashbook/sheet')} onClick={()=>go('/cashbook/sheet')}>
          <ListItemIcon><ReceiptLongIcon/></ListItemIcon>
          <ListItemText primary="Cashbook Sheet"/>
        </ListItemButton>

        <ListItemButton selected={loc.pathname.startsWith('/cashbook/accounts')} onClick={()=>go('/cashbook/accounts')}>
          <ListItemIcon><AccountBalanceIcon/></ListItemIcon>
          <ListItemText primary="Accounts"/>
        </ListItemButton>
      </List>


      {/* USER MANAGEMENT (COUNTRY ONLY) */}
      {isCountry && (
        <List subheader={<ListSubheader disableSticky>User Management</ListSubheader>}>
          <ListItemButton
            selected={loc.pathname.startsWith('/admin/users')}
            onClick={()=>go('/admin/users')}
          >
            <ListItemIcon><PeopleIcon/></ListItemIcon>
            <ListItemText primary="Users"/>
          </ListItemButton>
            <ListItemButton selected={loc.pathname.startsWith('/admin/users/new')} onClick={()=>go('/admin/users/new')}>
                <ListItemIcon><PlaylistAddIcon /></ListItemIcon>
                <ListItemText primary="Register User"/>
            </ListItemButton>
        </List>
      )}

    </Box>
  );

  return (
    <>
      <AppHeader title={title} subtitle={subtitle} onMenuClick={()=>setOpen(true)} />

      <Drawer open={open} onClose={()=>setOpen(false)} sx={{ display:{ xs:'block', md:'none' } }}>
        {DrawerContent}
      </Drawer>

      <Drawer
        variant="permanent"
        sx={{
          display:{ xs:'none', md:'block' },
          width: drawerWidth,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            top: { xs: 56, sm: 64 },
            height: { xs: 'calc(100% - 56px)', sm: 'calc(100% - 64px)' },
          }
        }}
      >
        {DrawerContent}
      </Drawer>

      <Box component="main" sx={{ ml:{ xs:0, md:`${drawerWidth}px` } }}>
        <Toolbar />
        <Container maxWidth={maxWidth} sx={{ py:4 }}>
          {children}
        </Container>
      </Box>
    </>
  );
}
