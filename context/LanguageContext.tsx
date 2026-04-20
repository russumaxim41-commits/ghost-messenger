import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { translations, Lang, Translations } from '../constants/i18n';

type LanguageContextValue = {
  lang: Lang;
  t: Translations;
  toggleLanguage: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('ru');

  useEffect(() => {
    AsyncStorage.getItem('@ghost_lang').then(v => {
      if (v === 'ru' || v === 'en') setLang(v);
    });
  }, []);

  const toggleLanguage = () => {
    setLang(prev => {
      const next: Lang = prev === 'ru' ? 'en' : 'ru';
      AsyncStorage.setItem('@ghost_lang', next);
      return next;
    });
  };

  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang], toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
