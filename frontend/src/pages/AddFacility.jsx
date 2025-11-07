// src/pages/AddFacility.jsx
import React, { useEffect, useState } from 'react';
import {
  Container, Paper, Box, Button,
  Grid, TextField, MenuItem, Divider, Alert
} from '@mui/material';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import { catalog, FacilityLevels } from '../api/client';

export default function AddFacility(){
  const [countries, setCountries] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [hospitals, setHospitals] = useState([]);

  const [form, setForm] = useState({
    country_id: '', country_code: '',
    province_id: '', province_code: '',
    district_id: '', district_code: '',
    referral_hospital_id: '', referral_hospital_code: '',
    name: '', code: '',
    level: '',
  });

  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

  useEffect(()=>{ catalog.countries().then(setCountries).catch(e=>setErr(e.message)); },[]);
  useEffect(()=>{
    if (!form.country_id){ setProvinces([]); return; }
    catalog.provinces(form.country_id).then(setProvinces).catch(e=>setErr(e.message));
  }, [form.country_id]);
  useEffect(()=>{
    if (!form.province_id){ setDistricts([]); return; }
    catalog.districts(form.province_id).then(setDistricts).catch(e=>setErr(e.message));
  }, [form.province_id]);
  useEffect(()=>{
    if (!form.district_id){ setHospitals([]); return; }
    catalog.hospitals({ district_id: form.district_id }).then(setHospitals).catch(e=>setErr(e.message));
  }, [form.district_id]);

  // auto-fill hidden codes
  useEffect(()=>{
    const c = countries.find(x=>String(x.id)===String(form.country_id));
    setForm(prev=>({...prev, country_code: c?.code || ''}));
  }, [form.country_id, countries]);
  useEffect(()=>{
    const p = provinces.find(x=>String(x.id)===String(form.province_id));
    setForm(prev=>({...prev, province_code: p?.code || ''}));
  }, [form.province_id, provinces]);
  useEffect(()=>{
    const d = districts.find(x=>String(x.id)===String(form.district_id));
    setForm(prev=>({...prev, district_code: d?.code || ''}));
  }, [form.district_id, districts]);
  useEffect(()=>{
    const h = hospitals.find(x=>String(x.id)===String(form.referral_hospital_id));
    setForm(prev=>({...prev, referral_hospital_code: h?.code || ''}));
  }, [form.referral_hospital_id, hospitals]);

  function onChange(e){ const { name, value } = e.target; setForm(prev=>({...prev, [name]: value})); }

  async function onSubmit(e){
    e.preventDefault();
    setBusy(true); setErr(''); setOk('');
    try{
      const code = form.code?.trim() || form.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'_').slice(0,20);
      const payload = {
        name: form.name.trim(),
        code,
        level: form.level,
        country_id: Number(form.country_id),
        province_id: Number(form.province_id),
        district_id: Number(form.district_id),
        referral_hospital_id: form.referral_hospital_id ? Number(form.referral_hospital_id) : null,
      };
      await catalog.createFacility(payload);
      setOk('Facility saved successfully.');
      setForm(f=>({ ...f, name:'', code:'' }));
    }catch(e){
      setErr(e.message || 'Failed to save facility.');
    }finally{
      setBusy(false);
    }
  }

  // consistent bigger input height & spacing
  const fieldSx = {
    '& .MuiInputBase-root': { height: 56, borderRadius: 1.5 }, // taller inputs
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={4} sx={{ p: { xs: 2.5, md: 4 }, maxWidth: 1000, mx: 'auto' }}>
        <Box component="form" onSubmit={onSubmit}>
          <Grid container spacing={2.5}>
            {/* Country */}
            <Grid item xs={12} md={6}>
              <TextField
                select fullWidth required name="country_id" label="Country"
                value={form.country_id} onChange={onChange}
                placeholder="Select the country"
                helperText="Choose the country owning this facility."
                sx={fieldSx}
              >
                <MenuItem value="" disabled>— Select Country —</MenuItem>
                {countries.map(c => <MenuItem key={c.id} value={c.id}>{c.name} ({c.code})</MenuItem>)}
              </TextField>
            </Grid>

            {/* Province */}
            <Grid item xs={12} md={6}>
              <TextField
                select fullWidth required name="province_id" label="Province"
                value={form.province_id} onChange={onChange}
                disabled={!form.country_id}
                placeholder="Select the province"
                helperText={!form.country_id ? 'Select a country first' : 'Province where the facility is located.'}
                sx={fieldSx}
              >
                <MenuItem value="" disabled>— Select Province —</MenuItem>
                {provinces.map(p => <MenuItem key={p.id} value={p.id}>{p.name} ({p.code})</MenuItem>)}
              </TextField>
            </Grid>

            {/* District */}
            <Grid item xs={12} md={6}>
              <TextField
                select fullWidth required name="district_id" label="District"
                value={form.district_id} onChange={onChange}
                disabled={!form.province_id}
                placeholder="Select the district"
                helperText={!form.province_id ? 'Select a province first' : 'District where the facility is located.'}
                sx={fieldSx}
              >
                <MenuItem value="" disabled>— Select District —</MenuItem>
                {districts.map(d => <MenuItem key={d.id} value={d.id}>{d.name} ({d.code})</MenuItem>)}
              </TextField>
            </Grid>

            {/* Referral hospital (optional) */}
            <Grid item xs={12} md={6}>
              <TextField
                select fullWidth name="referral_hospital_id" label="Referral Hospital (optional)"
                value={form.referral_hospital_id} onChange={onChange}
                disabled={!form.district_id}
                placeholder="Select the referral hospital (if any)"
                helperText={!form.district_id ? 'Select a district first' : 'Optional: referral hospital supervising this facility.'}
                sx={fieldSx}
              >
                <MenuItem value="">— None / Not Applicable —</MenuItem>
                {hospitals.map(h => <MenuItem key={h.id} value={h.id}>{h.name} ({h.code})</MenuItem>)}
              </TextField>
            </Grid>

            {/* Facility level */}
            <Grid item xs={12} md={6}>
              <TextField
                select fullWidth required name="level" label="Facility Level"
                value={form.level} onChange={onChange}
                placeholder="Select the facility level"
                helperText="Pick one: National Referral, Provincial Referral, District Hospital, or Health Centre."
                sx={fieldSx}
              >
                <MenuItem value="" disabled>— Select Facility Level —</MenuItem>
                {FacilityLevels.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
              </TextField>
            </Grid>

            {/* Facility name */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth required name="name" label="Facility Name"
                value={form.name} onChange={onChange}
                placeholder="e.g., Kageyo Health Centre"
                helperText="Official facility name."
                sx={fieldSx}
              />
            </Grid>

            {/* Facility code (optional manual override) */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth name="code" label="Facility Code (auto if empty)"
                value={form.code} onChange={onChange}
                placeholder="Leave blank to auto-generate from name"
                helperText="If left empty, we’ll generate a code from the name (A–Z, 0–9, underscore)."
                sx={fieldSx}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
          {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

          <Box sx={{ textAlign: 'right' }}>
            <Button
              type="submit"
              variant="contained"
              startIcon={<AddBusinessIcon />}
              disabled={busy}
              sx={{ minWidth: 180, py: 1.2, borderRadius: 2 }}
            >
              {busy ? 'Saving…' : 'Save Facility'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}
