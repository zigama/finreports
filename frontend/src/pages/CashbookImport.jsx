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

import { cashbook, budgeting, catalog } from "../api/client";

export default function CashbookImport() {

  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const [hospitals,setHospitals]=useState([])
  const [facilities,setFacilities]=useState([])
  const [accounts,setAccounts]=useState([])
  const [lines,setLines]=useState([])
  const [activities,setActivities]=useState([])

  useEffect(()=>{
    (async()=>{
      const [hos,fac,acc,bl,act]=await Promise.all([
        catalog.hospitals(),
        catalog.facilities(),
        cashbook.listAccounts?.() ?? [],
        budgeting.listBudgetLines(),
        budgeting.listActivities()
      ])

      setHospitals(hos||[])
      setFacilities(fac||[])
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
        transaction_date:r.transaction_date,

        hospital_id: mapCodeToId(r.hospital_code,hospitals),
        facility_id: mapCodeToId(r.facility_code,facilities),

        account_id: mapNameToId(r.account_name,accounts),

        vat_requirement:r.vat_requirement ?? "VAT_NOT_REQUIRED",

        description:r.description,

        budget_line_id: mapCodeToId(r.budget_line_code,lines),

        activity_id: mapCodeToId(r.activity_code,activities),

        cash_in:r.cash_in ?? null,
        cash_out:r.cash_out ?? null

      }))

      setRows(parsed)
    }

    reader.readAsBinaryString(file)
  }

  const validateRows=()=>{

    for(const r of rows){

      if(!r.transaction_date)
        return `Row ${r.row}: transaction_date required`

      if(!r.account_id)
        return `Row ${r.row}: invalid account_name`

      if(!r.budget_line_id)
        return `Row ${r.row}: invalid budget_line_code`

      if(!r.activity_id)
        return `Row ${r.row}: invalid activity_code`

      if(!r.hospital_id && !r.facility_id)
        return `Row ${r.row}: hospital_code or facility_code required`

      if(r.cash_in && r.cash_out)
        return `Row ${r.row}: cannot have cash_in AND cash_out`
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

      setSuccess("Import completed")

      setRows([])

    }catch(e){
      setError(e.message)
    }

    setLoading(false)
  }

  const downloadTemplate=()=>{

    const template=[{

      transaction_date:"",
      hospital_code:"",
      facility_code:"",
      account_name:"",
      vat_requirement:"VAT_NOT_REQUIRED",
      description:"",
      budget_line_code:"",
      activity_code:"",
      cash_in:"",
      cash_out:""

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