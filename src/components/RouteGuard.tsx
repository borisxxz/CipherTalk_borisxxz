import { Navigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'

interface RouteGuardProps {
  children: React.ReactNode
}

// 不需要数据库连接的页面
const PUBLIC_ROUTES = ['/', '/settings', '/data-management', '/agent']

function RouteGuard({ children }: RouteGuardProps) {
  const location = useLocation()
  const isDbConnected = useAppStore(state => state.isDbConnected)

  const isPublicRoute = PUBLIC_ROUTES.includes(location.pathname)

  if (!isDbConnected && !isPublicRoute) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default RouteGuard
