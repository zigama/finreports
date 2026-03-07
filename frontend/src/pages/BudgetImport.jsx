// src/pages/BudgetImport.jsx

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

import { budgeting, catalog } from "../api/client";

export default function BudgetImport(){

  const [rows,setRows] = useState([])
  const [error,setError] = useState("")
  const [success,setSuccess] = useState("")
  const [loading,setLoading] = useState(false)

  const [lines,setLines] = useState([])
  const [activities,setActivities] = useState([])
  const [hospitals,setHospitals] = useState([])
  const [facilities,setFacilities] = useState([])

  useEffect(()=>{

    (async()=>{

      const [bl,acts,hos,fac] = await Promise.all([
        budgeting.listBudgetLines(),
        budgeting.listActivities(),
        catalog.hospitals(),
        catalog.facilities()
      ])

      setLines(bl||[])
      setActivities(acts||[])
      setHospitals(hos||[])
      setFacilities(fac||[])

    })()

  },[])

  const mapCodeToId=(code,list,key='code')=>{
    const x=list.find(e=>String(e[key]).toLowerCase()===String(code).toLowerCase())
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

        hospital_id: mapCodeToId(r.hospital_code,hospitals),
        facility_id: mapCodeToId(r.facility_code,facilities),

        level:r.level ?? null,

        budget_line_id: mapCodeToId(r.budget_line_code,lines),
        activity_id: mapCodeToId(r.activity_code,activities),

        activity_description:r.activity_description ?? null,

        estimated_number_quantity:r.estimated_number_quantity ?? null,
        estimated_frequency_occurrence:r.estimated_frequency_occurrence ?? null,

        unit_price_usd:r.unit_price_usd ?? null,
        cost_per_unit_rwf:r.cost_per_unit_rwf ?? null,

        percent_effort_share:r.percent_effort_share ?? null,

        component_1:r.component_1 ?? null,
        component_2:r.component_2 ?? null,
        component_3:r.component_3 ?? null,
        component_4:r.component_4 ?? null

      }))

      setRows(parsed)

    }

    reader.readAsBinaryString(file)

  }

  const validateRows=()=>{

    for(const r of rows){

      if(!r.budget_line_id)
        return `Row ${r.row}: invalid budget_line_code`

      if(!r.activity_id)
        return `Row ${r.row}: invalid activity_code`

      if(!r.hospital_id && !r.facility_id)
        return `Row ${r.row}: hospital_code or facility_code required`
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

        await budgeting.createBudget({

          hospital_id:r.hospital_id,
          facility_id:r.facility_id,
          budget_line_id:r.budget_line_id,
          activity_id:r.activity_id,
          level:r.level,
          activity_description:r.activity_description,

          estimated_number_quantity:r.estimated_number_quantity,
          estimated_frequency_occurrence:r.estimated_frequency_occurrence,

          unit_price_usd:r.unit_price_usd,
          cost_per_unit_rwf:r.cost_per_unit_rwf,
          percent_effort_share:r.percent_effort_share,

          component_1:r.component_1,
          component_2:r.component_2,
          component_3:r.component_3,
          component_4:r.component_4

        })

      }

      setSuccess("Budget import completed")

      setRows([])

    }
    catch(e){
      setError(e.message)
    }

    setLoading(false)

  }

  const downloadTemplate=()=>{

    const template=[{

      hospital_code:"",
      facility_code:"",
      level:"",

      budget_line_code:"",
      activity_code:"",

      activity_description:"",

      estimated_number_quantity:"",
      estimated_frequency_occurrence:"",

      unit_price_usd:"",
      cost_per_unit_rwf:"",

      percent_effort_share:"",

      component_1:"",
      component_2:"",
      component_3:"",
      component_4:""

    }]

    const ws=XLSX.utils.json_to_sheet(template)
    const wb=XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(wb,ws,"Budgets")

    XLSX.writeFile(wb,"budget_import_template.xlsx")

  }

  return (

    <Box>

      <Typography variant="h6" fontWeight={800} gutterBottom>
        Budget Import
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