import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogHeader, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { X, Upload, Receipt, ScanLine, Loader2, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageAnalysisModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onAnalyze: (file: File, type: string) => Promise<void>
    isAnalyzing: boolean
}

const analysisTypes = [
    { id: 'general', icon: ImageIcon, labelKey: 'ai.analysis.type.general' },
    { id: 'whiteboard', icon: ScanLine, labelKey: 'ai.analysis.type.whiteboard' },
    { id: 'receipt', icon: Receipt, labelKey: 'ai.analysis.type.receipt' }
]

export function ImageAnalysisModal({ open, onOpenChange, onAnalyze, isAnalyzing }: ImageAnalysisModalProps) {
    const { t } = useTranslation()
    const [file, setFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [selectedType, setSelectedType] = useState('general')
    const [dragActive, setDragActive] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!open) {
            setFile(null)
            setPreviewUrl(null)
            setSelectedType('general')
        }
    }, [open])

    useEffect(() => {
        if (file) {
            const url = URL.createObjectURL(file)
            setPreviewUrl(url)
            return () => URL.revokeObjectURL(url)
        }
    }, [file])

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0])
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0])
        }
    }

    const handleFile = (file: File) => {
        if (file.type.startsWith('image/')) {
            setFile(file)
        }
    }

    const handleSubmit = async () => {
        if (!file) return
        await onAnalyze(file, selectedType)
    }

    return (
        <Dialog open={open} onClose={() => onOpenChange(false)}>
            <DialogHeader>
                {t('ai.analysis.title')}
            </DialogHeader>
            <DialogContent>
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        {t('ai.analysis.description')}
                    </p>

                    {!file ? (
                        <div
                            className={cn(
                                "flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-colors cursor-pointer",
                                dragActive
                                    ? "border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-800"
                                    : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                            )}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="w-10 h-10 text-neutral-400 mb-4" />
                            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                {t('ai.analysis.upload_instruction')}
                            </p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                PNG, JPG, WEBP up to 5MB
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
                                <img src={previewUrl || ''} alt="Preview" className="h-full w-full object-contain" />
                                <button
                                    onClick={() => setFile(null)}
                                    className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors z-10"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                                {isAnalyzing && <ScannerAnimation />}
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-3">
                                    {t('ai.analysis.select_type')}
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    {analysisTypes.map((type) => {
                                        const Icon = type.icon
                                        return (
                                            <button
                                                key={type.id}
                                                onClick={() => setSelectedType(type.id)}
                                                className={cn(
                                                    "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-all",
                                                    selectedType === type.id
                                                        ? "border-neutral-900 bg-neutral-100 dark:border-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                                                        : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400"
                                                )}
                                            >
                                                <Icon className="w-5 h-5" />
                                                <span className="text-xs font-medium">{t(type.labelKey)}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
            <DialogFooter>
                <div className="flex justify-end gap-2 w-full">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!file || isAnalyzing}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 text-sm font-medium text-white dark:text-neutral-900 bg-neutral-900 dark:bg-white rounded-lg transition-colors",
                            (!file || isAnalyzing) ? "opacity-50 cursor-not-allowed" : "hover:bg-neutral-800 dark:hover:bg-neutral-200"
                        )}
                    >
                        {isAnalyzing && <Loader2 className="w-4 h-4 animate-spin" />}
                        {t('ai.analysis.submit')}
                    </button>
                </div>
            </DialogFooter>
        </Dialog >
    )
}

function ScannerAnimation() {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
            {/* Scan line */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-white dark:bg-neutral-400 shadow-[0_0_8px_rgba(255,255,255,0.8)] dark:shadow-[0_0_8px_rgba(255,255,255,0.5)] animate-scan" />

            {/* Gradient overlay for tech look */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 dark:from-white/5 to-transparent opacity-30 animate-pulse" />
        </div>
    )
}
