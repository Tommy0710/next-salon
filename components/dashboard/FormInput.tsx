"use client";

import { InputHTMLAttributes, useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload, X, File as FileIcon } from "lucide-react";
import SearchableSelect from "./SearchableSelect";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
}

export default function FormInput({ label, error, className = "", ...props }: FormInputProps) {
    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mb-2">
                {label}
                {props.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
                className={`w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${error ? "border-red-500" : ""
                    } ${className}`}
                {...props}
            />
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
}

interface TextAreaProps extends InputHTMLAttributes<HTMLTextAreaElement> {
    label: string;
    error?: string;
    rows?: number;
}

export function FormTextArea({ label, error, rows = 3, className = "", ...props }: TextAreaProps) {
    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mb-2">
                {label}
                {props.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
                rows={rows}
                className={`w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${error ? "border-red-500" : ""
                    } ${className}`}
                {...props}
            />
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
}

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
    label: string;
    error?: string;
    options: { value: string; label: string }[];
}

export function FormSelect({ label, error, options, className = "", onChange, value, placeholder, required }: any) {
    return (
        <SearchableSelect
            label={label}
            error={error}
            options={options}
            className={className}
            value={value as string}
            onChange={(val) => {
                if (onChange) {
                    onChange({ target: { value: val } } as any);
                }
            }}
            required={required as boolean}
            placeholder={placeholder || `Select ${label}`}
        />
    );
}

interface FileInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    onFileSelect?: (base64: string) => void;
}

export function FormFile({ label, error, onFileSelect, className = "", ...props }: FileInputProps) {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onFileSelect) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onFileSelect(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mb-2">
                {label}
                {props.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
                type="file"
                className={`w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-primary-900/20 dark:file:text-primary-400 dark:hover:file:bg-primary-900/30 ${error ? "border-red-500" : ""
                    } ${className}`}
                onChange={handleFileChange}
                {...props}
            />
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
}

function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File, accept?: string, maxSizeMB?: number): string | null {
    if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
        return `File quá lớn. Tối đa ${maxSizeMB} MB (hiện tại: ${formatBytes(file.size)})`;
    }
    if (accept) {
        const accepted = accept.split(",").map((s) => s.trim().toLowerCase());
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        const mime = file.type.toLowerCase();
        const ok = accepted.some((a) => {
            if (a.startsWith(".")) return ext === a;
            if (a.endsWith("/*")) return mime.startsWith(a.slice(0, -1));
            return mime === a;
        });
        if (!ok) {
            return `Loại file không hợp lệ. Chấp nhận: ${accept.replace(/,/g, ", ")}`;
        }
    }
    return null;
}

interface FormUploadProps {
    label: string;
    error?: string;
    required?: boolean;
    accept?: string;       // e.g. "image/*,.pdf"
    maxSizeMB?: number;    // e.g. 5 → 5 MB limit
    onFileSelect?: (file: File | null) => void;
    onBase64?: (base64: string) => void;
    value?: File | null;
    className?: string;
}

export function FormUpload({
    label,
    error: externalError,
    required,
    accept,
    maxSizeMB,
    onFileSelect,
    onBase64,
    value,
    className = "",
}: FormUploadProps) {
    const [dragOver, setDragOver] = useState(false);
    const [internalError, setInternalError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const displayError = externalError || internalError;

    const processFile = (file: File) => {
        const err = validateFile(file, accept, maxSizeMB);
        if (err) { setInternalError(err); return; }
        setInternalError(null);
        onFileSelect?.(file);
        if (onBase64) {
            const reader = new FileReader();
            reader.onloadend = () => onBase64(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
        e.target.value = "";
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        setInternalError(null);
        onFileSelect?.(null);
        if (inputRef.current) inputRef.current.value = "";
    };

    return (
        <div className={`mb-4 ${className}`}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    dragOver
                        ? "border-primary-600 bg-primary-50 dark:bg-primary-900/20"
                        : displayError
                        ? "border-red-400 bg-red-50 dark:bg-red-900/10"
                        : "border-gray-300 dark:border-slate-600 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-slate-800"
                }`}
            >
                <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
                {value ? (
                    <div className="flex items-center justify-between gap-3 py-1">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg shrink-0">
                                <FileIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                            </div>
                            <div className="min-w-0 text-left">
                                <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{value.name}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{formatBytes(value.size)}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div className="py-3">
                        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                            Kéo thả file vào đây hoặc{" "}
                            <span className="text-primary-600 dark:text-primary-400 underline">chọn file</span>
                        </p>
                        <div className="flex items-center justify-center gap-3 mt-1.5 flex-wrap">
                            {accept && <span className="text-xs text-gray-400">{accept.replace(/,/g, ", ")}</span>}
                            {maxSizeMB && <span className="text-xs text-gray-400">Tối đa {maxSizeMB} MB</span>}
                        </div>
                    </div>
                )}
            </div>
            {displayError && <p className="mt-1.5 text-sm text-red-500">{displayError}</p>}
        </div>
    );
}

export { default as FormButton } from "./FormButton";
