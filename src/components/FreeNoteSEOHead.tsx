/**
 * SEO Head Component for Free Note Page
 * Optimized for search engines with psychological triggers
 */

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SITE_URL, SITE_NAME, languageLocales } from '@/lib/seo'
import { getFreeNoteSEOConfig } from '@/lib/freeNoteSeo'

export function FreeNoteSEOHead() {
  const { i18n } = useTranslation()
  const currentLang = i18n.language || 'en'
  const seoConfig = getFreeNoteSEOConfig(currentLang)
  
  const locale = languageLocales[currentLang] || 'en'
  const isRTL = currentLang === 'ar'
  const pageUrl = `${SITE_URL}/free-note`
  
  useEffect(() => {
    // Update document title
    document.title = seoConfig.title
    
    // Update html lang and dir attributes
    document.documentElement.lang = locale
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
    
    // Helper to update meta tags
    const updateMetaTag = (name: string, content: string, attr: 'name' | 'property' = 'name') => {
      let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute(attr, name)
        document.head.appendChild(meta)
      }
      meta.content = content
    }
    
    // Basic meta tags
    updateMetaTag('description', seoConfig.description)
    updateMetaTag('keywords', seoConfig.keywords.join(', '))
    updateMetaTag('author', SITE_NAME)
    updateMetaTag('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1')
    updateMetaTag('googlebot', 'index, follow')
    
    // Open Graph tags
    updateMetaTag('og:title', seoConfig.ogTitle, 'property')
    updateMetaTag('og:description', seoConfig.ogDescription, 'property')
    updateMetaTag('og:image', `${SITE_URL}/og-image.png`, 'property')
    updateMetaTag('og:image:width', '1200', 'property')
    updateMetaTag('og:image:height', '630', 'property')
    updateMetaTag('og:image:alt', seoConfig.ogTitle, 'property')
    updateMetaTag('og:url', pageUrl, 'property')
    updateMetaTag('og:type', 'website', 'property')
    updateMetaTag('og:site_name', SITE_NAME, 'property')
    updateMetaTag('og:locale', locale.replace('-', '_'), 'property')
    
    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image', 'name')
    updateMetaTag('twitter:title', seoConfig.ogTitle, 'name')
    updateMetaTag('twitter:description', seoConfig.ogDescription, 'name')
    updateMetaTag('twitter:image', `${SITE_URL}/og-image.png`, 'name')
    updateMetaTag('twitter:image:alt', seoConfig.ogTitle, 'name')
    
    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = pageUrl
    
    // hreflang tags for all supported languages
    const supportedLangs = Object.keys(languageLocales)
    
    // Remove existing hreflang tags
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove())
    
    // Add hreflang for each language
    supportedLangs.forEach(lang => {
      const link = document.createElement('link')
      link.rel = 'alternate'
      link.hreflang = languageLocales[lang]
      link.href = `${pageUrl}?lang=${lang}`
      document.head.appendChild(link)
    })
    
    // Add x-default
    const xDefault = document.createElement('link')
    xDefault.rel = 'alternate'
    xDefault.hreflang = 'x-default'
    xDefault.href = pageUrl
    document.head.appendChild(xDefault)
    
    // Structured data for Free Note page
    const structuredData = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${pageUrl}/#webpage`,
          url: pageUrl,
          name: seoConfig.title,
          description: seoConfig.description,
          isPartOf: { '@id': `${SITE_URL}/#website` },
          inLanguage: locale,
          potentialAction: {
            '@type': 'UseAction',
            target: pageUrl,
            name: seoConfig.ctaText
          }
        },
        {
          '@type': 'SoftwareApplication',
          '@id': `${pageUrl}/#app`,
          name: `${SITE_NAME} - Free Note`,
          description: seoConfig.description,
          applicationCategory: 'ProductivityApplication',
          operatingSystem: 'Any',
          browserRequirements: 'Requires JavaScript',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD'
          },
          featureList: [
            'No signup required',
            'Rich text editor',
            'Works offline',
            'Auto-save to browser',
            'Export to PDF/Word',
            'Drawing tools',
            'Voice input'
          ]
        }
      ]
    }
    
    // Update or create structured data script
    let script = document.querySelector('script[type="application/ld+json"][data-page="free-note"]') as HTMLScriptElement
    if (!script) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.setAttribute('data-page', 'free-note')
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(structuredData)
    
    // Cleanup on unmount
    return () => {
      document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove())
      script?.remove()
    }
  }, [currentLang, seoConfig, locale, isRTL, pageUrl])
  
  return null
}
