// src/pages/AdminUserCreate.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Paper, Box, Grid, TextField, Button, Typography, Divider, Alert,
  FormControl, InputLabel, Select, MenuItem
} from "@mui/material";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import { users, catalog } from "../api/client";

const AccessLevels = [
  { value: "COUNTRY", label: "Country (see all)" },
  { value: "HOSPITAL", label: "Hospital (see hospital + facilities)" },
  { value: "FACILITY", label: "Facility (see own facility only)" },
];

export default function AdminUserCreate() {
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const [countries, setCountries] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [facilities, setFacilities] = useState([]);

  const [form, setForm] = useState({
    username: "",
    password: "",
    access_level: "COUNTRY",
    country_id: "",
    hospital_id: "",
    facility_id: "",
  });

  const fieldSx = { "& .MuiInputBase-root": { height: 56, borderRadius: 1.5 } };

  const scopeHint = useMemo(() => {
    switch (form.access_level) {
      case "COUNTRY":
        return "Country-level users can see everything (all hospitals + facilities).";
      case "HOSPITAL":
        return "Hospital-level users can see the hospital and its linked facilities.";
      case "FACILITY":
        return "Facility-level users can see data only for their assigned facility.";
      default:
        return "";
    }
  }, [form.access_level]);

  async function loadCountries() {
    const data = await catalog.countries();
    setCountries(Array.isArray(data) ? data : []);
  }

  async function loadHospitals() {
    // If you want hospital list filtered by province/district, adjust here.
    const data = await catalog.hospitals({});
    setHospitals(Array.isArray(data) ? data : []);
  }

  async function loadFacilities() {
    // Optional: filter facilities by country_id or hospital if you want
    const filters = {};
    if (form.country_id) filters.country_id = form.country_id;
    if (form.hospital_id) filters.referral_hospital_id = form.hospital_id;

    const data = await catalog.facilities(filters);
    setFacilities(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        await loadCountries();
        await loadHospitals();
      } catch (e) {
        setErr(e?.message || "Failed to load catalogs");
      }
    })();
  }, []);

  useEffect(() => {
    // reload facilities when access scope selection changes
    (async () => {
      try {
        setErr("");
        await loadFacilities();
      } catch (e) {
        setErr(e?.message || "Failed to load facilities");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.country_id, form.hospital_id, form.access_level]);

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function validateBeforeSubmit() {
    const username = form.username.trim();
    const password = form.password.trim();
    if (!username) return "Username is required.";
    if (!password || password.length < 6) return "Password is required (min 6 characters).";

    if (form.access_level === "COUNTRY") {
      if (!form.country_id) return "Please select a Country for a COUNTRY-level user.";
    }
    if (form.access_level === "HOSPITAL") {
      if (!form.hospital_id) return "Please select a Hospital for a HOSPITAL-level user.";
    }
    if (form.access_level === "FACILITY") {
      if (!form.facility_id) return "Please select a Facility for a FACILITY-level user.";
    }
    return null;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setOk("");
    setErr("");

    try {
      const v = validateBeforeSubmit();
      if (v) throw new Error(v);

      // -------------------------------
      // Payload expected by backend
      // Adjust keys if needed.
      // -------------------------------
      const payload = {
        username: form.username.trim(),
        password: form.password.trim(),
        access_level: form.access_level,
        country_id: form.country_id ? Number(form.country_id) : null,
        hospital_id: form.hospital_id ? Number(form.hospital_id) : null,
        facility_id: form.facility_id ? Number(form.facility_id) : null,
      };

      // Ensure only relevant id is set (clean payload)
      if (payload.access_level === "COUNTRY") {
        payload.hospital_id = null;
        payload.facility_id = null;
      }
      if (payload.access_level === "HOSPITAL") {
        payload.country_id = null;
        payload.facility_id = null;
      }
      if (payload.access_level === "FACILITY") {
        payload.country_id = null;
        payload.hospital_id = null;
      }

      await users.create(payload);

      setOk("User created successfully.");
      setForm({
        username: "",
        password: "",
        access_level: "COUNTRY",
        country_id: "",
        hospital_id: "",
        facility_id: "",
      });
    } catch (e) {
      setErr(e?.message || "Failed to create user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={800} gutterBottom>
        Create User
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={onSubmit}>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Username"
                required
                value={form.username}
                onChange={(e) => setField("username", e.target.value)}
                sx={fieldSx}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Password"
                required
                type="password"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                helperText="Minimum 6 characters."
                sx={fieldSx}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth sx={fieldSx}>
                <InputLabel id="access-level-label">Access Level</InputLabel>
                <Select
                  labelId="access-level-label"
                  label="Access Level"
                  value={form.access_level}
                  onChange={(e) => {
                    const lvl = e.target.value;
                    setForm((f) => ({
                      ...f,
                      access_level: lvl,
                      // reset scopes when changing level
                      country_id: "",
                      hospital_id: "",
                      facility_id: "",
                    }));
                  }}
                >
                  {AccessLevels.map((x) => (
                    <MenuItem key={x.value} value={x.value}>
                      {x.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {scopeHint}
              </Typography>
            </Grid>

            {form.access_level === "COUNTRY" && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={fieldSx}>
                  <InputLabel id="country-label">Country</InputLabel>
                  <Select
                    labelId="country-label"
                    label="Country"
                    value={form.country_id}
                    onChange={(e) => setField("country_id", e.target.value)}
                  >
                    {countries.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {form.access_level === "HOSPITAL" && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={fieldSx}>
                  <InputLabel id="hospital-label">Hospital</InputLabel>
                  <Select
                    labelId="hospital-label"
                    label="Hospital"
                    value={form.hospital_id}
                    onChange={(e) => setField("hospital_id", e.target.value)}
                  >
                    {hospitals.map((h) => (
                      <MenuItem key={h.id} value={h.id}>
                        {h.name} ({h.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {form.access_level === "FACILITY" && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={fieldSx}>
                  <InputLabel id="facility-label">Facility</InputLabel>
                  <Select
                    labelId="facility-label"
                    label="Facility"
                    value={form.facility_id}
                    onChange={(e) => setField("facility_id", e.target.value)}
                  >
                    {facilities.map((f) => (
                      <MenuItem key={f.id} value={f.id}>
                        {f.name} ({f.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Tip: you can filter facilities by choosing country/hospital if you wire the filters.
                </Typography>
              </Grid>
            )}
          </Grid>

          <Divider sx={{ my: 3 }} />

          {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
          {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

          <Box sx={{ textAlign: "right" }}>

            <Button
              type="submit"
              variant="contained"
              startIcon={<PlaylistAddIcon />}
              disabled={busy}
            >
              {busy ? "Saving…" : "Create User"}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
