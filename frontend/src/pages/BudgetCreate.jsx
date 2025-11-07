import React, { useEffect, useMemo, useState } from 'react';
import {
  Paper, Box, Grid, TextField, MenuItem, Button, Typography, Divider, Alert, RadioGroup, FormControlLabel, Radio
} from '@mui/material';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import { budgeting, catalog, FacilityLevels } from '../api/client';

export default function BudgetCreate(){
  const [lines, setLines] = useState([]);
  const [activities, setActivities] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [facilities, setFacilities] = useState([]);

  const [scope, setScope] = useState('hospital'); // or 'facility'
  const [form, setForm] = useState({
    hospital_id: '', facility_id: '',
    budget_line_id: '', activity_id: '',
    activity_description: '',
    level: '',
    estimated_number_quantity: '',
    estimated_frequency_occurrence: '',
    unit_price_usd: '',
    cost_per_unit_rwf: '',
    percent_effort_share: '',
    component_1:'', component_2:'', component_3:'', component_4:''
  });

  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(''); const [err, setErr] = useState('');

  const fieldSx = { '& .MuiInputBase-root': { height: 56, borderRadius: 1.5 } };

  useEffect(()=>{ // load static lists
    (async()=>{
      try{
        const [bl, hos, fac] = await Promise.all([
          budgeting.listBudgetLines(),
          catalog.hospitals(),
          catalog.facilities()
        ]);
        setLines(bl); setHospitals(hos); setFacilities(fac);
      }catch(e){ setErr(e.message); }
    })();
  }, []);

  useEffect(()=>{ // activities follow selected BL
    (async()=>{
      if (!form.budget_line_id){ setActivities([]); return; }
      try{
        const acts = await budgeting.listActivities({ budget_line_id: form.budget_line_id });
        setActivities(acts);
      }catch(e){ setErr(e.message); }
    })();
  }, [form.budget_line_id]);

  function onChange(e){ const { name, value } = e.target; setForm(prev=>({...prev, [name]: value})); }

  async function onSubmit(e){
    e.preventDefault(); setBusy(true); setOk(''); setErr('');
    try{
      if (scope==='hospital' && !form.hospital_id) throw new Error('Select a hospital or change scope.');
      if (scope==='facility' && !form.facility_id) throw new Error('Select a facility or change scope.');
      const payload = {
        hospital_id: scope==='hospital' ? Number(form.hospital_id) : null,
        facility_id: scope==='facility' ? Number(form.facility_id) : null,
        budget_line_id: Number(form.budget_line_id),
        activity_id: Number(form.activity_id),
        activity_description: form.activity_description || null,
        level: form.level || null,
        estimated_number_quantity: form.estimated_number_quantity ? Number(form.estimated_number_quantity) : null,
        estimated_frequency_occurrence: form.estimated_frequency_occurrence ? Number(form.estimated_frequency_occurrence) : null,
        unit_price_usd: form.unit_price_usd || null,
        cost_per_unit_rwf: form.cost_per_unit_rwf || null,
        percent_effort_share: form.percent_effort_share ? Number(form.percent_effort_share) : null,
        component_1: form.component_1 || null,
        component_2: form.component_2 || null,
        component_3: form.component_3 || null,
        component_4: form.component_4 || null,
      };
      await budgeting.createBudget(payload);
      setOk('Budget entry created.');
      // keep selections; clear quantities
      setForm(f=>({
        ...f,
        activity_description:'',
        estimated_number_quantity:'',
        estimated_frequency_occurrence:'',
        unit_price_usd:'',
        cost_per_unit_rwf:'',
        percent_effort_share:'',
        component_1:'', component_2:'', component_3:'', component_4:''
      }));
    }catch(e){ setErr(e.message || 'Failed to create budget entry.'); }
    finally{ setBusy(false); }
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={800} gutterBottom>Create Budget</Typography>
      <Paper sx={{ p:3 }}>
        <Box component="form" onSubmit={onSubmit}>
          <Grid container spacing={2.5}>
            {/* Scope: hospital vs facility */}
            <Grid item xs={12}>
              <RadioGroup row value={scope} onChange={(_,v)=>setScope(v)}>
                <FormControlLabel value="hospital" control={<Radio />} label="Hospital-based" />
                <FormControlLabel value="facility" control={<Radio />} label="Facility-based" />
              </RadioGroup>
            </Grid>

            {/* Hospital/Facility pickers */}
            {scope==='hospital' ? (
              <Grid item xs={12} md={6}>
                <TextField select fullWidth label="Hospital" required value={form.hospital_id}
                  onChange={onChange} name="hospital_id"  sx={fieldSx}
                  placeholder="Select a hospital" helperText="Budget is attached to this hospital.">
                  <MenuItem value="" disabled>— Select Hospital —</MenuItem>
                  {hospitals.map(h => <MenuItem key={h.id} value={h.id}>{h.name} ({h.code})</MenuItem>)}
                </TextField>
              </Grid>
            ) : (
              <Grid item xs={12} md={6}>
                <TextField select fullWidth label="Facility" required value={form.facility_id}
                  onChange={onChange} name="facility_id"  sx={fieldSx}
                  placeholder="Select a facility" helperText="Budget is attached to this facility.">
                  <MenuItem value="" disabled>— Select Facility —</MenuItem>
                  {facilities.map(f => <MenuItem key={f.id} value={f.id}>{f.name} ({f.code})</MenuItem>)}
                </TextField>
              </Grid>
            )}

            {/* Level */}
            <Grid item xs={12} md={6}>
              <TextField select fullWidth label="Level" name="level" value={form.level}
                onChange={onChange}  sx={fieldSx}
                placeholder="Pick the level" helperText="National/Province Referral, District Hospital or Health Centre.">
                <MenuItem value="">— Select Level —</MenuItem>
                {FacilityLevels.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
              </TextField>
            </Grid>

            {/* Budget Line + Activity */}
            <Grid item xs={12} md={6}>
              <TextField select fullWidth required label="Budget Line" name="budget_line_id" value={form.budget_line_id}
                onChange={onChange}  sx={fieldSx}
                placeholder="Select a budget line" helperText="Pick the parent budget line.">
                <MenuItem value="" disabled>— Select Budget Line —</MenuItem>
                {lines.map(bl => <MenuItem key={bl.id} value={bl.id}>{bl.code} — {bl.name}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField select fullWidth required label="Activity" name="activity_id" value={form.activity_id}
                onChange={onChange}  sx={fieldSx}
                placeholder="Select an activity" helperText="Activities are filtered by the selected budget line.">
                <MenuItem value="" disabled>— Select Activity —</MenuItem>
                {activities.map(a => <MenuItem key={a.id} value={a.id}>{a.code} — {a.name}</MenuItem>)}
              </TextField>
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <TextField fullWidth multiline minRows={2} label="Activity Description"
                name="activity_description" value={form.activity_description} onChange={onChange}
                placeholder="Describe what this activity covers…" />
            </Grid>

            {/* Estimations */}
            <Grid item xs={12} md={4}>
              <TextField fullWidth type="number" inputProps={{ step:'any' }}
                label="Estimated Number / Quantity" name="estimated_number_quantity"
                value={form.estimated_number_quantity} onChange={onChange}
                placeholder="e.g., 50" sx={fieldSx}/>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth type="number" inputProps={{ step:'any' }}
                label="Estimated Frequency / Occurrence" name="estimated_frequency_occurrence"
                value={form.estimated_frequency_occurrence} onChange={onChange}
                placeholder="e.g., 4" sx={fieldSx}/>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth type="number" inputProps={{ step:'0.01' }}
                label="Unit Price (USD)" name="unit_price_usd"
                value={form.unit_price_usd} onChange={onChange}
                placeholder="e.g., 25.00" sx={fieldSx}/>
            </Grid>

            {/* Monetary + share */}
            <Grid item xs={12} md={6}>
              <TextField fullWidth type="number" inputProps={{ step:'0.01' }}
                label="Cost per Unit (RWF)" name="cost_per_unit_rwf"
                value={form.cost_per_unit_rwf} onChange={onChange}
                placeholder="e.g., 30000.00" sx={fieldSx}/>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth type="number" inputProps={{ step:'any', min:0, max:100 }}
                label="% of Effort / Share" name="percent_effort_share"
                value={form.percent_effort_share} onChange={onChange}
                placeholder="e.g., 60" sx={fieldSx}/>
            </Grid>

            {/* Components */}
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Component 1" name="component_1" value={form.component_1}
                onChange={onChange} placeholder="e.g., Capacity Building" sx={fieldSx}/>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Component 2" name="component_2" value={form.component_2}
                onChange={onChange} placeholder="e.g., Training" sx={fieldSx}/>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Component 3" name="component_3" value={form.component_3}
                onChange={onChange} placeholder="e.g., HR" sx={fieldSx}/>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Component 4" name="component_4" value={form.component_4}
                onChange={onChange} placeholder="e.g., N/A" sx={fieldSx}/>
            </Grid>
          </Grid>

          <Divider sx={{ my:3 }}/>
          {err && <Alert severity="error" sx={{ mb:2 }}>{err}</Alert>}
          {ok && <Alert severity="success" sx={{ mb:2 }}>{ok}</Alert>}
          <Box sx={{ textAlign:'right' }}>
            <Button type="submit" variant="contained" startIcon={<MonetizationOnIcon/>} disabled={busy}>
              {busy ? 'Saving…' : 'Save Budget'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
