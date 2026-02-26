import { useAuth } from '../context/AuthContext';
import { Permission, hasPermission, canAccessRoute } from '../utils/permissions';

/**
 * Hook to check user permissions
 * 
 * @example
 * const { hasPermission, canAccess } = usePermission();
 * 
 * if (hasPermission(Permission.CREATE_ARTWORK)) {
 *   // Show upload button
 * }
 * 
 * if (canAccess('/upload')) {
 *   // Show upload link
 * }
 */
export function usePermission() {
  const { appUser } = useAuth();

  return {
    hasPermission: (permission: Permission) => hasPermission(appUser?.role, permission),
    canAccess: (route: string) => canAccessRoute(appUser?.role, route),
    role: appUser?.role,
  };
}
