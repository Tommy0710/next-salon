import NextAuth, { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Role from "@/models/Role";

// ==========================================
// 1. MODULE AUGMENTATION (KHAI BÁO TYPE)
// ==========================================
declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role: string;
            isAdmin: boolean; // Dùng isAdmin thay cho permissions
        } & DefaultSession["user"];
    }

    interface User {
        role?: any; // Thêm dấu ? để không bị lỗi identical modifiers
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string; // CHÚ Ý: Không có dấu ? ở đây để khớp với code gốc của next-auth
        role?: string;
        isAdmin?: boolean;
        roleId?: string;
    }
}

// ==========================================
// 2. CẤU HÌNH NEXTAUTH
// ==========================================
export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Please provide email and password");
                }

                try {
                    await dbConnect();

                    // Ensure Role model is registered
                    void Role;

                    // Find user and include password field & role
                    const user: any = await User.findOne({
                        email: credentials.email
                    }).select('+password').populate('role');

                    if (!user) {
                        throw new Error("Invalid email or password");
                    }

                    // Check password
                    const isPasswordValid = await user.comparePassword(
                        credentials.password as string
                    );

                    if (!isPasswordValid) {
                        throw new Error("Invalid email or password");
                    }

                    // Return user object
                    return {
                        id: user._id.toString(),
                        email: user.email,
                        name: user.name,
                        role: user.role
                    };
                } catch (error) {
                    console.error("Authentication error:", error);
                    throw error;
                }
            },
        }),
    ],
    // Keep specialized callbacks that need DB here if they can't be in config
    callbacks: {
        ...authConfig.callbacks,

        async jwt({ token, user }) {
            // Initial sign in
            if (user) {
                token.id = user.id;
                if (user.role) {
                    token.role = user.role.name;
                    // Lấy quyền isAdmin từ database gắn vào token
                    token.isAdmin = user.role.isAdmin;
                    token.roleId = user.role._id?.toString() || user.role.id;
                }
            }

            // On subsequent calls, refresh permissions if roleId exists
            // This part uses DB so it must stay in the Node-runtime auth.ts
            if (token.roleId && typeof token.roleId === 'string') {
                try {
                    await dbConnect();
                    const { Role } = await import("@/lib/initModels");
                    const role = await Role.findById(token.roleId);
                    if (role) {
                        token.role = role.name;
                        // Cập nhật lại quyền isAdmin nếu có thay đổi trong DB
                        token.isAdmin = role.isAdmin;
                    }
                } catch (error) {
                    console.error("Error refreshing permissions in JWT callback:", error);
                }
            }

            return token;
        },

        async session({ session, token }) {
            // Đẩy dữ liệu từ JWT xuống Session để giao diện (Client) có thể gọi useSession() lấy ra dùng
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.isAdmin = token.isAdmin as boolean;
            }

            if (authConfig.callbacks?.session) {
                return await authConfig.callbacks.session({ session, token } as any);
            }

            return session;
        }
    }
});