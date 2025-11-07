import React, { useEffect, useState } from 'react';
import {
  AppBar, Toolbar, Typography, Container, Paper, Box, Grid, TextField, MenuItem,
  Button, Avatar, Alert, Divider
} from '@mui/material';
import { catalog, FacilityLevels } from '../api/client';
import AddIcon from '@mui/icons-material/Add';

export default function Catalog(){
  const [countries, setCountries] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

  const [country, setCountry] = useState({ name:'', code:'' });
  const [province, setProvince] = useState({ country_id:'', name:'', code:'' });
  const [district, setDistrict] = useState({ province_id:'', name:'', code:'' });
  const [hospital, setHospital] = useState({ province_id:'', district_id:'', name:'', code:'', level:'' });

  useEffect(()=>{
    catalog.countries().then(setCountries);
  },[]);

  useEffect(()=>{
    if (!province.country_id) return setProvinces([]);
    catalog.provinces(province.country_id).then(setProvinces);
  }, [province.country_id]);

  useEffect(()=>{
    if (!hospital.province_id) return setDistricts([]);
    catalog.districts(hospital.province_id).then(setDistricts);
  }, [hospital.province_id]);

  const save = fn => async () => {
    setOk(''); setErr('');
    try{
      await fn();
      setOk('Saved successfully.');
    }catch(e){
      setErr(e.message || 'Save failed');
    }
  };

  return (
    <>


      <Container sx={{ py: 4 }}>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

        {/* Country */}
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={700}>Add Country</Typography>
          <Box sx={{ mt: 2, display: 'grid', gap: 2 }}>
            <TextField label="Name" value={country.name} onChange={e=>setCountry({...country, name:e.target.value})} />
            <TextField label="Code" value={country.code} onChange={e=>setCountry({...country, code:e.target.value})} />
            <Button startIcon={<AddIcon />} variant="contained" onClick={save(()=>catalog.createCountry(country))}>Save Country</Button>
          </Box>
        </Paper>

        {/* Province */}
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={700}>Add Province</Typography>
          <Box sx={{ mt: 2, display: 'grid', gap: 2 }}>
            <TextField select label="Country" value={province.country_id} onChange={e=>setProvince({...province, country_id:e.target.value})}>
              {countries.map(c=> <MenuItem key={c.id} value={c.id}>{c.name} ({c.code})</MenuItem>)}
            </TextField>
            <TextField label="Name" value={province.name} onChange={e=>setProvince({...province, name:e.target.value})} />
            <TextField label="Code" value={province.code} onChange={e=>setProvince({...province, code:e.target.value})} />
            <Button startIcon={<AddIcon />} variant="contained" onClick={save(()=>catalog.createProvince({
              country_id: Number(province.country_id), name: province.name, code: province.code
            }))}>Save Province</Button>
          </Box>
        </Paper>

        {/* District */}
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={700}>Add District</Typography>
          <Box sx={{ mt: 2, display: 'grid', gap: 2 }}>
            <TextField select label="Province" value={district.province_id} onChange={e=>setDistrict({...district, province_id:e.target.value})}>
              {provinces.map(p=> <MenuItem key={p.id} value={p.id}>{p.name} ({p.code})</MenuItem>)}
            </TextField>
            <TextField label="Name" value={district.name} onChange={e=>setDistrict({...district, name:e.target.value})} />
            <TextField label="Code" value={district.code} onChange={e=>setDistrict({...district, code:e.target.value})} />
            <Button startIcon={<AddIcon />} variant="contained" onClick={save(()=>catalog.createDistrict({
              province_id: Number(district.province_id), name: district.name, code: district.code
            }))}>Save District</Button>
          </Box>
        </Paper>

        {/* Hospital */}
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700}>Add Hospital</Typography>
          <Box sx={{ mt: 2, display: 'grid', gap: 2 }}>
            <TextField select label="Province" value={hospital.province_id} onChange={e=>setHospital({...hospital, province_id:e.target.value, district_id:''})}>
              {provinces.map(p=> <MenuItem key={p.id} value={p.id}>{p.name} ({p.code})</MenuItem>)}
            </TextField>
            <TextField select label="District" value={hospital.district_id} onChange={e=>setHospital({...hospital, district_id:e.target.value})} disabled={!hospital.province_id}>
              {districts.map(d=> <MenuItem key={d.id} value={d.id}>{d.name} ({d.code})</MenuItem>)}
            </TextField>
            <TextField select label="Facility Level" value={hospital.level} onChange={e=>setHospital({...hospital, level:e.target.value})}>
              {FacilityLevels.map(l=> <MenuItem key={l} value={l}>{l}</MenuItem>)}
            </TextField>
            <TextField label="Name" value={hospital.name} onChange={e=>setHospital({...hospital, name:e.target.value})} />
            <TextField label="Code" value={hospital.code} onChange={e=>setHospital({...hospital, code:e.target.value})} placeholder="Auto-generate yourself or set explicitly" />
            <Button startIcon={<AddIcon />} variant="contained" onClick={save(()=>{
              const code = hospital.code?.trim() || hospital.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'_').slice(0,20);
              return catalog.createHospital({
                name: hospital.name.trim(),
                code,
                level: hospital.level,
                province_id: Number(hospital.province_id),
                district_id: Number(hospital.district_id),
              });
            })}>Save Hospital</Button>
          </Box>
        </Paper>
      </Container>
    </>
  );
}
