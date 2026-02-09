// src/components/ui/language-switcher.tsx
'use client';

import { useTranslation } from '@/lib/i18n/provider';

export function LanguageSwitcher({ className = '' }: { className?: string }) {
    const { locale, setLocale } = useTranslation();

    return (
        <div className={`flex gap-1 ${className}`}>
            <button
                onClick={() => setLocale('he')}
                className={`px-2 py-1 text-sm rounded transition-colors ${locale === 'he'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
            >
                עב
            </button>
            <button
                onClick={() => setLocale('en')}
                className={`px-2 py-1 text-sm rounded transition-colors ${locale === 'en'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
            >
                EN
            </button>
        </div>
    );
}