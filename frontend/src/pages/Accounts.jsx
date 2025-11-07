// src/pages/Accounts.jsx
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

import { cashbook, catalog } from '../api/client.js';

const ACCOUNT_TYPES = [
  { value: 'BANK', label: 'Bank' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'CASH', label: 'Cash' },
];

/* ---------- helpers ---------- */

// Money renderer (view mode)
const renderMoneyCell = (p) => {
  const raw = p?.row?.[p.field];
  if (raw === null || raw === undefined || raw === '') return '';
  const s = typeof raw === 'number' ? String(raw) : String(raw);
  const n = Number(s.replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString();
};

// Normalize backend → frontend row shape
function coerceServerRow(x = {}) {
  return {
    // ID: handle several possible keys
    id: x.id ?? x.account_id ?? x.accountId,

    // Text fields: accept common variants so they always show in view mode
    name: x.name ?? x.account_name ?? x.accountName ?? '',
    type: x.type ?? x.account_type ?? x.accountType ?? 'BANK',

    bank_name: x.bank_name ?? x.bank ?? x.bankName ?? '',
    account_number:
      x.account_number ??
      x.account_no ??
      x.accountNo ??
      x.number ??
      '',
    mobile_provider:
      x.mobile_provider ??
      x.mobileProvider ??
      x.provider ??
      '',

    hospital_id: x.hospital_id ?? x.hospitalId ?? null,
    facility_id: x.facility_id ?? x.facilityId ?? null,

    current_balance:
      x.current_balance ??
      x.balance ??
      x.available_balance ??
      0,
  };
}

/** Select editor: immediate commit + stop cell edit (BudgetSheet-like) */
function SelectEditCell({ params, options }) {
  const id = params?.id;
  const field = params?.field;
  const api = params?.api;
  const value = params?.value ?? '';

  if (!api || id == null || !field) return null;

  const handleChange = async (e) => {
    const v = e.target.value;
    await api.setEditCellValue({ id, field, value: v });
    api.stopCellEditMode({ id, field });
  };

  return (
    <TextField select fullWidth size="small" value={value} onChange={handleChange}>
      {options.map((opt) => (
        <MenuItem key={String(opt.value)} value={opt.value}>
          {opt.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

/* ---------- main ---------- */

export default function Accounts() {
  const apiRef = useGridApiRef();

  // data
  const [rows, setRows] = useState([]);
  const [rowCount, setRowCount] = useState(0);

  // server state
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState([{ field: 'name', sort: 'asc' }]);
  const [filterText, setFilterText] = useState('');

  // editing
  const [rowModesModel, setRowModesModel] = useState({});
  const [selection, setSelection] = useState([]);

  // ui
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  // refs
  const [hospitals, setHospitals] = useState([]);
  const [facilities, setFacilities] = useState([]);

  // load reference data
  useEffect(() => {
    (async () => {
      try {
        const [hos, fac] = await Promise.all([
          catalog.hospitals(),
          catalog.facilities(),
        ]);
        setHospitals(hos || []);
        setFacilities(fac || []);
      } catch (e) {
        setErr(e.message || 'Failed to load reference lists');
      }
    })();
  }, []);

  const hospitalOptions = useMemo(
    () =>
      hospitals.map((h) => ({
        value: String(h.id),
        label: `${h.name} (${h.code})`,
      })),
    [hospitals]
  );

  const facilityOptions = useMemo(
    () =>
      facilities.map((f) => ({
        value: String(f.id),
        label: `${f.name} (${f.code})`,
      })),
    [facilities]
  );

  const hospitalMap = useMemo(() => {
    const m = new Map();
    hospitals.forEach((h) =>
      m.set(String(h.id), `${h.name} (${h.code})`)
    );
    return m;
  }, [hospitals]);

  const facilityMap = useMemo(() => {
    const m = new Map();
    facilities.forEach((f) =>
      m.set(String(f.id), `${f.name} (${f.code})`)
    );
    return m;
  }, [facilities]);

  /* ---------- load rows (normalize first, then filter/sort/paginate) ---------- */

  const serverLoad = useCallback(async () => {
    setLoading(true);
    setErr('');
    setOk('');

    try {
      const res = (await cashbook.listAccounts?.()) ?? [];
      const items = Array.isArray(res) ? res : [];

      const normalized = items.map(coerceServerRow);

      const filtered = filterText
        ? normalized.filter((a) =>
            (a.name || '')
              .toString()
              .toLowerCase()
              .includes(filterText.toLowerCase())
          )
        : normalized;

      const [sortBy, sortDir] = [sortModel[0]?.field, sortModel[0]?.sort];
      const sorted = sortBy
        ? [...filtered].sort((a, b) => {
            const av = (a?.[sortBy] ?? '') + '';
            const bv = (b?.[sortBy] ?? '') + '';
            return sortDir === 'desc'
              ? bv.localeCompare(av)
              : av.localeCompare(bv);
          })
        : filtered;

      const start = paginationModel.page * paginationModel.pageSize;
      const paged = sorted.slice(start, start + paginationModel.pageSize);

      setRowCount(sorted.length);
      setRows(paged);
    } catch (e) {
      setErr(e.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [paginationModel, sortModel, filterText]);

  useEffect(() => {
    serverLoad();
  }, [serverLoad]);

  /* ---------- CRUD helpers ---------- */

  const addRow = () => {
    const id = `tmp-${Math.random().toString(36).slice(2)}`;
    setRows((prev) => [
      {
        id,
        name: '',
        type: 'BANK',
        bank_name: '',
        account_number: '',
        mobile_provider: '',
        hospital_id: null,
        facility_id: null,
        current_balance: 0,
      },
      ...prev,
    ]);

    setRowModesModel((m) => ({
      ...m,
      [id]: { mode: GridRowModes.Edit, fieldToFocus: 'name' },
    }));

    setTimeout(() => {
      try {
        apiRef.current?.setCellFocus(id, 'name');
      } catch {
        /* ignore */
      }
    }, 0);
  };

  const deleteSelected = async () => {
    if (!selection.length) return;
    setLoading(true);
    setErr('');
    setOk('');
    try {
      const serverIds = selection.filter(
        (id) => !String(id).startsWith('tmp-')
      );
      await Promise.all(
        serverIds.map((id) => cashbook.deleteAccount?.(id))
      );
      setRows((prev) => prev.filter((r) => !selection.includes(r.id)));
      setSelection([]);
      setOk('Deleted.');
      serverLoad();
    } catch (e) {
      setErr(e.message || 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  // ✅ UPDATED: merge local row + server response before normalize
  const saveRow = async (row) => {
    if (!row.name?.trim()) throw new Error('Account name is required.');
    if (!row.type) throw new Error('Account type is required.');

    // Adjust to your backend’s expected payload keys if needed
    const payload = {
      name: row.name.trim(),
      type: row.type,
      bank_name: (row.bank_name ?? '').trim() || null,
      account_number: (row.account_number ?? '').trim() || null,
      mobile_provider: (row.mobile_provider ?? '').trim() || null,
      hospital_id: row.hospital_id ? Number(row.hospital_id) : null,
      facility_id: row.facility_id ? Number(row.facility_id) : null,
    };

    let saved = null;
    if (String(row.id).startsWith('tmp-') || row.id == null) {
      saved = await cashbook.createAccount?.(payload);
    } else {
      saved = await cashbook.updateAccount?.(row.id, payload);
    }

    // Merge so we don't lose edited fields if backend returns partial object
    const merged = {
      ...row,
      ...(saved || {}),
    };

    return coerceServerRow(merged);
  };

  const handleEditClick = (id) => () => {
    setRowModesModel((m) => ({
      ...m,
      [id]: { mode: GridRowModes.Edit },
    }));
    setTimeout(() => apiRef.current?.setCellFocus(id, 'name'), 0);
  };

  const handleSaveClick = (id) => () => {
    try {
      apiRef.current.stopRowEditMode({ id });
    } catch (e) {
      setOk('');
      setErr(e?.message || 'Save failed');
    }
  };

  const handleCancelClick = (id) => () => {
    apiRef.current.stopRowEditMode({
      id,
      ignoreModifications: true,
    });
    if (String(id).startsWith('tmp-')) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const handleDeleteClick = (id) => async () => {
    try {
      if (!String(id).startsWith('tmp-')) {
        await cashbook.deleteAccount?.(id);
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      setOk('Deleted.');
      serverLoad();
    } catch (e) {
      setErr(e.message || 'Delete failed');
    }
  };

  const handleRowEditStop = (params, event) => {
    // prevent auto-commit on blur (same pattern as BudgetSheet)
    if (params.reason === 'rowFocusOut') {
      event.defaultMuiPrevented = true;
    }
  };

  const processRowUpdate = async (newRow) => {
    try {
      const saved = await saveRow(newRow);

      setOk('Saved.');
      setRows((prev) => {
        const list = [...prev];
        const idx = list.findIndex((r) => r.id === newRow.id);
        if (idx !== -1) list[idx] = { ...saved };
        else list.unshift({ ...saved });
        return list;
      });

      // remap tmp-id to real id
      if (String(newRow.id).startsWith('tmp-') && saved.id && saved.id !== newRow.id) {
        setRowModesModel((m) => {
          const { [newRow.id]: _tmp, ...rest } = m;
          return { ...rest, [saved.id]: { mode: GridRowModes.View } };
        });
      }

      return saved;
    } catch (e) {
      setOk('');
      setErr(e?.message || 'Save failed');
      throw e;
    }
  };

  /* ---------- columns: ensure view mode reads normalized row ---------- */

  const columns = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Account Name',
        width: 240,
        editable: true,
        renderCell: (p) => p.row.name || '',
      },
      {
        field: 'type',
        headerName: 'Type',
        width: 160,
        editable: true,
        renderEditCell: (p) => (
          <SelectEditCell
            params={p}
            options={[
              { value: '', label: '— Select —' },
              ...ACCOUNT_TYPES,
            ]}
          />
        ),
        renderCell: (p) =>
          ACCOUNT_TYPES.find((o) => o.value === p.value)?.label || '',
      },
      {
        field: 'bank_name',
        headerName: 'Bank',
        width: 200,
        editable: true,
        renderCell: (p) => p.row.bank_name || '',
      },
      {
        field: 'account_number',
        headerName: 'Account #',
        width: 180,
        editable: true,
        renderCell: (p) => p.row.account_number || '',
      },
      {
        field: 'mobile_provider',
        headerName: 'Mobile Provider',
        width: 180,
        editable: true,
        renderCell: (p) => p.row.mobile_provider || '',
      },
      {
        field: 'hospital_id',
        headerName: 'Hospital',
        width: 230,
        editable: true,
        renderEditCell: (params) => (
          <SelectEditCell
            params={params}
            options={[
              { value: '', label: '— None —' },
              ...hospitalOptions,
            ]}
          />
        ),
        renderCell: (p) => {
          const v = p.value;
          if (v === null || v === undefined || v === '') return '';
          return hospitalMap.get(String(v)) ?? String(v);
        },
      },
      {
        field: 'facility_id',
        headerName: 'Facility',
        width: 230,
        editable: true,
        renderEditCell: (params) => (
          <SelectEditCell
            params={params}
            options={[
              { value: '', label: '— None —' },
              ...facilityOptions,
            ]}
          />
        ),
        renderCell: (p) => {
          const v = p.value;
          if (v === null || v === undefined || v === '') return '';
          return facilityMap.get(String(v)) ?? String(v);
        },
      },
      {
        field: 'current_balance',
        headerName: 'Current Balance',
        width: 170,
        editable: false,
        align: 'right',
        headerAlign: 'right',
        renderCell: renderMoneyCell,
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
                  key="save"
                  icon={<SaveIcon />}
                  label="Save"
                  onClick={handleSaveClick(id)}
                />,
                <GridActionsCellItem
                  key="cancel"
                  icon={<CloseIcon />}
                  label="Cancel"
                  onClick={handleCancelClick(id)}
                  color="inherit"
                />,
              ]
            : [
                <GridActionsCellItem
                  key="edit"
                  icon={<EditIcon />}
                  label="Edit"
                  onClick={handleEditClick(id)}
                  color="inherit"
                />,
                <GridActionsCellItem
                  key="delete"
                  icon={<DeleteIcon />}
                  label="Delete"
                  onClick={handleDeleteClick(id)}
                  color="error"
                />,
              ];
        },
      },
    ],
    [
      hospitalOptions,
      facilityOptions,
      hospitalMap,
      facilityMap,
      rowModesModel,
    ]
  );

  /* ---------- toolbar & render ---------- */

  const Toolbar = (
    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
      <Button
        onClick={addRow}
        variant="contained"
        startIcon={<AddIcon />}
      >
        Add Account
      </Button>
      <Button
        onClick={deleteSelected}
        startIcon={<DeleteIcon />}
        disabled={!selection.length}
      >
        Delete
      </Button>
      <Button
        onClick={serverLoad}
        startIcon={<RefreshIcon />}
      >
        Refresh
      </Button>
      <Box sx={{ flex: 1 }} />
      <TextField
        placeholder="Quick filter…"
        size="small"
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') serverLoad();
        }}
      />
    </Stack>
  );

  return (
    <Box>
      <Typography variant="h6" fontWeight={800} gutterBottom>
        Accounts (Inline)
      </Typography>
      <Paper sx={{ p: 2.5 }}>
        {Toolbar}

        {err && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {err}
          </Alert>
        )}
        {ok && (
          <Alert severity="success" sx={{ mb: 1.5 }}>
            {ok}
          </Alert>
        )}

        <div style={{ height: 620, width: '100%' }}>
          <DataGrid
            apiRef={apiRef}
            rows={rows}
            getRowId={(r) => r.id}
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
              setErr(
                error?.message ||
                  'Save failed. Please check required fields.'
              );
            }}
            onRowEditStop={handleRowEditStop}
            checkboxSelection
            disableRowSelectionOnClick
            onRowSelectionModelChange={setSelection}
            pageSizeOptions={[10, 25, 50, 100]}
            sx={{
              '& .MuiDataGrid-cell': {
                display: 'flex',
                alignItems: 'center',
              },
              '& .MuiDataGrid-columnHeaders': {
                fontWeight: 700,
              },
            }}
          />
        </div>

        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={3} justifyContent="flex-end">
          <Typography variant="subtitle2">
            Showing: <b>{rowCount}</b> account(s)
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
