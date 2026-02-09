// src/lib/i18n/provider.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Locale, TranslationKey } from './translations';

type TranslationContextType = {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: TranslationKey) => string;
    dir: 'rtl' | 'ltr';
};

const TranslationContext = createContext<TranslationContextType | null>(null);

export function TranslationProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>('he');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('locale') as Locale;
        if (saved && translations[saved]) {
            setLocaleState(saved);
            document.documentElement.lang = saved;
            document.documentElement.dir = saved === 'he' ? 'rtl' : 'ltr';
        }
    }, []);

    const setLocale = (newLocale: Locale) => {
        setLocaleState(newLocale);
        localStorage.setItem('locale', newLocale);
        document.documentElement.lang = newLocale;
        document.documentElement.dir = newLocale === 'he' ? 'rtl' : 'ltr';
    };

    const t = (key: TranslationKey): string => {
        return translations[locale][key] || key;
    };

    // Prevent hydration mismatch
    if (!mounted) {
        return (
            <TranslationContext.Provider
                value={{
                    locale: 'he',
                    setLocale: () => { },
                    t: (key) => translations.he[key] || key,
                    dir: 'rtl',
                }}
            >
                {children}
            </TranslationContext.Provider>
        );
    }

    return (
        <TranslationContext.Provider
            value={{
                locale,
                setLocale,
                t,
                dir: locale === 'he' ? 'rtl' : 'ltr',
            }}
        >
            {children}
        </TranslationContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(TranslationContext);
    if (!context) {
        throw new Error('useTranslation must be used within TranslationProvider');
    }
    return context;
}