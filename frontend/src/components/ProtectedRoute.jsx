import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getToken } from '../api/client'

export default function ProtectedRoute({ children }){
  const token = getToken()
  const location = useLocation()
  if (!token){
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}
