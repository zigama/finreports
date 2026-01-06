import React, { useEffect, useState } from 'react';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Switch, Table, TableHead, TableRow, TableCell, TableBody
} from '@mui/material';
import Layout from '../components/Layout';
import { useUser } from '../hooks/useUser';
import {users} from '../api/client';
import { useNavigate, useLocation } from 'react-router-dom';

export default function AdminUsers() {
  const { isCountry } = useUser();
  const [lusers, setLusers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const loc = useLocation();
  const nav = useNavigate();
  const go = (path) => { nav(path); setOpen(false); };

  const loadUsers = async () => {
    const res = await users.list();
    //console.log(res);
    setLusers(res);
  };

  useEffect(() => {
    if (isCountry) loadUsers();
  }, [isCountry]);

  if (!isCountry) return null;

  const saveUser = async () => {
    if (editing.id) {
      await api.put(`/admin/users/${editing.id}/edit`, editing);
    } else {
      await api.post('/admin/users', editing);
    }
    setOpen(false);
    loadUsers();
  };

  const resetPassword = async (id) => {
    await api.post(`/admin/users/${id}/reset-password`);
    alert('Password reset link sent');
  };

  const toggleActive = async (u) => {
    await api.patch(`/admin/users/${u.id}/status`, { active: !u.active });
    loadUsers();
  };

  return (
    <Layout title="User Management">
      <Button variant="contained" selected={loc.pathname.startsWith('/admin/users/new')} onClick={()=>go('/admin/users/new')}>
        New User
      </Button>

      <Table sx={{ mt:2 }}>
        <TableHead>
          <TableRow>
            <TableCell>Username</TableCell>
            <TableCell>Access Level</TableCell>
            <TableCell>Active</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {lusers.map(u => (
            <TableRow key={u.id}>
              <TableCell>{u.username}</TableCell>
              <TableCell>{u.access_level}</TableCell>
              <TableCell>
                <Switch checked={u.active} onChange={()=>toggleActive(u)} />
              </TableCell>
              <TableCell>
                <Button size="small" selected={loc.pathname.startsWith(`/admin/users/${u.id}/edit`)} onClick={()=>go(`/admin/users/${u.id}/edit`)}>
                  Edit
                </Button>
                {/*<Button size="small" onClick={()=>resetPassword(u.id)}>
                  Reset Password
                </Button>*/}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onClose={()=>setOpen(false)}>
        <DialogTitle>{editing?.id ? 'Edit User' : 'Create User'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth margin="dense" label="Username"
            value={editing?.username || ''}
            onChange={e=>setEditing({ ...editing, username:e.target.value })}
          />
          <TextField
            fullWidth margin="dense" label="Access Level"
            value={editing?.access_level || ''}
            onChange={e=>setEditing({ ...editing, access_level:e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setOpen(false)}>Cancel</Button>
          <Button onClick={saveUser} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
