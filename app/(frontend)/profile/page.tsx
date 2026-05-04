"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Save, User, Mail, Lock, Shield } from "lucide-react";
import FormInput, { FormButton } from "@/components/dashboard/FormInput";

interface UserProfile {
    name: string;
    email: string;
    password?: string;
    confirmPassword?: string;
}

export default function ProfilePage() {
    const [profile, setProfile] = useState<UserProfile>({
        name: "",
        email: "",
        password: "",
        confirmPassword: ""
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await fetch("/api/profile");
            const data = await res.json();
            if (data.success) {
                setProfile(prev => ({
                    ...prev,
                    name: data.data.name || "",
                    email: data.data.email || ""
                }));
            }
        } catch (error) {
            console.error("Error fetching profile:", error);
            toast.error("Failed to load profile");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        if (profile.password && profile.password !== profile.confirmPassword) {
            toast.error("Passwords do not match");
            setSaving(false);
            return;
        }

        if (profile.password && profile.password.length < 8) {
            toast.error("Password must be at least 8 characters");
            setSaving(false);
            return;
        }

        if (profile.password) {
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
            if (!passwordRegex.test(profile.password)) {
                toast.error("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character");
                setSaving(false);
                return;
            }
        }

        try {
            const res = await fetch("/api/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(profile),
            });
            const data = await res.json();
            if (data.success) {
                setProfile(prev => ({
                    ...prev,
                    name: data.data.name,
                    email: data.data.email,
                    password: "",
                    confirmPassword: ""
                }));
                toast.success("Profile updated successfully!");
            } else {
                toast.error(data.error || "Failed to update profile");
            }
        } catch (error) {
            console.error("Error updating profile:", error);
            toast.error("Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-900 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>
                <p className="text-gray-500">Manage your account settings and preferences</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-4 flex items-start gap-3">
                <Shield className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                    <p className="font-medium">Security Notice</p>
                    <p className="text-sm mt-1">
                        For security reasons, please logout and log back in after changing your email address or password.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information */}
                <div className="bg-white dark:bg-slate-900 dark:border-gray-700 rounded-xl shadow-sm border border-gray-200 p-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-primary-900" />
                        Personal Information
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormInput
                            label="Full Name"
                            value={profile.name}
                            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                            placeholder="John Doe"
                        />
                        <FormInput
                            label="Email Address"
                            value={profile.email}
                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                            type="email"
                            required
                            placeholder="john@example.com"
                        />
                    </div>
                </div>

                {/* Security */}
                <div className="bg-white dark:bg-slate-900 dark:border-gray-700 rounded-xl shadow-sm border border-gray-200 p-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary-900" />
                        Security
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormInput
                            label="New Password"
                            value={profile.password || ""}
                            onChange={(e) => setProfile({ ...profile, password: e.target.value })}
                            type="password"
                            placeholder="Leave blank to keep current"
                        />
                        <FormInput
                            label="Confirm New Password"
                            value={profile.confirmPassword || ""}
                            onChange={(e) => setProfile({ ...profile, confirmPassword: e.target.value })}
                            type="password"
                            placeholder="Confirm new password"
                        />
                    </div>
                    <p className="mt-4 text-sm text-gray-500">
                        Note: Only enter a password if you want to change it.
                    </p>
                </div>

                <div className="flex justify-end">
                    <FormButton
                        type="submit"
                        loading={saving}
                        icon={<Save className="w-5 h-5" />}
                    >
                        Save Changes
                    </FormButton>
                </div>
            </form>
        </div>
    );
}
