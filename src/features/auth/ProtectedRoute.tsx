import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store'
import { useEffect } from 'react'
import { Spinner } from 'react-bootstrap'

export function ProtectedRoute() {
  const location = useLocation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading = useAuthStore((s) => s.isLoading)
  const user = useAuthStore((s) => s.user)
  const loadMe = useAuthStore((s) => s.loadMe)

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  // If we have a token but haven't hydrated the user profile yet, do it once.
  useEffect(() => {
    if (!isAuthenticated) return
    if (user) return
    if (isLoading) return
    void loadMe()
  }, [isAuthenticated, isLoading, loadMe, user])

  if (!user) {
    return (
      <div className="d-flex align-items-center justify-content-center py-5">
        <Spinner animation="border" role="status" />
        <span className="ms-3 small text-muted">กำลังเตรียมข้อมูลผู้ใช้...</span>
      </div>
    )
  }

  return <Outlet />
}


