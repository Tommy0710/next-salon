import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Role, User } from '@/lib/initModels';

// GET /api/roles/[id] - Get single role
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();
        const { id } = await params;
        const role = await Role.findById(id);

        if (!role) {
            return NextResponse.json(
                { success: false, error: "Role not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: role });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT /api/roles/[id] - Update role
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();
        const { id } = await params;
        const body = await request.json();

        const existingRole = await Role.findById(id);
        if (!existingRole) {
            return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });
        }

        // Không cho phép đổi tên của các Role mặc định của hệ thống
        if (existingRole.isSystem && body.name && body.name !== existingRole.name) {
            return NextResponse.json(
                { success: false, error: "Cannot rename system roles" },
                { status: 400 }
            );
        }

        // Cập nhật các trường thông tin cơ bản
        if (body.name) existingRole.name = body.name;
        if (body.description !== undefined) existingRole.description = body.description;

        // Cập nhật quyền Admin (nếu có truyền lên)
        if (body.isAdmin !== undefined) {
            existingRole.isAdmin = body.isAdmin;
        }

        await existingRole.save();

        return NextResponse.json({ success: true, data: existingRole });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE /api/roles/[id] - Delete role
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();
        const { id } = await params;

        const role = await Role.findById(id);
        if (!role) {
            return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });
        }

        if (role.isSystem) {
            return NextResponse.json(
                { success: false, error: "Cannot delete system roles" },
                { status: 400 }
            );
        }

        // Kiểm tra xem có user nào đang được gán role này không
        const usersCount = await User.countDocuments({ role: id });
        if (usersCount > 0) {
            return NextResponse.json(
                { success: false, error: `Cannot delete role. It is assigned to ${usersCount} users.` },
                { status: 400 }
            );
        }

        await Role.findByIdAndDelete(id);

        return NextResponse.json({ success: true, message: "Role deleted successfully" });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}