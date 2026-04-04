"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Shield } from "lucide-react";
import FormInput, { FormButton } from "@/components/dashboard/FormInput";

export default function NewRolePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/api/roles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, description, isAdmin }),
            });

            const data = await res.json();
            if (data.success) router.push("/roles");
            else setError(data.error || "Failed to create role");
        } catch (error) {
            setError("An error occurred while creating role");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/roles" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Tạo Vai Trò Mới</h1>
                    <p className="text-gray-500">Định nghĩa quyền Admin hoặc Staff</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-900" />
                        Chi Tiết Vai Trò
                    </h2>
                    <div className="grid grid-cols-1 gap-4 mb-6">
                        <FormInput
                            label="Tên Vai Trò"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="VD: Quản lý chi nhánh"
                            required
                        />
                        <FormInput
                            label="Mô tả"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Mô tả ngắn gọn"
                        />
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="isAdminToggle"
                            checked={isAdmin}
                            onChange={(e) => setIsAdmin(e.target.checked)}
                            className="w-5 h-5 text-blue-900 rounded focus:ring-blue-900 cursor-pointer"
                        />
                        <label htmlFor="isAdminToggle" className="font-semibold text-blue-900 cursor-pointer">
                            Cấp quyền Quản Trị Viên (Toàn Quyền)
                        </label>
                    </div>
                </div>

                {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>}

                <div className="flex justify-end gap-3">
                    <Link href="/roles" className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Hủy</Link>
                    <FormButton type="submit" loading={loading}>Tạo Vai Trò</FormButton>
                </div>
            </form>
        </div>
    );
}