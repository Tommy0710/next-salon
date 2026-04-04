"use client";

import { useSession } from "next-auth/react";

type PermissionAction = 'create' | 'edit' | 'delete' | 'view';
type ViewScope = 'all' | 'own' | 'none';

export function usePermission() {
    const { data: session } = useSession();

    // Trích xuất trực tiếp quyền isAdmin từ session
    const isAdmin = session?.user?.isAdmin === true;

    // QUYỀN XEM: Cả Admin và Staff đều có quyền vào các trang để xem.
    // Việc Staff chỉ được xem QR thứ 2 hay báo cáo riêng biệt đã được xử lý lọc ở API và Component UI.
    const canView = (resource: string): boolean => {
        return true;
    };

    // PHẠM VI XEM: Admin thấy tất cả, Staff tạm quy định là 'own' (dữ liệu của riêng họ/được phân công)
    const viewScope = (resource: string): ViewScope => {
        return isAdmin ? 'all' : 'own';
    };

    // QUYỀN TẠO MỚI: Chỉ Admin mới được phép
    const canCreate = (resource: string): boolean => {
        return isAdmin;
    };

    // QUYỀN CHỈNH SỬA: Chỉ Admin mới được phép
    const canEdit = (resource: string): boolean => {
        return isAdmin;
    };

    // QUYỀN XÓA: Chỉ Admin mới được phép
    const canDelete = (resource: string): boolean => {
        return isAdmin;
    };

    // HÀM KIỂM TRA CHUNG (Dùng cho component PermissionGate)
    const hasPermission = (resource: string, action: PermissionAction): boolean => {
        if (action === 'view') return true;
        return isAdmin;
    };

    return {
        isAdmin, // Export thêm biến isAdmin để các component khác tiện gọi trực tiếp
        canView,
        viewScope,
        canCreate,
        canEdit,
        canDelete,
        hasPermission,
        user: session?.user
    };
}