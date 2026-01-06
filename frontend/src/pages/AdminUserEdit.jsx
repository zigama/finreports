// src/pages/AdminUserEdit.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Paper, Box, Grid, TextField, Button, Typography, Divider, Alert,
  FormControl, InputLabel, Select, MenuItem
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { useNavigate, useParams } from "react-router-dom";
import { users, catalog } from "../api/client";

const AccessLevels = [
  { value: "COUNTRY", label: "Country (see all)" },
  { value: "HOSPITAL", label: "Hospital (see hospital + facilities)" },
  { value: "FACILITY", label: "Facility (see own facility only)" },
];

export default function AdminUserEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const [countries, setCountries] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [facilities, setFacilities] = useState([]);

  const [form, setForm] = useState({
    username: "",
    password: "", // optional reset
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

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function loadCatalogs() {
    const [cs, hs] = await Promise.all([
      catalog.countries(),
      catalog.hospitals({}),
    ]);
    setCountries(Array.isArray(cs) ? cs : []);
    setHospitals(Array.isArray(hs) ? hs : []);
  }

  async function loadFacilitiesForForm(nextForm) {
    const filters = {};
    if (nextForm.country_id) filters.country_id = nextForm.country_id;
    if (nextForm.hospital_id) filters.referral_hospital_id = nextForm.hospital_id;

    const data = await catalog.facilities(filters);
    setFacilities(Array.isArray(data) ? data : []);
  }

  async function loadUser() {
    const u = await users.get(id);

    // u should contain: username, access_level, country_id/hospital_id/facility_id
    const next = {
      username: u.username || "",
      password: "",
      access_level: u.access_level || "COUNTRY",
      country_id: u.country_id ?? "",
      hospital_id: u.hospital_id ?? "",
      facility_id: u.facility_id ?? "",
    };

    setForm(next);
    await loadFacilitiesForForm(next);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        await loadCatalogs();
        await loadUser();
      } catch (e) {
        setErr(e?.message || "Failed to load user.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    // reload facilities if scope choices change
    (async () => {
      try {
        await loadFacilitiesForForm(form);
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.country_id, form.hospital_id, form.access_level]);

  function validateBeforeSubmit() {
    const username = form.username.trim();
    if (!username) return "Username is required.";

    if (form.password && form.password.trim().length > 0 && form.password.trim().length < 6) {
      return "If provided, password must be at least 6 characters.";
    }

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
        access_level: form.access_level,
        country_id: form.country_id ? Number(form.country_id) : null,
        hospital_id: form.hospital_id ? Number(form.hospital_id) : null,
        facility_id: form.facility_id ? Number(form.facility_id) : null,
      };

      // optional password reset only if filled
      if (form.password && form.password.trim()) {
        payload.password = form.password.trim();
      }

      // Ensure only relevant id is set
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

      await users.update(id, payload);

      setOk("User updated successfully.");
      setForm((f) => ({ ...f, password: "" })); // clear reset password box
    } catch (e) {
      setErr(e?.message || "Failed to update user.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Box>
        <Typography variant="h6" fontWeight={800} gutterBottom>
          Edit User
        </Typography>
        <Alert severity="info">Loading…</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={800} gutterBottom>
        Edit User #{id}
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
                label="Reset Password (optional)"
                type="password"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                helperText="Leave empty to keep current password. Min 6 chars if provided."
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
              </Grid>
            )}
          </Grid>

          <Divider sx={{ my: 3 }} />

          {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
          {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Button variant="outlined" onClick={() => navigate(-1)}>
              Back
            </Button>

            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={busy}
            >
              {busy ? "Saving…" : "Save Changes"}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
