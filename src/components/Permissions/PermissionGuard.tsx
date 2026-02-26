import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Permission, hasPermission } from '../../utils/permissions';

interface PermissionGuardProps {
  children: ReactNode;
  permission: Permission;
  fallback?: ReactNode;
  redirectTo?: string;
}

/**
 * Component that conditionally renders children based on user permissions
 * 
 * @example
 * <PermissionGuard permission={Permission.CREATE_ARTWORK}>
 *   <UploadButton />
 * </PermissionGuard>
 * 
 * @example
 * <PermissionGuard 
 *   permission={Permission.CREATE_ARTWORK}
 *   redirectTo="/home"
 * >
 *   <Upload />
 * </PermissionGuard>
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  fallback = null,
  redirectTo,
}) => {
  const { appUser } = useAuth();

  const userHasPermission = hasPermission(appUser?.role, permission);

  if (!userHasPermission) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
