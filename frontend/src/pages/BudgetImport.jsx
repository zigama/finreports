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

import { budgeting } from "../api/client";
import { useUser } from "../hooks/useUser";

export default function BudgetImport(){

  const { hospitalId, facilityId, accessLevel } = useUser()

  const [rows,setRows] = useState([])
  const [error,setError] = useState("")
  const [success,setSuccess] = useState("")
  const [loading,setLoading] = useState(false)

  const [lines,setLines] = useState([])
  const [activities,setActivities] = useState([])

  useEffect(()=>{

    (async()=>{

      const [bl,acts] = await Promise.all([
        budgeting.listBudgetLines(),
        budgeting.listActivities()
      ])

      setLines(bl||[])
      setActivities(acts||[])

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

        // automatically from logged user
        hospital_id: hospitalId || null,
        facility_id: facilityId || null,
        level: accessLevel || null,

        budget_line_id: mapCodeToId(r["Budget Lines"],lines),
        activity_id: mapCodeToId(r["Activity"],activities),

        activity_description:r["Activity  Description"] ?? null,

        estimated_number_quantity:r["Estimated Number/ Quantity"] ?? null,
        estimated_frequency_occurrence:r["Estimated Frequency /occurance"] ?? null,

        unit_price_usd:r["Unit Price $"] ?? null,
        cost_per_unit_rwf:r["Cost per Unit Frw"] ?? null,

        percent_effort_share:r["% of effort/ Share"] ?? null,

        component_1:r["Component 1"] ?? null,
        component_2:r["Component 2"] ?? null,
        component_3:r["Component 3"] ?? null,
        component_4:r["Component 4"] ?? null

      }))

      setRows(parsed)

    }

    reader.readAsBinaryString(file)

  }

  const validateRows=()=>{

    for(const r of rows){

      if(!r.budget_line_id)
        return `Row ${r.row}: invalid Budget Lines`

      if(!r.activity_id)
        return `Row ${r.row}: invalid Activity`
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
          level:r.level,

          budget_line_id:r.budget_line_id,
          activity_id:r.activity_id,
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

      "Budget Lines":"",
      "Activity":"",
      "Activity  Description":"",
      "Activity Level":"",
      "Estimated Number/ Quantity":"",
      "Estimated Frequency /occurance":"",
      "Unit Price $":"",
      "Cost per Unit Frw":"",
      "% of effort/ Share":"",
      "Component 1":"",
      "Component 2":"",
      "Component 3":"",
      "Component 4":""

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