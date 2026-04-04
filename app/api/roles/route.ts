import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Role } from '@/lib/initModels';
import { checkPermission } from '@/lib/rbac';

// GET /api/roles - List all roles
export async function GET(request: NextRequest) {
    try {
        await connectDB();

        // LƯU Ý: Bạn cần đảm bảo hàm checkPermission trong file rbac.ts 
        // đã được sửa lại để chỉ check xem user có phải là Admin hay không.
        const permissionError = await checkPermission(request, 'roles', 'view');
        if (permissionError) return permissionError;

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const search = searchParams.get("search") || "";

        const query: any = {};

        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        const skip = (page - 1) * limit;

        const [roles, total] = await Promise.all([
            Role.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Role.countDocuments(query)
        ]);

        return NextResponse.json({
            success: true,
            data: roles,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST /api/roles - Create new role
export async function POST(request: NextRequest) {
    try {
        await connectDB();

        // Kiểm tra quyền (Chỉ Admin mới được tạo Role)
        const permissionError = await checkPermission(request, 'roles', 'create');
        if (permissionError) return permissionError;

        const body = await request.json();

        if (!body.name) {
            return NextResponse.json(
                { success: false, error: "Role name is required" },
                { status: 400 }
            );
        }

        // TẠO PAYLOAD MỚI: Chỉ trích xuất đúng các trường cần thiết theo Model mới
        // Loại bỏ hoàn toàn object `permissions` phức tạp cũ
        const roleData = {
            name: body.name,
            description: body.description || "",
            isAdmin: Boolean(body.isAdmin), // Đảm bảo luôn là boolean
            isSystem: false // Role do user tạo mặc định không phải system role
        };

        const role = await Role.create(roleData);
        return NextResponse.json({ success: true, data: role }, { status: 201 });
    } catch (error: any) {
        if (error.code === 11000) {
            return NextResponse.json(
                { success: false, error: "Role name already exists" },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}