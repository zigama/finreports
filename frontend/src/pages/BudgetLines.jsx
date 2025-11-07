import React, { useEffect, useState } from 'react';
import { Paper, Box, Grid, TextField, Button, Typography, Divider, Alert, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { budgeting } from '../api/client';

export default function BudgetLines(){
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ code:'', name:'', description:'' });
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(''); const [err, setErr] = useState('');

  async function load(){ setErr(''); try{ setItems(await budgeting.listBudgetLines(q)); }catch(e){ setErr(e.message); } }
  useEffect(()=>{ load(); }, []); // initial
  useEffect(()=>{ const t = setTimeout(load, 300); return ()=>clearTimeout(t); }, [q]);

  const fieldSx = { '& .MuiInputBase-root': { height: 56, borderRadius: 1.5 } };

  async function onSubmit(e){
    e.preventDefault(); setBusy(true); setOk(''); setErr('');
    try{
      const payload = { code: form.code.trim(), name: form.name.trim(), description: form.description || null };
      await budgeting.createBudgetLine(payload);
      setOk('Budget line created.');
      setForm({ code:'', name:'', description:'' });
      load();
    }catch(e){ setErr(e.message || 'Failed to create budget line.'); }
    finally{ setBusy(false); }
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={800} gutterBottom>Budget Lines</Typography>

      <Paper sx={{ p:3, mb:3 }}>
        <Box component="form" onSubmit={onSubmit}>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={4}>
              <TextField fullWidth label="Code" required value={form.code} onChange={e=>setForm(f=>({...f, code:e.target.value}))}
                placeholder="e.g., BL-HRH" helperText="Unique code (uppercase letters/numbers/‘-’/‘_’)" sx={fieldSx}/>
            </Grid>
            <Grid item xs={12} md={8}>
              <TextField fullWidth label="Name" required value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))}
                placeholder="e.g., Human Resources for Health" helperText="Descriptive budget line name" sx={fieldSx}/>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline minRows={2} label="Description" value={form.description}
                onChange={e=>setForm(f=>({...f, description:e.target.value}))}
                placeholder="Optional description…" />
            </Grid>
          </Grid>

          <Divider sx={{ my:3 }}/>
          {err && <Alert severity="error" sx={{ mb:2 }}>{err}</Alert>}
          {ok && <Alert severity="success" sx={{ mb:2 }}>{ok}</Alert>}
          <Box sx={{ textAlign:'right' }}>
            <Button type="submit" variant="contained" startIcon={<PlaylistAddIcon/>} disabled={busy}>
              {busy ? 'Saving…' : 'Save Budget Line'}
            </Button>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p:2.5 }}>
        <Box sx={{ display:'flex', gap:2, mb:2 }}>
          <TextField placeholder="Search by code or name…" value={q} onChange={e=>setQ(e.target.value)} />
          <Button onClick={load}>Refresh</Button>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell><TableCell>Name</TableCell><TableCell>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map(row=>(
              <TableRow key={row.id}>
                <TableCell>{row.code}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
