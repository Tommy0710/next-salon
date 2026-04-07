import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { auth } from '@/auth';
import { checkPermission } from '@/lib/rbac';

// GET /api/settings - Get store settings
export async function GET(request: NextRequest) {
    try {
        await connectDB();

        // Check if user is authenticated for full settings access
        const session = await auth();

        // Find the first settings document
        let settings = await Settings.findOne();

        if (!settings) {
            settings = await Settings.create({
                storeName: 'SalonNext',
                currency: 'USD',
                timezone: 'UTC',
                taxRate: 0
            });
        }

        // If not authenticated, only return basic public info
        if (!session) {
            return NextResponse.json({
                success: true,
                data: {
                    storeName: settings.storeName,
                    logoUrl: settings.logoUrl,
                    address: settings.address,
                    phone: settings.phone,
                    email: settings.email,
                    website: settings.website,
                    businessHours: settings.businessHours,
                    currency: settings.currency,
                    timezone: settings.timezone
                }
            });
        }

        // If authenticated, check for settings view permission before returning full data
        const permissionError = await checkPermission(request, 'settings', 'view');
        if (permissionError) return permissionError;

        return NextResponse.json({ success: true, data: settings });
    } catch (error: any) {
        console.error('Error fetching settings:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT /api/settings - Update store settings
export async function PUT(request: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        await connectDB();

        // Check Permissions
        // Settings edit uses 'edit' permission
        const permissionError = await checkPermission(request, 'settings', 'edit');
        if (permissionError) return permissionError;

        const body = await request.json();

        if (!body || typeof body !== 'object') {
            return NextResponse.json(
                { success: false, error: 'Invalid request body' },
                { status: 400 }
            );
        }

        // Ensure all QR codes have qrId (for backward compatibility)
        if (body.qrCodes && Array.isArray(body.qrCodes)) {
            body.qrCodes = body.qrCodes.map((qr: any) => {
                if (!qr.qrId) {
                    qr.qrId = qr.id || `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                }
                delete qr.id; // Remove old id field
                return qr;
            });
        }

        // Update the first document found (singleton pattern)
        // $set ensures we don't accidentally replace the entire document if new fields are missing.
        const settings = await Settings.findOneAndUpdate(
            {},
            { $set: body },
            { new: true, upsert: true, runValidators: true }
        );

        return NextResponse.json({ success: true, data: settings });
    } catch (error: any) {
        console.error('Error updating settings:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
