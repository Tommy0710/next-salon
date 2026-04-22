
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Settings {
    storeName: string;
    currency: string;
    timezone: string;
    taxRate: number;
    logoUrl: string;
    logoUrlDark: string;
    symbol: string;
    qrCodes: {
        qrId: string;
        name: string;
        bankName: string;
        accountNumber: string;
        image: string;
    }[];
    bookingRules?: {
        workingDays: string[];
        shift1: { start: string; end: string };
        shift2: { start: string; end: string };
    };
}

interface SettingsContextType {
    settings: Settings;
    loading: boolean;
    refreshSettings: () => Promise<void>;
}

const defaultSettings: Settings = {
    storeName: 'SalonNext',
    currency: 'VND',
    timezone: 'UTC',
    taxRate: 0,
    logoUrl: '',
    logoUrlDark: '',
    symbol: '₫',
    qrCodes: [],
    bookingRules: {
        workingDays: ['1', '2', '3', '4', '5', '6', '0'],
        shift1: { start: "08:00", end: "12:00" },
        shift2: { start: "13:00", end: "17:00" }
    }
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<Settings>(defaultSettings);
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings', { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                // Get currency symbol from our utility
                const { getCurrencySymbol } = await import('@/lib/currency');
                const symbol = getCurrencySymbol(data.data.currency || 'USD');

                setSettings({
                    storeName: data.data.storeName || 'SalonNext',
                    currency: data.data.currency || 'USD',
                    timezone: data.data.timezone || 'UTC',
                    taxRate: data.data.taxRate || 0,
                    logoUrl: data.data.logoUrl || '',
                    logoUrlDark: data.data.logoUrlDark || '',
                    symbol: symbol,
                    qrCodes: data.data.qrCodes || []
                });
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    return (
        <SettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
