import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { featureUnavailableMessage, hasFeature, type FeatureKey } from '@/lib/features'
import { useAuthStore } from '@/features/auth/store'

export function FeatureRoute({ feature }: { feature: FeatureKey }) {
  const location = useLocation()
  const navigate = useNavigate()
  useAuthStore((state) => state.user)
  if (hasFeature(feature)) return <Outlet />
  const root = feature.startsWith('working_papers') ? '/working-papers' : feature === 'accounting_reports' ? '/accounting/reports' : '/audit'
  if (location.pathname === root) return <div className="qf-feature-unavailable"><Card className="qf-feature-unavailable__card text-center"><i className="bi bi-shield-lock fs-1 text-muted" aria-hidden="true" /><h1 className="h4 mt-3">Feature Not Available</h1><p className="text-muted mb-4">{featureUnavailableMessage(feature)} กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดใช้งาน</p><Button onClick={() => navigate('/dashboard', { replace: true })}>กลับหน้าแดชบอร์ด</Button></Card></div>
  return <Navigate to={root} replace state={{ from: location }} />
}
