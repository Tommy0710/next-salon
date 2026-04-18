export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-[#0b1120] transition-colors duration-200">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-900 dark:border-primary-500 border-t-transparent transition-colors duration-200"></div>
                <p className="text-gray-500 dark:text-gray-400 font-medium animate-pulse transition-colors duration-200">Loading...</p>
            </div>
        </div>
    );
}
