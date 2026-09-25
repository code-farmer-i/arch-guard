import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en'
import zh from './locales/zh-CN'

export const i18nReady = i18next.use(initReactI18next).init({
  lng: 'zh-CN',
  fallbackLng: 'en',
  resources: { 'zh-CN': zh, en },
})
