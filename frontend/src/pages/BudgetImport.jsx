// src/pages/BudgetImport.jsx

import React, { useState, useEffect } from "react";
import {
  Paper,
  Box,
  Button,
  Typography,
  Stack,
  Alert,
  TextField
} from "@mui/material";

import UploadIcon from "@mui/icons-material/Upload";
import DownloadIcon from "@mui/icons-material/Download";

import * as XLSX from "xlsx";

import { budgeting } from "../api/client";
import { useUser } from "../hooks/useUser";

export default function BudgetImport() {
  const { hospitalId, facilityId } = useUser();

  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [lines, setLines] = useState([]);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [bl, acts] = await Promise.all([
          budgeting.listBudgetLines(),
          budgeting.listActivities()
        ]);

        setLines(bl || []);
        setActivities(acts || []);
      } catch (e) {
        setError(e.message || "Failed to load reference data");
      }
    })();
  }, []);

  const normalizeText = (v) =>
    String(v ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  const mapByNameOrCodeToId = (value, list) => {
    const needle = normalizeText(value);
    if (!needle) return null;

    const exactName = list.find(
      (e) => normalizeText(e?.name) === needle
    );
    if (exactName?.id) return exactName.id;

    const exactCode = list.find(
      (e) => normalizeText(e?.code) === needle
    );
    if (exactCode?.id) return exactCode.id;

    return null;
  };

  const toNullableNumber = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccess("");

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const parsed = data.map((r, i) => ({
          row: i + 2,

          hospital_id: hospitalId || null,
          facility_id: facilityId || null,

          level: (r["Activity Level"] ?? "").toString().trim() || null,

          budget_line_id: mapByNameOrCodeToId(r["Budget Lines"], lines),
          activity_id: mapByNameOrCodeToId(r["Activity"], activities),

          budget_line_name: r["Budget Lines"] ?? "",
          activity_name: r["Activity"] ?? "",

          activity_description:
            (r["Activity  Description"] ?? "").toString().trim() || null,

          estimated_number_quantity: toNullableNumber(
            r["Estimated Number/ Quantity"]
          ),
          estimated_frequency_occurrence: toNullableNumber(
            r["Estimated Frequency /occurance"]
          ),

          unit_price_usd: toNullableNumber(r["Unit Price $"]),
          cost_per_unit_rwf: toNullableNumber(r["Cost per Unit Frw"]),

          percent_effort_share: toNullableNumber(r["% of effort/ Share"]),

          component_1: toNullableNumber(r["Component 1"]),
          component_2: toNullableNumber(r["Component 2"]),
          component_3: toNullableNumber(r["Component 3"]),
          component_4: toNullableNumber(r["Component 4"])
        }));

        setRows(parsed);
      } catch (err) {
        setError(err.message || "Failed to read Excel file");
      }
    };

    reader.readAsBinaryString(file);
  };

  const validateForm = () => {
    if (!startDate) {
      return "Start Date is required";
    }

    if (!endDate) {
      return "End Date is required";
    }

    if (startDate > endDate) {
      return "Start Date cannot be after End Date";
    }

    return null;
  };

  const validateRows = () => {
    for (const r of rows) {
      if (!r.budget_line_id) {
        return `Row ${r.row}: invalid Budget Lines "${r.budget_line_name}"`;
      }

      if (!r.activity_id) {
        return `Row ${r.row}: invalid Activity "${r.activity_name}"`;
      }

      if (!r.level) {
        return `Row ${r.row}: Activity Level is required`;
      }

      if (!r.hospital_id && !r.facility_id) {
        return `Row ${r.row}: user has no hospital or facility assigned`;
      }
    }

    return null;
  };

  const upload = async () => {
    setError("");
    setSuccess("");

    const formError = validateForm();
    if (formError) {
      setError(formError);
      return;
    }

    const rowError = validateRows();
    if (rowError) {
      setError(rowError);
      return;
    }

    setLoading(true);

    try {
      for (const r of rows) {
        await budgeting.createBudget({
          hospital_id: r.hospital_id,
          facility_id: r.facility_id,
          level: r.level,

          start_date: startDate,
          end_date: endDate,

          budget_line_id: r.budget_line_id,
          activity_id: r.activity_id,
          activity_description: r.activity_description,

          estimated_number_quantity: r.estimated_number_quantity,
          estimated_frequency_occurrence: r.estimated_frequency_occurrence,

          unit_price_usd: r.unit_price_usd,
          cost_per_unit_rwf: r.cost_per_unit_rwf,
          percent_effort_share: r.percent_effort_share,

          component_1: r.component_1,
          component_2: r.component_2,
          component_3: r.component_3,
          component_4: r.component_4
        });
      }

      setSuccess("Budget import completed");
      setRows([]);
    } catch (e) {
      setError(e.message || "Budget import failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        "Budget Lines": "",
        "Activity": "",
        "Activity  Description": "",
        "Activity Level": "",
        "Estimated Number/ Quantity": "",
        "Estimated Frequency /occurance": "",
        "Unit Price $": "",
        "Cost per Unit Frw": "",
        "% of effort/ Share": "",
        "Component 1": "",
        "Component 2": "",
        "Component 3": "",
        "Component 4": ""
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Budgets");
    XLSX.writeFile(wb, "budget_import_template.xlsx");
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={800} gutterBottom>
        Budget Import
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />

            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
          </Stack>

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              component="label"
              startIcon={<UploadIcon />}
            >
              Upload Excel
              <input
                type="file"
                hidden
                accept=".xlsx,.xls"
                onChange={handleFile}
              />
            </Button>

            <Button
              startIcon={<DownloadIcon />}
              onClick={downloadTemplate}
            >
              Download Template
            </Button>

            <Button
              variant="contained"
              disabled={!rows.length || loading || !startDate || !endDate}
              onClick={upload}
            >
              Import {rows.length} rows
            </Button>
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {success}
          </Alert>
        )}

        <Typography sx={{ mt: 2 }}>
          Loaded rows: {rows.length}
        </Typography>
      </Paper>
    </Box>
  );
}