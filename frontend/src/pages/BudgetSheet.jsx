import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Paper, Box, Button, Stack, TextField, MenuItem, Typography, Divider, Alert
} from '@mui/material';
import {
  DataGrid,
  GridActionsCellItem,
  GridRowModes,
  useGridApiRef,
} from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';

import { budgeting, catalog, FacilityLevels } from '../api/client.js';

/* ---------- helpers ---------- */
const numOrNull = (v) => (v === '' || v === null || v === undefined) ? null : Number(v);

/** For math in UI: accept string with commas; blanks -> 0 (only for arithmetic) */
const toNum = (v) => {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** Parse numeric from text for POST/PUT */
const parseNumeric = (v) => {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : '';
};

/** Safe numeric renderer for VIEW MODE (handles number | string | Decimal-like) */
const renderNumberCell = (p) => {
  const raw = p?.row?.[p.field];
  if (raw === null || raw === undefined || raw === '') return '';
  // Accept number, string, objects with toString()
  const s = typeof raw === 'number' ? String(raw) : String(raw);
  const n = Number(s.replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return s; // fall back to raw if not a clean number
  return n.toLocaleString(); // e.g., "12,345"
};

/** Safe money renderer for VIEW MODE */
const renderMoneyCell = (p) => {
  const raw = p?.row?.[p.field];
  if (raw === null || raw === undefined || raw === '') return '';
  const s = typeof raw === 'number' ? String(raw) : String(raw);
  const n = Number(s.replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString();
};

/** Total Cost = sum of components (for math blanks -> 0) */
// 1) Null-safe component sum that only adds real numbers
const compSum = (row) => {
  if (!row) return 0; // <- guard against undefined/null rows
  const vals = [row.component_1, row.component_2, row.component_3, row.component_4];
  return vals.reduce((sum, v) => {
    if (v === '' || v == null) return sum;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);
};

const safeGetRow = (params) =>
  params?.row ?? (params?.api?.getRow ? params.api.getRow(params.id) : null);

/** Build id->label maps for instant lookups in renderCell. */
const useIdLabelMaps = (hospitals, facilities, lines, activities) => {
  const hospitalMap = useMemo(() => {
    const m = new Map();
    hospitals.forEach(h => m.set(String(h.id), `${h.name} (${h.code})`));
    return m;
  }, [hospitals]);

  const facilityMap = useMemo(() => {
    const m = new Map();
    facilities.forEach(f => m.set(String(f.id), `${f.name} (${f.code})`));
    return m;
  }, [facilities]);

  const blMap = useMemo(() => {
    const m = new Map();
    lines.forEach(l => m.set(String(l.id), `${l.code} — ${l.name}`));
    return m;
  }, [lines]);

  const activityMap = useMemo(() => {
    const m = new Map();
    activities.forEach(a => m.set(String(a.id), `${a.code} — ${a.name}`));
    return m;
  }, [activities]);

  return { hospitalMap, facilityMap, blMap, activityMap };
};

export default function BudgetSheet(){
  const apiRef = useGridApiRef();

  // data
  const [rows, setRows] = useState([]);
  const [rowCount, setRowCount] = useState(0);

  // server state
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState([{ field: 'id', sort: 'desc' }]);
  const [filterText, setFilterText] = useState('');

  // editing
  const [rowModesModel, setRowModesModel] = useState({});
  const [selection, setSelection] = useState([]);

  // ui
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  // refs (catalogs)
  const [lines, setLines] = useState([]);
  const [activities, setActivities] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [facilities, setFacilities] = useState([]);

  // global totals
  const [globalTotals, setGlobalTotals] = useState({ count: 0, sum_components: 0 });

  // options for edit mode selects
  const hospitalOptions = useMemo(
    () => hospitals.map(h => ({ value: String(h.id), label: `${h.name} (${h.code})` })), [hospitals]
  );
  const facilityOptions = useMemo(
    () => facilities.map(f => ({ value: String(f.id), label: `${f.name} (${f.code})` })), [facilities]
  );
  const blOptions = useMemo(
    () => lines.map(l => ({ value: String(l.id), label: `${l.code} — ${l.name}` })), [lines]
  );

  // fast maps for view mode
  const { hospitalMap, facilityMap, blMap, activityMap } =
    useIdLabelMaps(hospitals, facilities, lines, activities);

  // load catalogs
  useEffect(() => {
    (async()=>{
      try{
        const [bl, acts, hos, fac] = await Promise.all([
          budgeting.listBudgetLines(),
          budgeting.listActivities(),
          catalog.hospitals(),
          catalog.facilities(),
        ]);
        setLines(bl || []); setActivities(acts || []); setHospitals(hos || []); setFacilities(fac || []);
      }catch(e){ setErr(e.message || 'Failed to load reference lists'); }
    })();
  }, []);

  // server load
  const serverLoad = useCallback(async ()=>{
    setLoading(true); setErr(''); setOk('');
    try{
      const sortBy = sortModel[0]?.field;
      const sortDir = sortModel[0]?.sort;

      const res = await budgeting.listBudgetsPaged({
        page: paginationModel.page,
        pageSize: paginationModel.pageSize,
        sortBy,
        sortDir,
        filters: { q: filterText }
      });

      const items = Array.isArray(res?.items) ? res.items : [];
      const total = Number(res?.total || items.length || 0);

      setRowCount(total);
      // Keep server values AS-IS (numbers/strings/nulls)
      setRows(items.map(x => ({
        ...x,
        hospital_id: x.hospital_id ?? null,
        facility_id: x.facility_id ?? null,
        budget_line_id: x.budget_line_id ?? null,
        activity_id: x.activity_id ?? null,

        activity_description: x.activity_description ?? null,
        level: x.level ?? null,

        estimated_number_quantity: x.estimated_number_quantity ?? null,
        estimated_frequency_occurrence: x.estimated_frequency_occurrence ?? null,
        unit_price_usd: x.unit_price_usd ?? null,
        cost_per_unit_rwf: x.cost_per_unit_rwf ?? null,
        percent_effort_share: x.percent_effort_share ?? null,

        component_1: x.component_1 ?? null,
        component_2: x.component_2 ?? null,
        component_3: x.component_3 ?? null,
        component_4: x.component_4 ?? null,
      })));

      const agg = await budgeting.aggregateBudgets({ q: filterText });
      setGlobalTotals({
        count: Number(agg?.count || 0),
        sum_components: Number(agg?.sum_components || 0),
      });
    }catch(e){
      setErr(e.message || 'Failed to load budgets');
    }finally{
      setLoading(false);
    }
  }, [paginationModel, sortModel, filterText]);

  useEffect(()=>{ serverLoad(); }, [serverLoad]);

  // add row
  const addRow = () => {
    const id = `tmp-${Math.random().toString(36).slice(2)}`;
    setRows(prev => [{
      id,
      hospital_id: null, facility_id: null,
      budget_line_id: null, activity_id: null,
      activity_description: null,
      level: null,
      estimated_number_quantity: null,
      estimated_frequency_occurrence: null,
      unit_price_usd: null,
      cost_per_unit_rwf: null,
      percent_effort_share: null,
      component_1: null, component_2: null, component_3: null, component_4: null
    }, ...prev]);

    setRowModesModel(m => ({ ...m, [id]: { mode: GridRowModes.Edit, fieldToFocus: 'budget_line_id' } }));
    setTimeout(() => { try { apiRef.current?.setCellFocus(id, 'budget_line_id'); } catch {} }, 0);
  };

  // batch delete
  const deleteSelected = async ()=>{
    if (!selection.length) return;
    setLoading(true); setErr(''); setOk('');
    try{
      const serverIds = selection.filter(id => !String(id).startsWith('tmp-'));
      await Promise.all(serverIds.map(id => budgeting.deleteBudget(id)));
      setRows(prev => prev.filter(r => !selection.includes(r.id)));
      setSelection([]);
      setOk('Deleted.');
      serverLoad();
    }catch(e){ setErr(e.message || 'Delete failed'); }
    finally{ setLoading(false); }
  };

  // save helper
  const saveRow = async (row) => {
    const budget_line_id = Number(row.budget_line_id);
    const activity_id = Number(row.activity_id);
    if (!budget_line_id || Number.isNaN(budget_line_id)) throw new Error('Budget Line is required');
    if (!activity_id || Number.isNaN(activity_id)) throw new Error('Activity is required');

    const payload = {
      hospital_id: row.hospital_id ? Number(row.hospital_id) : null,
      facility_id: row.facility_id ? Number(row.facility_id) : null,
      budget_line_id,
      activity_id,
      activity_description: (row.activity_description ?? '').toString().trim() || null,
      level: (row.level ?? '').toString().trim() || null,

      estimated_number_quantity: numOrNull(parseNumeric(row.estimated_number_quantity)),
      estimated_frequency_occurrence: numOrNull(parseNumeric(row.estimated_frequency_occurrence)),
      unit_price_usd: row.unit_price_usd === '' || row.unit_price_usd === null ? null : Number(parseNumeric(row.unit_price_usd)),
      cost_per_unit_rwf: row.cost_per_unit_rwf === '' || row.cost_per_unit_rwf === null ? null : Number(parseNumeric(row.cost_per_unit_rwf)),
      percent_effort_share: numOrNull(parseNumeric(row.percent_effort_share)),

      component_1: row.component_1 === '' || row.component_1 === null ? null : Number(parseNumeric(row.component_1)),
      component_2: row.component_2 === '' || row.component_2 === null ? null : Number(parseNumeric(row.component_2)),
      component_3: row.component_3 === '' || row.component_3 === null ? null : Number(parseNumeric(row.component_3)),
      component_4: row.component_4 === '' || row.component_4 === null ? null : Number(parseNumeric(row.component_4)),
    };

    if (!payload.hospital_id && !payload.facility_id) {
      throw new Error('Either Hospital or Facility is required');
    }

    let saved;
    if (String(row.id).startsWith('tmp-')) {
      saved = await budgeting.createBudget(payload);
    } else {
      saved = await budgeting.updateBudget(row.id, payload);
    }

    return {
      ...saved,
      hospital_id: saved.hospital_id ?? null,
      facility_id: saved.facility_id ?? null,
      budget_line_id: saved.budget_line_id ?? null,
      activity_id: saved.activity_id ?? null,
      activity_description: saved.activity_description ?? null,
      level: saved.level ?? null,

      estimated_number_quantity: saved.estimated_number_quantity ?? null,
      estimated_frequency_occurrence: saved.estimated_frequency_occurrence ?? null,
      unit_price_usd: saved.unit_price_usd ?? null,
      cost_per_unit_rwf: saved.cost_per_unit_rwf ?? null,
      percent_effort_share: saved.percent_effort_share ?? null,

      component_1: saved.component_1 ?? null,
      component_2: saved.component_2 ?? null,
      component_3: saved.component_3 ?? null,
      component_4: saved.component_4 ?? null,
    };
  };

  /* ---------- actions ---------- */
  const handleEditClick = (id) => () => {
    setRowModesModel(m => ({ ...m, [id]: { mode: GridRowModes.Edit } }));
    setTimeout(() => apiRef.current?.setCellFocus(id, 'budget_line_id'), 0);
  };

  const handleSaveClick = (id) => () => {
    try { apiRef.current.stopRowEditMode({ id }); }
    catch (e) { setOk(''); setErr(e?.message || 'Save failed'); }
  };

  const handleCancelClick = (id) => () => {
    apiRef.current.stopRowEditMode({ id, ignoreModifications: true });
    if (String(id).startsWith('tmp-')) setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleDeleteClick = (id) => async () => {
    try{
      if (!String(id).startsWith('tmp-')) await budgeting.deleteBudget(id);
      setRows(prev => prev.filter(r => r.id !== id));
      setOk('Deleted.');
      serverLoad();
    }catch(e){ setErr(e.message || 'Delete failed'); }
  };

  const processRowUpdate = async (newRow, oldRow) => {
    try{
      if (newRow.budget_line_id !== oldRow.budget_line_id) newRow.activity_id = newRow.activity_id || null;
      const saved = await saveRow(newRow);
      setOk('Saved.');
      setRows(prev => {
        const list = [...prev];
        const idx = list.findIndex(r => r.id === newRow.id);
        if (idx !== -1) list[idx] = { ...saved }; else list.unshift({ ...saved });
        return list;
      });
      if (String(newRow.id).startsWith('tmp-') && saved.id !== newRow.id) {
        setRowModesModel(m => {
          const { [newRow.id]: _tmp, ...rest } = m;
          return { ...rest, [saved.id]: { mode: GridRowModes.View } };
        });
      }
      return saved;
    }catch(e){
      setOk('');
      setErr(e?.message || 'Save failed');
      throw e;
    }
  };

  const handleRowEditStop = (params, event) => {
    if (params.reason === 'rowFocusOut') event.defaultMuiPrevented = true;
  };

  const totals = useMemo(()=>{
    const sum = rows.reduce((acc, r) => acc + compSum(r), 0);
    return { components: sum };
  }, [rows]);

  // columns
  const columns = useMemo(()=>[
    {
      field: 'hospital_id',
      headerName: 'Hospital',
      width: 240,
      editable: true,
      renderEditCell: (params) =>
        <SelectEditCell params={params} options={[{ value: '', label: '— None —' }, ...hospitalOptions]} />,
      renderCell: (p) => {
        const v = p.value;
        if (v === null || v === undefined || v === '') return '';
        return hospitalMap.get(String(v)) ?? String(v);
      },
    },
    {
      field: 'facility_id',
      headerName: 'Facility',
      width: 240,
      editable: true,
      renderEditCell: (params) =>
        <SelectEditCell params={params} options={[{ value: '', label: '— None —' }, ...facilityOptions]} />,
      renderCell: (p) => {
        const v = p.value;
        if (v === null || v === undefined || v === '') return '';
        return facilityMap.get(String(v)) ?? String(v);
      },
    },
    {
      field: 'level',
      headerName: 'Level',
      width: 200,
      editable: true,
      renderEditCell: (p) =>
        <SelectEditCell
          params={p}
          options={[{ value: '', label: '— Select —' }, ...FacilityLevels.map(l => ({ value: l, label: l }))]}
        />,
      renderCell: (p) => (p.value === null || p.value === undefined ? '' : String(p.value)),
    },
    {
      field: 'budget_line_id',
      headerName: 'Budget Line',
      width: 260,
      editable: true,
      renderEditCell: (params) =>
        <SelectEditCell params={params} options={[{ value: '', label: '— Select —' }, ...blOptions]} />,
      renderCell: (p) => {
        const v = p.value;
        if (v === null || v === undefined || v === '') return '';
        return blMap.get(String(v)) ?? String(v);
      },
    },
    {
      field: 'activity_id',
      headerName: 'Activity',
      width: 280,
      editable: true,
      renderEditCell: (params) => {
        const blId = String(params?.row?.budget_line_id || '');
        const acts = activities.filter(a => String(a.budget_line_id) === blId);
        const opts = [{ value: '', label: '— Select —' }, ...acts.map(a => ({ value: String(a.id), label: `${a.code} — ${a.name}` }))];
        return <SelectEditCell params={params} options={opts} />;
      },
      renderCell: (p) => {
        const v = p.value;
        if (v === null || v === undefined || v === '') return '';
        return activityMap.get(String(v)) ?? String(v);
      },
    },
    {
      field: 'activity_description',
      headerName: 'Description',
      width: 320,
      editable: true,
      renderCell: (p) => (p.value === null || p.value === undefined ? '' : String(p.value)),
    },

    // ---- NUMERIC / MONEY FIELDS: renderCell for robust display ----
    { field: 'estimated_number_quantity', headerName: 'Qty', width: 110, editable: true, type:'number',
      renderCell: renderNumberCell,
      renderEditCell: (p) => <NumberEditCell params={p} />,
      align: 'right',
      headerAlign: 'right',
    },
    { field: 'estimated_frequency_occurrence', headerName: 'Freq', width: 110, editable: true, type:'number',
      renderCell: renderNumberCell,
      renderEditCell: (p) => <NumberEditCell params={p} />,
      align: 'right',
      headerAlign: 'right',
    },

    { field: 'unit_price_usd', headerName: 'Unit USD', width: 130, editable: true, type:'number',
      renderCell: renderMoneyCell,
      renderEditCell: (p) => <NumberEditCell params={p} />,
      align: 'right',
      headerAlign: 'right',
    },
    { field: 'cost_per_unit_rwf', headerName: 'Unit RWF', width: 140, editable: true, type:'number',
      renderCell: renderMoneyCell,
      renderEditCell: (p) => <NumberEditCell params={p} />,
      align: 'right',
      headerAlign: 'right',
    },

    { field: 'percent_effort_share', headerName: '% Share', width: 120, editable: true, type:'number',
      renderCell: renderNumberCell,
      renderEditCell: (p) => <NumberEditCell params={p} />,
      align: 'right',
      headerAlign: 'right',
    },

    { field: 'component_1', headerName: 'Component 1', width: 160, editable: true, type:'number',
      renderCell: renderMoneyCell,
      renderEditCell: (p) => <NumberEditCell params={p} />,
      align: 'right',
      headerAlign: 'right',
    },
    { field: 'component_2', headerName: 'Component 2', width: 160, editable: true, type:'number',
      renderCell: renderMoneyCell,
      renderEditCell: (p) => <NumberEditCell params={p} />,
      align: 'right',
      headerAlign: 'right',
    },
    { field: 'component_3', headerName: 'Component 3', width: 160, editable: true, type:'number',
      renderCell: renderMoneyCell,
      renderEditCell: (p) => <NumberEditCell params={p} />,
      align: 'right',
      headerAlign: 'right',
    },
    { field: 'component_4', headerName: 'Component 4', width: 160, editable: true, type:'number',
      renderCell: renderMoneyCell,
      renderEditCell: (p) => <NumberEditCell params={p} />,
      align: 'right',
      headerAlign: 'right',
    },

    // Total cost (computed on the fly)
    {
      field: 'total_components',
      headerName: 'Total Cost',
      width: 180,
      sortable: false,
      valueGetter: (params) => compSum(safeGetRow(params)),
      renderCell: (p) => {
        const n = compSum(safeGetRow(p));
        return n === 0 ? '' : n.toLocaleString();
      },
      align: 'right',
      headerAlign: 'right',
    },

    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 120,
      getActions: ({ id }) => {
        const isEdit = rowModesModel[id]?.mode === GridRowModes.Edit;
        return isEdit
          ? [
              <GridActionsCellItem
                icon={<SaveIcon/>}
                label="Save"
                onClick={handleSaveClick(id)}
              />,
              <GridActionsCellItem
                icon={<CloseIcon/>}
                label="Cancel"
                onClick={handleCancelClick(id)}
                color="inherit"
              />
            ]
          : [
              <GridActionsCellItem
                icon={<EditIcon/>}
                label="Edit"
                onClick={handleEditClick(id)}
                color="inherit"
              />,
              <GridActionsCellItem
                icon={<DeleteIcon/>}
                label="Delete"
                onClick={handleDeleteClick(id)}
                color="error"
              />
            ];
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [hospitalOptions, facilityOptions, blOptions, activities, rowModesModel, hospitalMap, facilityMap, blMap, activityMap]);

  // toolbar
  const Toolbar = (
    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
      <Button onClick={addRow} variant="contained" startIcon={<AddIcon/>}>Add Row</Button>
      <Button onClick={deleteSelected} startIcon={<DeleteIcon/>} disabled={!selection.length}>Delete</Button>
      <Button onClick={serverLoad} startIcon={<RefreshIcon/>}>Refresh</Button>
      <Box sx={{ flex: 1 }} />
      <TextField
        placeholder="Quick filter…"
        size="small"
        value={filterText}
        onChange={(e)=>setFilterText(e.target.value)}
        onKeyDown={(e)=>{ if (e.key === 'Enter') serverLoad(); }}
      />
    </Stack>
  );

  return (
    <Box>
      <Typography variant="h6" fontWeight={800} gutterBottom>Budgets (Inline)</Typography>
      <Paper sx={{ p:2.5 }}>
        {Toolbar}
        {err && <Alert severity="error" sx={{ mb: 1.5 }}>{err}</Alert>}
        {ok && <Alert severity="success" sx={{ mb: 1.5 }}>{ok}</Alert>}

        <div style={{ height: 620, width: '100%' }}>
          <DataGrid
            apiRef={apiRef}
            getRowId={(r) => r.id}
            rows={rows}
            columns={columns}
            loading={loading}
            rowCount={rowCount}
            paginationMode="server"
            sortingMode="server"
            filterMode="server"
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            editMode="row"
            rowModesModel={rowModesModel}
            onRowModesModelChange={setRowModesModel}
            processRowUpdate={processRowUpdate}
            onProcessRowUpdateError={(error) => {
              setOk('');
              setErr(error?.message || 'Save failed. Please check required fields.');
            }}
            onRowEditStop={(params, event) => {
              if (params.reason === 'rowFocusOut') event.defaultMuiPrevented = true;
            }}
            checkboxSelection
            disableRowSelectionOnClick
            onRowSelectionModelChange={setSelection}
            pageSizeOptions={[10, 25, 50, 100]}
            sx={{
              '& .MuiDataGrid-cell': { alignItems: 'center' },
              '& .MuiDataGrid-columnHeaders': { fontWeight: 700 }
            }}
          />
        </div>

        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={3} justifyContent="flex-end">
          <Typography variant="subtitle2">
            Page Total (Components): <b>{toNum(totals.components).toLocaleString()}</b>
          </Typography>
          <Typography variant="subtitle2">
            Global Total (Components): <b>{toNum(globalTotals.sum_components).toLocaleString()}</b>
          </Typography>
          <Typography variant="subtitle2">
            Matching Rows: <b>{globalTotals.count}</b>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}

/** Select editor that COMMITS the cell immediately by also stopping cell edit mode for that field. */
function SelectEditCell({ params, options }) {
  const id = params?.id;
  const field = params?.field;
  const api = params?.api;
  const row = params?.row;
  const value = params?.value ?? '';

  if (!api || !id || !field) return null;

  const handleChange = async (e) => {
    const v = e.target.value;

    if (field === 'budget_line_id' && String(row?.activity_id || '') !== '') {
      await api.setEditCellValue({ id, field: 'activity_id', value: '' });
    }

    await api.setEditCellValue({ id, field, value: v });
    api.stopCellEditMode({ id, field });
  };

  return (
    <TextField
      select
      fullWidth
      size="small"
      value={value}
      onChange={handleChange}
    >
      {options.map(opt => (
        <MenuItem key={String(opt.value)} value={opt.value}>{opt.label}</MenuItem>
      ))}
    </TextField>
  );
}

/** Numeric editor that accepts "12,345"; commits on Enter/blur. */
function NumberEditCell({ params }) {
  const id = params?.id;
  const field = params?.field;
  const api = params?.api;
  const value = params?.value ?? '';

  if (!api || !id || !field) return null;

  const handleChange = async (e) => {
    const raw = e.target.value;
    await api.setEditCellValue({ id, field, value: raw }, e);
  };

  const handleBlur = () => {
    api.stopCellEditMode({ id, field });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') api.stopCellEditMode({ id, field });
    if (e.key === 'Escape') api.stopCellEditMode({ id, field, ignoreModifications: true });
  };

  return (
    <TextField
      fullWidth
      size="small"
      inputMode="decimal"
      value={value ?? ''}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder=""
    />
  );
}
