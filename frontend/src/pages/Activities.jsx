import React, { useEffect, useState } from 'react';
import { Paper, Box, Grid, TextField, Button, Typography, Divider, Alert, MenuItem, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { budgeting } from '../api/client';

export default function Activities(){
  const [lines, setLines] = useState([]);
  const [items, setItems] = useState([]);
  const [filterLine, setFilterLine] = useState('');
  const [q, setQ] = useState('');

  const [form, setForm] = useState({ budget_line_id:'', code:'', name:'', description:'' });
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(''); const [err, setErr] = useState('');

  const fieldSx = { '& .MuiInputBase-root': { height: 56, borderRadius: 1.5 } };

  async function load() {
    setErr('');
    try{
      const [bl, acts] = await Promise.all([
        budgeting.listBudgetLines(),
        budgeting.listActivities({ budget_line_id: filterLine || undefined, q: q || undefined }),
      ]);
      setLines(bl); setItems(acts);
    }catch(e){ setErr(e.message); }
  }

  useEffect(()=>{ load(); }, []); // init
  useEffect(()=>{ const t = setTimeout(load, 250); return ()=>clearTimeout(t); }, [filterLine, q]);

  async function onSubmit(e){
    e.preventDefault(); setBusy(true); setOk(''); setErr('');
    try{
      if (!form.budget_line_id) throw new Error('Please select a Budget Line.');
      const payload = {
        budget_line_id: Number(form.budget_line_id),
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description || null
      };
      await budgeting.createActivity(payload);
      setOk('Activity created.');
      setForm(f=>({ ...f, code:'', name:'', description:'' }));
      load();
    }catch(e){ setErr(e.message || 'Failed to create activity.'); }
    finally{ setBusy(false); }
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={800} gutterBottom>Activities</Typography>

      <Paper sx={{ p:3, mb:3 }}>
        <Box component="form" onSubmit={onSubmit}>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <TextField select fullWidth required label="Budget Line"
                value={form.budget_line_id} onChange={e=>setForm(f=>({...f, budget_line_id:e.target.value}))}
                 sx={fieldSx}
                helperText="Select the parent Budget Line">
                <MenuItem value="" disabled>— Select Budget Line —</MenuItem>
                {lines.map(bl => <MenuItem key={bl.id} value={bl.id}>{bl.code} — {bl.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Activity Code" required value={form.code}
                onChange={e=>setForm(f=>({...f, code:e.target.value}))}
                placeholder="e.g., ACT-TRAIN" helperText="Unique per Budget Line" sx={fieldSx}/>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Activity Name" required value={form.name}
                onChange={e=>setForm(f=>({...f, name:e.target.value}))}
                placeholder="e.g., Training workshops" helperText="Descriptive activity name" sx={fieldSx}/>
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
            <Button type="submit" variant="contained" startIcon={<TaskAltIcon/>} disabled={busy}>
              {busy ? 'Saving…' : 'Save Activity'}
            </Button>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p:2.5 }}>
        <Grid container spacing={2} sx={{ mb:2 }}>
          <Grid item xs={12} md={6}>
            <TextField select fullWidth label="Filter by Budget Line" value={filterLine}
              onChange={e=>setFilterLine(e.target.value)}  helperText="Filter By  Budget Line">
              <MenuItem value="">— All Budget Lines —</MenuItem>
              {lines.map(bl => <MenuItem key={bl.id} value={bl.id}>{bl.code} — {bl.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth placeholder="Search activities…" value={q} onChange={e=>setQ(e.target.value)} />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth onClick={load}>Refresh</Button>
          </Grid>
        </Grid>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Budget Line</TableCell><TableCell>Code</TableCell><TableCell>Name</TableCell><TableCell>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map(row=>(
              <TableRow key={row.id}>
                <TableCell>{(lines.find(l=>l.id===row.budget_line_id)?.code) || row.budget_line_id}</TableCell>
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
