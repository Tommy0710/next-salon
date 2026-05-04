import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { auth } from '@/auth';
import { checkPermission } from '@/lib/rbac';
import { serverCache, CACHE_TTL } from '@/lib/cache';

const SETTINGS_CACHE_KEY = 'api:settings:full';
const SETTINGS_PUBLIC_CACHE_KEY = 'api:settings:public';

// GET /api/settings - Get store settings
export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const session = await auth();

        if (!session) {
            // Public cache
            const cached = serverCache.get<any>(SETTINGS_PUBLIC_CACHE_KEY);
            if (cached) {
                return NextResponse.json({ success: true, data: cached }, {
                    headers: { 'Cache-Control': 'private, max-age=60' }
                });
            }

            let settings = await Settings.findOne().lean() as any;
            if (!settings) {
                settings = await Settings.create({ storeName: 'SalonNext', currency: 'USD', timezone: 'UTC', taxRate: 0 });
            }

            const publicData = {
                storeName: settings.storeName,
                logoUrl: settings.logoUrl,
                logoUrlDark: settings.logoUrlDark,
                address: settings.address,
                phone: settings.phone,
                email: settings.email,
                website: settings.website,
                businessHours: settings.businessHours,
                currency: settings.currency,
                //thêm
                reminderHours: settings.reminderHours,
                reminderMethods: settings.reminderMethods,
                qrCodes: settings.qrCodes,
                timeFormat: settings.timeFormat,
                dateFormat: settings.dateFormat,
                zaloEnabled: settings.zaloEnabled,
                zaloTemplates: settings.zaloTemplates,
                zaloQR: settings.zaloQR,
                zaloAppId: settings.zaloAppId,
                zaloAppSecret: settings.zaloAppSecret,
                //hết
                timezone: settings.timezone,
            };
            serverCache.set(SETTINGS_PUBLIC_CACHE_KEY, publicData, CACHE_TTL.SETTINGS);

            return NextResponse.json({ success: true, data: publicData }, {
                headers: { 'Cache-Control': 'private, max-age=60' }
            });
        }

        // Authenticated — return full settings
        const permissionError = await checkPermission(request, 'settings', 'view');
        if (permissionError) return permissionError;

        const cached = serverCache.get<any>(SETTINGS_CACHE_KEY);
        if (cached) {
            return NextResponse.json({ success: true, data: cached }, {
                headers: { 'Cache-Control': 'private, max-age=60' }
            });
        }

        let settings = await Settings.findOne().lean() as any;
        if (!settings) {
            settings = await Settings.create({ storeName: 'SalonNext', currency: 'USD', timezone: 'UTC', taxRate: 0 });
        }

        serverCache.set(SETTINGS_CACHE_KEY, settings, CACHE_TTL.SETTINGS);

        return NextResponse.json({ success: true, data: settings }, {
            headers: { 'Cache-Control': 'private, max-age=60' }
        });
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

        const permissionError = await checkPermission(request, 'settings', 'edit');
        if (permissionError) return permissionError;

        const body = await request.json();

        if (!body || typeof body !== 'object') {
            return NextResponse.json(
                { success: false, error: 'Invalid request body' },
                { status: 400 }
            );
        }

        if (body.qrCodes && Array.isArray(body.qrCodes)) {
            body.qrCodes = body.qrCodes.map((qr: any) => {
                if (!qr.qrId) {
                    qr.qrId = qr.id || `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                }
                delete qr.id;
                return qr;
            });
        }

        const settings = await Settings.findOneAndUpdate(
            {},
            { $set: body },
            { new: true, upsert: true, runValidators: true }
        );

        // Invalidate cache so next GET fetches fresh data
        serverCache.invalidate(SETTINGS_CACHE_KEY);
        serverCache.invalidate(SETTINGS_PUBLIC_CACHE_KEY);

        return NextResponse.json({ success: true, data: settings });
    } catch (error: any) {
        console.error('Error updating settings:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
