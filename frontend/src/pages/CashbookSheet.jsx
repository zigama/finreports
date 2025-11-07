// src/pages/CashbookSheet.jsx
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

import { cashbook, budgeting, catalog, FacilityLevels } from '../api/client.js';

/* ---------- helpers ---------- */
const numOrNull = (v) =>
  v === '' || v === null || v === undefined ? null : Number(v);

/** Accept string with commas; blanks -> 0 when doing arithmetic */
const toNum = (v) => {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** Parse numeric from text for POST/PUT ('' when invalid/blank so it can be omitted) */
const parseNumeric = (v) => {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : '';
};

/** Safe numeric renderer for VIEW MODE (handles number | string | Decimal-like) */
const renderNumberCell = (p) => {
  const raw = p?.row?.[p.field];
  if (raw === null || raw === undefined || raw === '') return '';
  const s = typeof raw === 'number' ? String(raw) : String(raw);
  const n = Number(s.replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString();
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

const safeGetRow = (params) =>
  params?.row ?? (params?.api?.getRow ? params.api.getRow(params.id) : null);

/** Build id->label maps for instant lookups in renderCell. */
const useIdLabelMaps = (hospitals, facilities, lines, activities, accounts) => {
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

  const blMap = useMemo(() => {
    const m = new Map();
    lines.forEach((l) =>
      m.set(String(l.id), `${l.code} — ${l.name}`)
    );
    return m;
  }, [lines]);

  const activityMap = useMemo(() => {
    const m = new Map();
    activities.forEach((a) =>
      m.set(String(a.id), `${a.code} — ${a.name}`)
    );
    return m;
  }, [activities]);

  const accountMap = useMemo(() => {
    const m = new Map();
    accounts.forEach((a) => m.set(String(a.id), `${a.name}`));
    return m;
  }, [accounts]);

  return { hospitalMap, facilityMap, blMap, activityMap, accountMap };
};

const VAT_OPTIONS = [
  { value: 'VAT_REQUIRED', label: 'VAT required' },
  { value: 'VAT_NOT_REQUIRED', label: 'VAT not required' },
];

export default function CashbookSheet() {
  const apiRef = useGridApiRef();

  // data
  const [rows, setRows] = useState([]);
  const [rowCount, setRowCount] = useState(0);

  // server state
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 25,
  });
  const [sortModel, setSortModel] = useState([
    { field: 'transaction_date', sort: 'desc' },
  ]);
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
  const [accounts, setAccounts] = useState([]);

  // page totals (Cash In, Cash Out, Balance)
  const [pageTotals, setPageTotals] = useState({ in: 0, out: 0, bal: 0 });

  // recompute totals helper (used after any rows change)
  const recomputePageTotals = useCallback((rowsList) => {
    const tIn = rowsList.reduce((s, r) => s + toNum(r.cash_in), 0);
    const tOut = rowsList.reduce((s, r) => s + toNum(r.cash_out), 0);
    const tBal = tIn - tOut; // ✅ Balance = total in - total out
    setPageTotals({ in: tIn, out: tOut, bal: tBal });
  }, []);


  // options for edit mode selects
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
  const blOptions = useMemo(
    () =>
      lines.map((l) => ({
        value: String(l.id),
        label: `${l.code} — ${l.name}`,
      })),
    [lines]
  );
  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: String(a.id),
        label: a.name,
      })),
    [accounts]
  );

  // fast maps for view mode
  const { hospitalMap, facilityMap, blMap, activityMap, accountMap } =
    useIdLabelMaps(hospitals, facilities, lines, activities, accounts);

  // load catalogs
  useEffect(() => {
    (async () => {
      try {
        const [bl, acts, hos, fac, accts] = await Promise.all([
          budgeting.listBudgetLines(),
          budgeting.listActivities(),
          catalog.hospitals(),
          catalog.facilities(),
          cashbook.listAccounts?.() ?? cashbook.accounts?.() ?? [],
        ]);
        setLines(bl || []);
        setActivities(acts || []);
        setHospitals(hos || []);
        setFacilities(fac || []);
        setAccounts(accts || []);
      } catch (e) {
        setErr(e.message || 'Failed to load reference lists');
      }
    })();
  }, []);

  // server load
  const serverLoad = useCallback(async () => {
    setLoading(true);
    setErr('');
    setOk('');
    try {
      const sortBy = sortModel[0]?.field;
      const sortDir = sortModel[0]?.sort;

      const res = await cashbook.listCashbooks({
        page: paginationModel.page,
        pageSize: paginationModel.pageSize,
        sortBy,
        sortDir,
        filters: { q: filterText },
      });

      const items = Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res)
        ? res
        : [];
      const total = Number(res?.total ?? items.length ?? 0);

      const normalized = items.map(coerceServerRow);

      setRowCount(total);
      setRows(normalized);
      recomputePageTotals(normalized);
    } catch (e) {
      setErr(e.message || 'Failed to load cashbooks');
    } finally {
      setLoading(false);
    }
  }, [
    paginationModel,
    sortModel,
    filterText,
    recomputePageTotals,
  ]);

  useEffect(() => {
    serverLoad();
  }, [serverLoad]);

  // add row
  const addRow = () => {
    const id = `tmp-${Math.random().toString(36).slice(2)}`;
    const today = new Date().toISOString().slice(0, 10);

    setRows((prev) => {
      const next = [
        {
          id,
          transaction_date: today,
          quarter: '',
          hospital_id: null,
          facility_id: null,
          account_id: null,
          reference: '',
          vat_requirement: 'VAT_NOT_REQUIRED',
          description: '',
          budget_line_id: null,
          activity_id: null,
          cash_in: null,
          cash_out: null,
          balance: null,
        },
        ...prev,
      ];
      recomputePageTotals(next);
      return next;
    });

    setRowModesModel((m) => ({
      ...m,
      [id]: {
        mode: GridRowModes.Edit,
        fieldToFocus: 'transaction_date',
      },
    }));

    setTimeout(() => {
      try {
        apiRef.current?.setCellFocus(id, 'transaction_date');
      } catch {
        /* ignore */
      }
    }, 0);
  };

  // batch delete
  const deleteSelected = async () => {
    if (!selection.length) return;
    setLoading(true);
    setErr('');
    setOk('');
    try {
      const serverIds = selection.filter(
        (id) => !String(id).startsWith('tmp-')
      );
      await Promise.all(serverIds.map((id) => cashbook.remove(id)));

      setRows((prev) => {
        const next = prev.filter((r) => !selection.includes(r.id));
        recomputePageTotals(next);
        return next;
      });

      setSelection([]);
      setOk('Deleted.');
    } catch (e) {
      setErr(e.message || 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  // save helper
  const saveRow = async (row) => {
    // XOR guard for better UX
    const hasIn =
      row.cash_in !== null &&
      row.cash_in !== '' &&
      !Number.isNaN(Number(parseNumeric(row.cash_in)));
    const hasOut =
      row.cash_out !== null &&
      row.cash_out !== '' &&
      !Number.isNaN(Number(parseNumeric(row.cash_out)));
    if (hasIn && hasOut) {
      throw new Error('Provide exactly one of Cash In or Cash Out (not both).');
    }

    if (!row.account_id) throw new Error('Account is required.');
    if (!row.budget_line_id) throw new Error('Budget Line is required.');
    if (!row.activity_id) throw new Error('Activity is required.');
    if (!row.hospital_id && !row.facility_id) {
      throw new Error('Either Hospital or Facility is required.');
    }

    const payload = {
      transaction_date: row.transaction_date,
      hospital_id: row.hospital_id
        ? Number(row.hospital_id)
        : null,
      facility_id: row.facility_id
        ? Number(row.facility_id)
        : null,
      account_id: Number(row.account_id),
      vat_requirement:
        row.vat_requirement || 'VAT_NOT_REQUIRED',
      description:
        (row.description ?? '').toString().trim() || null,
      budget_line_id: Number(row.budget_line_id),
      activity_id: Number(row.activity_id),
      cash_in:
        row.cash_in === '' || row.cash_in === null
          ? null
          : Number(parseNumeric(row.cash_in)),
      cash_out:
        row.cash_out === '' || row.cash_out === null
          ? null
          : Number(parseNumeric(row.cash_out)),
      // no balance; backend computes it
    };

    let saved;
    if (String(row.id).startsWith('tmp-')) {
      saved = await cashbook.create(payload);
    } else {
      saved = await cashbook.update(row.id, payload);
    }

    // merge local + server so we preserve edited values
    const merged = coerceServerRow({
      ...row,
      ...(saved || {}),
    });

    return merged;
  };

  /* ---------- actions ---------- */
  const handleEditClick = (id) => () => {
    setRowModesModel((m) => ({
      ...m,
      [id]: { mode: GridRowModes.Edit },
    }));
    setTimeout(
      () =>
        apiRef.current?.setCellFocus(id, 'transaction_date'),
      0
    );
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
      setRows((prev) => {
        const next = prev.filter((r) => r.id !== id);
        recomputePageTotals(next);
        return next;
      });
    }
  };

  const handleDeleteClick = (id) => async () => {
    try {
      if (!String(id).startsWith('tmp-')) {
        await cashbook.remove(id);
      }
      setRows((prev) => {
        const next = prev.filter((r) => r.id !== id);
        recomputePageTotals(next);
        return next;
      });
      setOk('Deleted.');
    } catch (e) {
      setErr(e.message || 'Delete failed');
    }
  };

  const processRowUpdate = async (newRow, oldRow) => {
    try {
      if (
        newRow.budget_line_id !== oldRow.budget_line_id
      ) {
        newRow.activity_id =
          newRow.activity_id || null;
      }
      const saved = await saveRow(newRow);
      setOk('Saved.');

      setRows((prev) => {
        const list = [...prev];
        const idx = list.findIndex(
          (r) => r.id === newRow.id
        );
        if (idx !== -1) list[idx] = { ...saved };
        else list.unshift({ ...saved });
        recomputePageTotals(list);
        return list;
      });

      if (
        String(newRow.id).startsWith('tmp-') &&
        saved.id !== newRow.id
      ) {
        setRowModesModel((m) => {
          const { [newRow.id]: _tmp, ...rest } = m;
          return {
            ...rest,
            [saved.id]: { mode: GridRowModes.View },
          };
        });
      }

      return saved;
    } catch (e) {
      setOk('');
      setErr(e?.message || 'Save failed');
      throw e;
    }
  };

  const handleRowEditStop = (params, event) => {
    if (params.reason === 'rowFocusOut') {
      event.defaultMuiPrevented = true;
    }
  };

  // columns
  const columns = useMemo(
    () => [
      {
        field: 'transaction_date',
        headerName: 'Transaction Date',
        width: 150,
        editable: true,
        renderEditCell: (p) => (
          <DateEditCell params={p} />
        ),
        renderCell: (p) =>
          p.value ? String(p.value) : '',
      },
      {
        field: 'quarter',
        headerName: 'Quarter',
        width: 110,
        editable: false,
      },
      {
        field: 'hospital_id',
        headerName: 'Hospital',
        width: 240,
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
          if (
            v === null ||
            v === undefined ||
            v === ''
          )
            return '';
          return (
            hospitalMap.get(String(v)) ?? String(v)
          );
        },
      },
      {
        field: 'facility_id',
        headerName: 'Facility',
        width: 240,
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
          if (
            v === null ||
            v === undefined ||
            v === ''
          )
            return '';
          return (
            facilityMap.get(String(v)) ?? String(v)
          );
        },
      },
      {
        field: 'account_id',
        headerName: 'Account',
        width: 220,
        editable: true,
        renderEditCell: (params) => (
          <SelectEditCell
            params={params}
            options={[
              { value: '', label: '— Select —' },
              ...accountOptions,
            ]}
          />
        ),
        renderCell: (p) => {
          const v = p.value;
          if (
            v === null ||
            v === undefined ||
            v === ''
          )
            return '';
          return (
            accountMap.get(String(v)) ?? String(v)
          );
        },
      },
      {
        field: 'reference',
        headerName: 'Reference',
        width: 180,
        editable: false,
      },
      {
        field: 'vat_requirement',
        headerName: 'VAT',
        width: 160,
        editable: true,
        renderEditCell: (params) => (
          <SelectEditCell
            params={params}
            options={VAT_OPTIONS}
          />
        ),
        renderCell: (p) => {
          const opt = VAT_OPTIONS.find(
            (o) => o.value === p.value
          );
          return opt ? opt.label : '';
        },
      },
      {
        field: 'description',
        headerName:
          'Transaction Description',
        width: 320,
        editable: true,
        renderCell: (p) =>
          p.value === null ||
          p.value === undefined
            ? ''
            : String(p.value),
      },
      {
        field: 'budget_line_id',
        headerName: 'Budget Line',
        width: 260,
        editable: true,
        renderEditCell: (params) => (
          <SelectEditCell
            params={params}
            options={[
              { value: '', label: '— Select —' },
              ...blOptions,
            ]}
          />
        ),
        renderCell: (p) => {
          const v = p.value;
          if (
            v === null ||
            v === undefined ||
            v === ''
          )
            return '';
          return (
            blMap.get(String(v)) ?? String(v)
          );
        },
      },
      {
        field: 'activity_id',
        headerName:
          'Specific Activity',
        width: 280,
        editable: true,
        renderEditCell: (params) => {
          const blId = String(
            params?.row?.budget_line_id ||
              ''
          );
          const acts = activities.filter(
            (a) =>
              String(a.budget_line_id) === blId
          );
          const opts = [
            {
              value: '',
              label: '— Select —',
            },
            ...acts.map((a) => ({
              value: String(a.id),
              label: `${a.code} — ${a.name}`,
            })),
          ];
          return (
            <SelectEditCell
              params={params}
              options={opts}
            />
          );
        },
        renderCell: (p) => {
          const v = p.value;
          if (
            v === null ||
            v === undefined ||
            v === ''
          )
            return '';
          return (
            activityMap.get(String(v)) ??
            String(v)
          );
        },
      },
      // MONEY FIELDS
      {
        field: 'cash_in',
        headerName: 'Cash In',
        width: 140,
        editable: true,
        type: 'number',
        renderCell: renderMoneyCell,
        renderEditCell: (p) => (
          <NumberEditCell params={p} />
        ),
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'cash_out',
        headerName: 'Cash Out',
        width: 140,
        editable: true,
        type: 'number',
        renderCell: renderMoneyCell,
        renderEditCell: (p) => (
          <NumberEditCell params={p} />
        ),
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'balance',
        headerName: 'Balance',
        width: 160,
        editable: false,
        renderCell: renderMoneyCell,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        width: 120,
        getActions: ({ id }) => {
          const isEdit =
            rowModesModel[id]?.mode ===
            GridRowModes.Edit;
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
                  onClick={handleCancelClick(
                    id
                  )}
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
                  onClick={handleDeleteClick(
                    id
                  )}
                  color="error"
                />,
              ];
        },
      },
    ],
    [
      hospitalOptions,
      facilityOptions,
      blOptions,
      accountOptions,
      activities,
      rowModesModel,
      hospitalMap,
      facilityMap,
      blMap,
      activityMap,
      accountMap,
    ]
  );

  // toolbar
  const Toolbar = (
    <Stack
      direction="row"
      spacing={1}
      sx={{ mb: 1 }}
    >
      <Button
        onClick={addRow}
        variant="contained"
        startIcon={<AddIcon />}
      >
        Add Row
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
        onChange={(e) =>
          setFilterText(e.target.value)
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter') serverLoad();
        }}
      />
    </Stack>
  );

  return (
    <Box>
      <Typography
        variant="h6"
        fontWeight={800}
        gutterBottom
      >
        Cashbook (Inline)
      </Typography>
      <Paper sx={{ p: 2.5 }}>
        {Toolbar}
        {err && (
          <Alert
            severity="error"
            sx={{ mb: 1.5 }}
          >
            {err}
          </Alert>
        )}
        {ok && (
          <Alert
            severity="success"
            sx={{ mb: 1.5 }}
          >
            {ok}
          </Alert>
        )}

        <div
          style={{
            height: 620,
            width: '100%',
          }}
        >
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
            paginationModel={
              paginationModel
            }
            onPaginationModelChange={
              setPaginationModel
            }
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            editMode="row"
            rowModesModel={rowModesModel}
            onRowModesModelChange={
              setRowModesModel
            }
            processRowUpdate={
              processRowUpdate
            }
            onProcessRowUpdateError={(
              error
            ) => {
              setOk('');
              setErr(
                error?.message ||
                  'Save failed. Please check required fields.'
              );
            }}
            onRowEditStop={
              handleRowEditStop
            }
            checkboxSelection
            disableRowSelectionOnClick
            onRowSelectionModelChange={
              setSelection
            }
            pageSizeOptions={[
              10,
              25,
              50,
              100,
            ]}
            sx={{
              '& .MuiDataGrid-cell': {
                alignItems:
                  'center',
              },
              '& .MuiDataGrid-columnHeaders':
                {
                  fontWeight: 700,
                },
            }}
          />
        </div>

        <Divider sx={{ my: 2 }} />
        <Stack
          direction="row"
          spacing={3}
          justifyContent="flex-end"
        >
          <Typography variant="subtitle2">
            Page Cash In:{' '}
            <b>
              {toNum(
                pageTotals.in
              ).toLocaleString()}
            </b>
          </Typography>
          <Typography variant="subtitle2">
            Page Cash Out:{' '}
            <b>
              {toNum(
                pageTotals.out
              ).toLocaleString()}
            </b>
          </Typography>
          <Typography variant="subtitle2">
            Page Balance:{' '}
            <b>
              {toNum(
                pageTotals.bal
              ).toLocaleString()}
            </b>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}

/** Normalize server row -> UI row (keep nulls when absent) */
function coerceServerRow(x = {}) {
  return {
    id: x.id,
    transaction_date:
      x.transaction_date ?? '',
    quarter: x.quarter ?? '',
    hospital_id:
      x.hospital_id ?? null,
    facility_id:
      x.facility_id ?? null,
    account_id:
      x.account_id ?? null,
    reference: x.reference ?? '',
    vat_requirement:
      x.vat_requirement ??
      'VAT_NOT_REQUIRED',
    description: x.description ?? '',
    budget_line_id:
      x.budget_line_id ?? null,
    activity_id:
      x.activity_id ?? null,
    cash_in: x.cash_in ?? null,
    cash_out: x.cash_out ?? null,
    balance: x.balance ?? null,
    created_at:
      x.created_at ?? null,
    updated_at:
      x.updated_at ?? null,
  };
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

    if (
      field === 'budget_line_id' &&
      String(row?.activity_id || '') !== ''
    ) {
      await api.setEditCellValue({
        id,
        field: 'activity_id',
        value: '',
      });
    }

    await api.setEditCellValue({
      id,
      field,
      value: v,
    });
    api.stopCellEditMode({
      id,
      field,
    });
  };

  return (
    <TextField
      select
      fullWidth
      size="small"
      value={value}
      onChange={handleChange}
    >
      {options.map((opt) => (
        <MenuItem
          key={String(opt.value)}
          value={opt.value}
        >
          {opt.label}
        </MenuItem>
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
    await api.setEditCellValue(
      { id, field, value: raw },
      e
    );
  };

  const handleBlur = () => {
    api.stopCellEditMode({
      id,
      field,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter')
      api.stopCellEditMode({
        id,
        field,
      });
    if (e.key === 'Escape')
      api.stopCellEditMode({
        id,
        field,
        ignoreModifications: true,
      });
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

/** Date editor (yyyy-mm-dd), commits on Enter/blur. */
function DateEditCell({ params }) {
  const id = params?.id;
  const field = params?.field;
  const api = params?.api;
  const value = params?.value ?? '';

  if (!api || !id || !field) return null;

  const handleChange = async (e) => {
    const raw = e.target.value; // yyyy-mm-dd
    await api.setEditCellValue(
      { id, field, value: raw },
      e
    );
  };

  const handleBlur = () => {
    api.stopCellEditMode({
      id,
      field,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter')
      api.stopCellEditMode({
        id,
        field,
      });
    if (e.key === 'Escape')
      api.stopCellEditMode({
        id,
        field,
        ignoreModifications: true,
      });
  };

  return (
    <TextField
      fullWidth
      size="small"
      type="date"
      value={value ?? ''}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder=""
    />
  );
}
