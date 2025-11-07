// src/pages/Login.jsx
import React, { useState } from 'react';
import {
  Box, Paper, TextField, Button, Typography, Grid, InputAdornment,
  IconButton, Avatar, Stack, Divider
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useAuth } from '../hooks/useAuth';

export default function Login(){
  const { signIn, loading } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [showPw, setShowPw] = useState(false);

  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  async function onSubmit(e){
    e.preventDefault();
    try{
      await signIn(username.trim(), password);
      enqueueSnackbar('Welcome!', { variant: 'success' });
      nav(from, { replace:true });
    }catch(err){
      enqueueSnackbar(err?.message || 'Login failed', { variant: 'error' });
    }
  }

  return (
    <Box sx={{
      minHeight:'100vh',
      display:'grid',
      placeItems:'center',
      p: { xs: 1.5, md: 3 },
      // soft ambient background like your image
      background:
        'radial-gradient(1200px 800px at 15% 10%, #e8f1ff, transparent 60%),' +
        'radial-gradient(1200px 800px at 85% 90%, #edf7ec, transparent 60%),' +
        '#f7f9fb'
    }}>
      <Paper
        className="loginCard"
        elevation={12}
        sx={{
          width: '100%',
          maxWidth: 1180,
          borderRadius: 36,
          overflow: 'hidden',
          boxShadow: '0 28px 80px rgba(18, 38, 63, .18)'
        }}
      >
        <Grid container>
          {/* LEFT: gradient brand panel */}
          <Grid
            item xs={12} md={5}
            sx={{
              background: 'linear-gradient(135deg, #1a73e8 0%, #5c6bc0 100%)',
              color: 'white',
              p: { xs: 4, md: 6 },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            <Stack spacing={2.5} alignItems="center">
              <Avatar src="/moh.svg" variant="rounded"
                      sx={{ width: 86, height: 86, bgcolor: 'white', borderRadius: 6, boxShadow: 3 }} />
              <Typography
                variant="h5"
                fontWeight={900}
                align="center"
                sx={{ letterSpacing: .2 }}
              >
                Financial Reports Portal
              </Typography>
              <Typography align="center" sx={{ opacity: .95 }}>
                Secure access to the Rwanda Health Facilities quarterly reporting system.
              </Typography>

              <Divider sx={{ width:'100%', borderColor:'rgba(255,255,255,.35)', my: 1.5 }} />

              <Stack spacing={1.2} sx={{ width:'100%' }}>
                <Feature text="Cashbook" />
                <Feature text="Quartely Reports" />
                <Feature text="Dashboards" />
              </Stack>
            </Stack>
          </Grid>

          {/* RIGHT: white form panel */}
          <Grid item xs={12} md={7} sx={{ p: { xs: 3, md: 6 } }}>
            <Typography variant="h5" fontWeight={900} gutterBottom>
              Welcome back
            </Typography>
            <Typography color="text.secondary" gutterBottom>
              Sign in with your credentials
            </Typography>

            <Box
              component="form"
              onSubmit={onSubmit}
              sx={{ mt: 3, display: 'grid', gap: 2.2, maxWidth: 560 }}
            >
              <TextField
                label="Username"
                required
                fullWidth
                value={username}
                onChange={e=>setU(e.target.value)}
                autoComplete="username"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon color="action" />
                    </InputAdornment>
                  )
                }}
              />

              <TextField
                label="Password"
                required
                fullWidth
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e=>setP(e.target.value)}
                autoComplete="current-password"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={()=>setShowPw(s=>!s)} edge="end" aria-label="toggle password">
                        {showPw ? <VisibilityOff/> : <Visibility/>}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              <Button
                type="submit"
                variant="contained"
                startIcon={<LoginIcon />}
                disabled={loading}
                sx={{
                  alignSelf: 'start',
                  px: 4,
                  borderRadius: 14,
                  boxShadow: '0 12px 30px rgba(26,115,232,.35)'
                }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>

              <Typography variant="caption" color="text.secondary">
                By continuing, you agree to the Terms and acknowledge the Privacy Policy.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}

function Feature({ text }){
  return (
    <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="flex-start">
      <CheckCircleRoundedIcon fontSize="small" sx={{ opacity:.95 }} />
      <Typography variant="body2" sx={{ opacity:.95 }}>{text}</Typography>
    </Stack>
  );
}
