import React, { useEffect, useState } from 'react';
import { Grid, Paper, Typography, Box, Button } from '@mui/material';
import SummarizeIcon from '@mui/icons-material/Summarize';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { api } from '../api/client';

export default function Dashboard(){
  const [facilities, setFacilities] = useState([]);
  const [error, setError] = useState('');

  useEffect(()=>{
    api.facilities().then(setFacilities).catch(e=>setError(e.message));
  }, []);

  return (
    <>
      {/* Quick actions / KPIs */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <Paper elevation={4} sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 12px 38px rgba(18, 38, 63, .08)' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
              <SummarizeIcon/>
              <Typography variant="subtitle1" fontWeight={700}>Quarter Summary</Typography>
            </Box>
            <Typography color="text.secondary" sx={{ mt: .5 }}>
              Review expenditures & balances by quarter.
            </Typography>
            <Button size="small" variant="text" sx={{ mt: 1 }}>Open</Button>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={4} sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 12px 38px rgba(18, 38, 63, .08)' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
              <AccountBalanceIcon/>
              <Typography variant="subtitle1" fontWeight={700}>Bank Reconciliation</Typography>
            </Box>
            <Typography color="text.secondary" sx={{ mt: .5 }}>
              Verify bank statements vs cashbook.
            </Typography>
            <Button size="small" variant="text" sx={{ mt: 1 }}>Open</Button>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={4} sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 12px 38px rgba(18, 38, 63, .08)' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
              <ReceiptLongIcon/>
              <Typography variant="subtitle1" fontWeight={700}>Statements</Typography>
            </Box>
            <Typography color="text.secondary" sx={{ mt: .5 }}>
              Generate detailed quarter statements.
            </Typography>
            <Button size="small" variant="text" sx={{ mt: 1 }}>Open</Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Facilities table */}
      <Paper elevation={4} sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 12px 38px rgba(18, 38, 63, .08)' }}>
        <Typography variant="h6" fontWeight={800} gutterBottom>Facilities</Typography>
        {error && <Box sx={{ bgcolor: 'error.light', color: 'error.contrastText', p:1.5, borderRadius:1, mb:2 }}>{error}</Box>}
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0 }}>
            <thead>
              <tr>
                <th style={{ textAlign:'left', padding:'10px', borderBottom:'1px solid #eee' }}>ID</th>
                <th style={{ textAlign:'left', padding:'10px', borderBottom:'1px solid #eee' }}>Name</th>
              </tr>
            </thead>
            <tbody>
              {facilities.map((f, i) => (
                <tr key={f.id} style={{ background: i%2 ? '#fafafa' : 'transparent' }}>
                  <td style={{ padding:'10px', borderBottom:'1px solid #f2f2f2' }}>{f.id}</td>
                  <td style={{ padding:'10px', borderBottom:'1px solid #f2f2f2' }}>{f.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Paper>
    </>
  );
}
