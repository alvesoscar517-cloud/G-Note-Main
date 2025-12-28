/**
 * SEO Head Component
 * Dynamic SEO meta tags based on current language
 */

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  getSEOConfig, 
  generateStructuredData, 
  SITE_URL, 
  SITE_NAME,
  languageLocales 
} from '@/lib/seo'

interface SEOHeadProps {
  pageTitle?: string
  pageDescription?: string
  ogImage?: string
  noIndex?: boolean
}

export function SEOHead({ 
  pageTitle, 
  pageDescription, 
  ogImage = '/og-image.png',
  noIndex = false 
}: SEOHeadProps) {
  const { i18n } = useTranslation()
  const currentLang = i18n.language || 'en'
  const seoConfig = getSEOConfig(currentLang)
  
  const title = pageTitle || seoConfig.title
  const description = pageDescription || seoConfig.description
  const locale = languageLocales[currentLang] || 'en'
  const isRTL = currentLang === 'ar'
  
  useEffect(() => {
    // Update document title
    document.title = title
    
    // Update html lang and dir attributes
    document.documentElement.lang = locale
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
    
    // Update or create meta tags
    updateMetaTag('description', description)
    updateMetaTag('keywords', seoConfig.keywords.join(', '))
    updateMetaTag('author', SITE_NAME)
    updateMetaTag('robots', noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1')
    updateMetaTag('googlebot', noIndex ? 'noindex, nofollow' : 'index, follow')
    
    // Open Graph tags
    updateMetaTag('og:title', seoConfig.ogTitle, 'property')
    updateMetaTag('og:description', seoConfig.ogDescription, 'property')
    updateMetaTag('og:image', `${SITE_URL}${ogImage}`, 'property')
    updateMetaTag('og:image:width', '1200', 'property')
    updateMetaTag('og:image:height', '630', 'property')
    updateMetaTag('og:image:alt', seoConfig.ogTitle, 'property')
    updateMetaTag('og:url', SITE_URL, 'property')
    updateMetaTag('og:type', 'website', 'property')
    updateMetaTag('og:site_name', SITE_NAME, 'property')
    updateMetaTag('og:locale', locale.replace('-', '_'), 'property')
    
    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image', 'name')
    updateMetaTag('twitter:title', seoConfig.ogTitle, 'name')
    updateMetaTag('twitter:description', seoConfig.ogDescription, 'name')
    updateMetaTag('twitter:image', `${SITE_URL}${ogImage}`, 'name')
    updateMetaTag('twitter:image:alt', seoConfig.ogTitle, 'name')
    
    // Additional SEO tags
    updateMetaTag('application-name', SITE_NAME)
    updateMetaTag('apple-mobile-web-app-title', SITE_NAME)
    
    // Canonical URL
    updateLinkTag('canonical', SITE_URL)
    
    // Update structured data
    updateStructuredData(currentLang)
    
    // Update hreflang links
    updateHreflangLinks()
    
  }, [currentLang, title, description, ogImage, noIndex, seoConfig, locale, isRTL])
  
  return null
}

// Helper function to update meta tags
function updateMetaTag(name: string, content: string, attribute: 'name' | 'property' = 'name') {
  let meta = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement
  
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute(attribute, name)
    document.head.appendChild(meta)
  }
  
  meta.content = content
}

// Helper function to update link tags
function updateLinkTag(rel: string, href: string) {
  let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement
  
  if (!link) {
    link = document.createElement('link')
    link.rel = rel
    document.head.appendChild(link)
  }
  
  link.href = href
}

// Helper function to update structured data
function updateStructuredData(lang: string) {
  const existingScript = document.querySelector('script[data-seo="structured-data"]')
  if (existingScript) {
    existingScript.remove()
  }
  
  const script = document.createElement('script')
  script.type = 'application/ld+json'
  script.setAttribute('data-seo', 'structured-data')
  script.textContent = JSON.stringify(generateStructuredData(lang))
  document.head.appendChild(script)
}

// Helper function to update hreflang links
function updateHreflangLinks() {
  // Remove existing hreflang links
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove())
  
  // Add new hreflang links
  Object.entries(languageLocales).forEach(([lang, locale]) => {
    const link = document.createElement('link')
    link.rel = 'alternate'
    link.hreflang = locale
    link.href = lang === 'en' ? SITE_URL : `${SITE_URL}/?lang=${lang}`
    document.head.appendChild(link)
  })
  
  // Add x-default
  const defaultLink = document.createElement('link')
  defaultLink.rel = 'alternate'
  defaultLink.hreflang = 'x-default'
  defaultLink.href = SITE_URL
  document.head.appendChild(defaultLink)
}

export default SEOHead
