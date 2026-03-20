import { useSession } from "next-auth/react";

type PermissionAction = 'create' | 'edit' | 'delete' | 'view';
type ViewScope = 'all' | 'own' | 'none';

export function usePermission() {
    const { data: session } = useSession();
    const permissions = session?.user?.permissions;

    const canView = (resource: string): boolean => {
        if (!permissions) return false;

        const permission = permissions[resource];
        if (!permission) return false;

        // Handle boolean view permissions (e.g., dashboard, settings)
        if (typeof permission.view === 'boolean') {
            return permission.view;
        }

        // Handle string scope permissions (e.g., sales, products)
        const scope = permission.view as ViewScope;
        return scope === 'all' || scope === 'own';
    };

    const viewScope = (resource: string): ViewScope => {
        if (!permissions) return 'none';
        return permissions[resource]?.view || 'none';
    };

    const canCreate = (resource: string): boolean => {
        if (!permissions) return false;
        return !!permissions[resource]?.create;
    };

    const canEdit = (resource: string): boolean => {
        if (!permissions) return false;
        return !!permissions[resource]?.edit;
    };

    const canDelete = (resource: string): boolean => {
        if (!permissions) return false;
        return !!permissions[resource]?.delete;
    };

    // Generic check
    const hasPermission = (resource: string, action: PermissionAction): boolean => {
        if (!permissions) return false;
        if (action === 'view') return canView(resource);
        return !!permissions[resource]?.[action];
    };

    return {
        canView,
        viewScope,
        canCreate,
        canEdit,
        canDelete,
        hasPermission,
        user: session?.user
    };
}
