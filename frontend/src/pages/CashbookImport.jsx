// src/pages/CashbookImport.jsx

import React, { useState, useEffect } from "react";
import {
  Paper,
  Box,
  Button,
  Typography,
  Stack,
  Alert
} from "@mui/material";

import UploadIcon from "@mui/icons-material/Upload";
import DownloadIcon from "@mui/icons-material/Download";
import * as XLSX from "xlsx";

import { cashbook, budgeting } from "../api/client";
import { useUser } from "../hooks/useUser";

export default function CashbookImport() {

  const { hospitalId, facilityId } = useUser()

  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const [accounts,setAccounts]=useState([])
  const [lines,setLines]=useState([])
  const [activities,setActivities]=useState([])

  useEffect(()=>{
    (async()=>{
      const [acc,bl,act]=await Promise.all([
        cashbook.listAccounts?.() ?? [],
        budgeting.listBudgetLines(),
        budgeting.listActivities()
      ])

      setAccounts(acc||[])
      setLines(bl||[])
      setActivities(act||[])
    })()
  },[])

  const mapCodeToId=(code,list,key='code')=>{
    const x=list.find(e=>String(e[key]).toLowerCase()===String(code).toLowerCase())
    return x?.id ?? null
  }

  const mapNameToId=(name,list,key='name')=>{
    const x=list.find(e=>String(e[key]).toLowerCase()===String(name).toLowerCase())
    return x?.id ?? null
  }

  const handleFile=(e)=>{

    const file=e.target.files[0]
    if(!file) return

    const reader=new FileReader()

    reader.onload=(evt)=>{

      const wb=XLSX.read(evt.target.result,{type:"binary"})
      const sheet=wb.Sheets[wb.SheetNames[0]]
      const data=XLSX.utils.sheet_to_json(sheet)

      const parsed=data.map((r,i)=>({

        row:i+2,

        transaction_date:r["Transaction Date"],

        // auto assign from logged user
        hospital_id:hospitalId || null,
        facility_id:facilityId || null,

        account_id: mapNameToId(r["Account"],accounts),

        vat_requirement:r["VAT Requirement"] ?? "VAT_NOT_REQUIRED",

        description:r["Description"],

        budget_line_id: mapCodeToId(r["Budget Line"],lines),

        activity_id: mapCodeToId(r["Activity"],activities),

        cash_in:r["Cash In"] ?? null,
        cash_out:r["Cash Out"] ?? null

      }))

      setRows(parsed)
    }

    reader.readAsBinaryString(file)
  }

  const validateRows=()=>{

    for(const r of rows){

      if(!r.transaction_date)
        return `Row ${r.row}: Transaction Date required`

      if(!r.account_id)
        return `Row ${r.row}: invalid Account`

      if(!r.budget_line_id)
        return `Row ${r.row}: invalid Budget Line`

      if(!r.activity_id)
        return `Row ${r.row}: invalid Activity`

      if(r.cash_in && r.cash_out)
        return `Row ${r.row}: cannot have Cash In AND Cash Out`
    }

    return null
  }

  const upload=async()=>{

    setError("")
    setSuccess("")

    const v=validateRows()

    if(v){
      setError(v)
      return
    }

    setLoading(true)

    try{

      for(const r of rows){

        await cashbook.create({

          transaction_date:r.transaction_date,

          hospital_id:r.hospital_id,
          facility_id:r.facility_id,

          account_id:r.account_id,
          vat_requirement:r.vat_requirement,
          description:r.description,

          budget_line_id:r.budget_line_id,
          activity_id:r.activity_id,

          cash_in:r.cash_in,
          cash_out:r.cash_out

        })

      }

      setSuccess("Cashbook import completed")
      setRows([])

    }catch(e){
      setError(e.message)
    }

    setLoading(false)
  }

  const downloadTemplate=()=>{

    const template=[{

      "Transaction Date":"",
      "Account":"",
      "VAT Requirement":"VAT_NOT_REQUIRED",
      "Description":"",
      "Budget Line":"",
      "Activity":"",
      "Cash In":"",
      "Cash Out":""

    }]

    const ws=XLSX.utils.json_to_sheet(template)
    const wb=XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(wb,ws,"Cashbook")

    XLSX.writeFile(wb,"cashbook_import_template.xlsx")

  }

  return (

    <Box>

      <Typography variant="h6" fontWeight={800} gutterBottom>
        Cashbook Import
      </Typography>

      <Paper sx={{p:3}}>

        <Stack direction="row" spacing={2}>

          <Button
            variant="contained"
            component="label"
            startIcon={<UploadIcon/>}
          >
            Upload Excel
            <input
              type="file"
              hidden
              accept=".xlsx"
              onChange={handleFile}
            />
          </Button>

          <Button
            startIcon={<DownloadIcon/>}
            onClick={downloadTemplate}
          >
            Download Template
          </Button>

          <Button
            variant="contained"
            disabled={!rows.length || loading}
            onClick={upload}
          >
            Import {rows.length} rows
          </Button>

        </Stack>

        {error && <Alert severity="error" sx={{mt:2}}>{error}</Alert>}
        {success && <Alert severity="success" sx={{mt:2}}>{success}</Alert>}

        <Typography sx={{mt:2}}>
          Loaded rows: {rows.length}
        </Typography>

      </Paper>

    </Box>
  )
}