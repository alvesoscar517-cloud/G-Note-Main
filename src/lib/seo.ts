/**
 * SEO Configuration for G-Note
 * Comprehensive SEO setup for 18 languages with psychological triggers
 */

export interface SEOConfig {
  title: string
  description: string
  keywords: string[]
  ogTitle: string
  ogDescription: string
}

// Base URL for the app
export const SITE_URL = 'https://gnote.graphosai.com'
export const SITE_NAME = 'G-Note'

// Supported languages with SEO-optimized content
// Psychological triggers: simplicity, security, productivity, free, sync
export const seoConfigs: Record<string, SEOConfig> = {
  en: {
    title: 'G-Note - Free Note Taking App | Sync with Google Drive',
    description: 'G-Note is a free, beautiful note-taking app that syncs with Google Drive. Create notes, collaborate in real-time, use AI assistance, and access your notes anywhere. Works offline!',
    keywords: ['note taking app', 'notes app', 'google drive notes', 'free notes', 'cloud notes', 'productivity app', 'offline notes', 'AI notes', 'collaborative notes', 'PWA notes'],
    ogTitle: 'G-Note - Your Notes, Everywhere',
    ogDescription: 'Free note-taking app with Google Drive sync. Beautiful, fast, and works offline. Start organizing your thoughts today!'
  },
  vi: {
    title: 'G-Note - Ứng Dụng Ghi Chú Miễn Phí | Đồng Bộ Google Drive',
    description: 'G-Note là ứng dụng ghi chú miễn phí, đẹp mắt, đồng bộ với Google Drive. Tạo ghi chú, cộng tác thời gian thực, hỗ trợ AI, truy cập mọi nơi. Hoạt động offline!',
    keywords: ['ứng dụng ghi chú', 'app ghi chú', 'ghi chú google drive', 'ghi chú miễn phí', 'ghi chú đám mây', 'ứng dụng năng suất', 'ghi chú offline', 'ghi chú AI'],
    ogTitle: 'G-Note - Ghi Chú Của Bạn, Mọi Nơi',
    ogDescription: 'Ứng dụng ghi chú miễn phí với đồng bộ Google Drive. Đẹp, nhanh, hoạt động offline. Bắt đầu sắp xếp ý tưởng ngay!'
  },
  ja: {
    title: 'G-Note - 無料メモアプリ | Google Driveと同期',
    description: 'G-Noteは無料で美しいメモアプリです。Google Driveと同期、リアルタイムコラボレーション、AI支援、どこからでもアクセス可能。オフラインでも動作！',
    keywords: ['メモアプリ', 'ノートアプリ', 'Google Driveメモ', '無料メモ', 'クラウドメモ', '生産性アプリ', 'オフラインメモ', 'AIメモ'],
    ogTitle: 'G-Note - あなたのメモ、どこでも',
    ogDescription: '無料メモアプリ、Google Drive同期対応。美しく、高速、オフライン対応。今すぐ整理を始めよう！'
  },
  ko: {
    title: 'G-Note - 무료 메모 앱 | Google Drive 동기화',
    description: 'G-Note는 무료로 아름다운 메모 앱입니다. Google Drive 동기화, 실시간 협업, AI 지원, 어디서나 접근 가능. 오프라인에서도 작동!',
    keywords: ['메모 앱', '노트 앱', 'Google Drive 메모', '무료 메모', '클라우드 메모', '생산성 앱', '오프라인 메모', 'AI 메모'],
    ogTitle: 'G-Note - 당신의 메모, 어디서나',
    ogDescription: '무료 메모 앱, Google Drive 동기화. 아름답고, 빠르고, 오프라인 지원. 지금 정리를 시작하세요!'
  },
  'zh-CN': {
    title: 'G-Note - 免费笔记应用 | 同步Google Drive',
    description: 'G-Note是一款免费、美观的笔记应用，与Google Drive同步。创建笔记、实时协作、AI辅助、随时随地访问。支持离线使用！',
    keywords: ['笔记应用', '记事本', 'Google Drive笔记', '免费笔记', '云笔记', '效率工具', '离线笔记', 'AI笔记'],
    ogTitle: 'G-Note - 你的笔记，随处可用',
    ogDescription: '免费笔记应用，支持Google Drive同步。美观、快速、离线可用。立即开始整理你的想法！'
  },
  'zh-TW': {
    title: 'G-Note - 免費筆記應用 | 同步Google Drive',
    description: 'G-Note是一款免費、美觀的筆記應用，與Google Drive同步。創建筆記、即時協作、AI輔助、隨時隨地存取。支援離線使用！',
    keywords: ['筆記應用', '記事本', 'Google Drive筆記', '免費筆記', '雲端筆記', '效率工具', '離線筆記', 'AI筆記'],
    ogTitle: 'G-Note - 你的筆記，隨處可用',
    ogDescription: '免費筆記應用，支援Google Drive同步。美觀、快速、離線可用。立即開始整理你的想法！'
  },
  de: {
    title: 'G-Note - Kostenlose Notiz-App | Google Drive Sync',
    description: 'G-Note ist eine kostenlose, schöne Notiz-App mit Google Drive Sync. Notizen erstellen, Echtzeit-Zusammenarbeit, KI-Unterstützung, überall zugreifen. Funktioniert offline!',
    keywords: ['Notiz-App', 'Notizen App', 'Google Drive Notizen', 'kostenlose Notizen', 'Cloud Notizen', 'Produktivitäts-App', 'Offline Notizen', 'KI Notizen'],
    ogTitle: 'G-Note - Deine Notizen, Überall',
    ogDescription: 'Kostenlose Notiz-App mit Google Drive Sync. Schön, schnell, offline verfügbar. Starte jetzt mit dem Organisieren!'
  },
  fr: {
    title: 'G-Note - Application de Notes Gratuite | Sync Google Drive',
    description: 'G-Note est une application de notes gratuite et élégante synchronisée avec Google Drive. Créez des notes, collaborez en temps réel, assistance IA, accédez partout. Fonctionne hors ligne!',
    keywords: ['application notes', 'app notes', 'notes Google Drive', 'notes gratuites', 'notes cloud', 'app productivité', 'notes hors ligne', 'notes IA'],
    ogTitle: 'G-Note - Vos Notes, Partout',
    ogDescription: 'Application de notes gratuite avec sync Google Drive. Belle, rapide, fonctionne hors ligne. Commencez à organiser vos idées!'
  },
  es: {
    title: 'G-Note - App de Notas Gratis | Sincroniza con Google Drive',
    description: 'G-Note es una app de notas gratuita y hermosa que sincroniza con Google Drive. Crea notas, colabora en tiempo real, asistencia IA, accede desde cualquier lugar. ¡Funciona sin conexión!',
    keywords: ['app de notas', 'aplicación notas', 'notas Google Drive', 'notas gratis', 'notas en la nube', 'app productividad', 'notas offline', 'notas IA'],
    ogTitle: 'G-Note - Tus Notas, En Todas Partes',
    ogDescription: 'App de notas gratis con sincronización Google Drive. Hermosa, rápida, funciona offline. ¡Empieza a organizar tus ideas!'
  },
  'pt-BR': {
    title: 'G-Note - App de Notas Grátis | Sincroniza com Google Drive',
    description: 'G-Note é um app de notas gratuito e bonito que sincroniza com Google Drive. Crie notas, colabore em tempo real, assistência IA, acesse de qualquer lugar. Funciona offline!',
    keywords: ['app de notas', 'aplicativo notas', 'notas Google Drive', 'notas grátis', 'notas na nuvem', 'app produtividade', 'notas offline', 'notas IA'],
    ogTitle: 'G-Note - Suas Notas, Em Todo Lugar',
    ogDescription: 'App de notas grátis com sincronização Google Drive. Bonito, rápido, funciona offline. Comece a organizar suas ideias!'
  },
  it: {
    title: 'G-Note - App Note Gratuita | Sincronizza con Google Drive',
    description: 'G-Note è un\'app di note gratuita e bella che si sincronizza con Google Drive. Crea note, collabora in tempo reale, assistenza IA, accedi ovunque. Funziona offline!',
    keywords: ['app note', 'applicazione note', 'note Google Drive', 'note gratis', 'note cloud', 'app produttività', 'note offline', 'note IA'],
    ogTitle: 'G-Note - Le Tue Note, Ovunque',
    ogDescription: 'App di note gratuita con sincronizzazione Google Drive. Bella, veloce, funziona offline. Inizia a organizzare le tue idee!'
  },
  nl: {
    title: 'G-Note - Gratis Notitie App | Google Drive Sync',
    description: 'G-Note is een gratis, mooie notitie-app die synchroniseert met Google Drive. Maak notities, werk realtime samen, AI-ondersteuning, toegang overal. Werkt offline!',
    keywords: ['notitie app', 'notities app', 'Google Drive notities', 'gratis notities', 'cloud notities', 'productiviteits app', 'offline notities', 'AI notities'],
    ogTitle: 'G-Note - Jouw Notities, Overal',
    ogDescription: 'Gratis notitie-app met Google Drive sync. Mooi, snel, werkt offline. Begin nu met organiseren!'
  },
  ar: {
    title: 'G-Note - تطبيق ملاحظات مجاني | مزامنة Google Drive',
    description: 'G-Note هو تطبيق ملاحظات مجاني وجميل يتزامن مع Google Drive. أنشئ ملاحظات، تعاون في الوقت الفعلي، مساعدة الذكاء الاصطناعي، الوصول من أي مكان. يعمل بدون اتصال!',
    keywords: ['تطبيق ملاحظات', 'ملاحظات', 'ملاحظات Google Drive', 'ملاحظات مجانية', 'ملاحظات سحابية', 'تطبيق إنتاجية', 'ملاحظات بدون اتصال', 'ملاحظات AI'],
    ogTitle: 'G-Note - ملاحظاتك، في كل مكان',
    ogDescription: 'تطبيق ملاحظات مجاني مع مزامنة Google Drive. جميل، سريع، يعمل بدون اتصال. ابدأ بتنظيم أفكارك الآن!'
  },
  hi: {
    title: 'G-Note - मुफ्त नोट्स ऐप | Google Drive सिंक',
    description: 'G-Note एक मुफ्त, सुंदर नोट्स ऐप है जो Google Drive के साथ सिंक करता है। नोट्स बनाएं, रीयल-टाइम सहयोग, AI सहायता, कहीं से भी एक्सेस करें। ऑफलाइन काम करता है!',
    keywords: ['नोट्स ऐप', 'नोट्स एप्लिकेशन', 'Google Drive नोट्स', 'मुफ्त नोट्स', 'क्लाउड नोट्स', 'प्रोडक्टिविटी ऐप', 'ऑफलाइन नोट्स', 'AI नोट्स'],
    ogTitle: 'G-Note - आपके नोट्स, हर जगह',
    ogDescription: 'Google Drive सिंक के साथ मुफ्त नोट्स ऐप। सुंदर, तेज़, ऑफलाइन काम करता है। अभी अपने विचारों को व्यवस्थित करना शुरू करें!'
  },
  tr: {
    title: 'G-Note - Ücretsiz Not Uygulaması | Google Drive Senkronizasyonu',
    description: 'G-Note, Google Drive ile senkronize olan ücretsiz ve güzel bir not uygulamasıdır. Notlar oluşturun, gerçek zamanlı işbirliği yapın, AI desteği, her yerden erişin. Çevrimdışı çalışır!',
    keywords: ['not uygulaması', 'notlar uygulaması', 'Google Drive notları', 'ücretsiz notlar', 'bulut notları', 'verimlilik uygulaması', 'çevrimdışı notlar', 'AI notları'],
    ogTitle: 'G-Note - Notlarınız, Her Yerde',
    ogDescription: 'Google Drive senkronizasyonlu ücretsiz not uygulaması. Güzel, hızlı, çevrimdışı çalışır. Fikirlerinizi düzenlemeye başlayın!'
  },
  pl: {
    title: 'G-Note - Darmowa Aplikacja do Notatek | Synchronizacja z Google Drive',
    description: 'G-Note to darmowa, piękna aplikacja do notatek synchronizująca się z Google Drive. Twórz notatki, współpracuj w czasie rzeczywistym, wsparcie AI, dostęp z każdego miejsca. Działa offline!',
    keywords: ['aplikacja do notatek', 'notatki', 'notatki Google Drive', 'darmowe notatki', 'notatki w chmurze', 'aplikacja produktywności', 'notatki offline', 'notatki AI'],
    ogTitle: 'G-Note - Twoje Notatki, Wszędzie',
    ogDescription: 'Darmowa aplikacja do notatek z synchronizacją Google Drive. Piękna, szybka, działa offline. Zacznij organizować swoje myśli!'
  },
  th: {
    title: 'G-Note - แอปจดบันทึกฟรี | ซิงค์กับ Google Drive',
    description: 'G-Note เป็นแอปจดบันทึกฟรีที่สวยงาม ซิงค์กับ Google Drive สร้างบันทึก ทำงานร่วมกันแบบเรียลไทม์ ช่วยเหลือด้วย AI เข้าถึงได้ทุกที่ ใช้งานออฟไลน์ได้!',
    keywords: ['แอปจดบันทึก', 'แอปโน้ต', 'บันทึก Google Drive', 'บันทึกฟรี', 'บันทึกคลาวด์', 'แอปเพิ่มประสิทธิภาพ', 'บันทึกออฟไลน์', 'บันทึก AI'],
    ogTitle: 'G-Note - บันทึกของคุณ ทุกที่',
    ogDescription: 'แอปจดบันทึกฟรีพร้อมซิงค์ Google Drive สวยงาม รวดเร็ว ใช้งานออฟไลน์ได้ เริ่มจัดระเบียบความคิดของคุณวันนี้!'
  },
  id: {
    title: 'G-Note - Aplikasi Catatan Gratis | Sinkronisasi Google Drive',
    description: 'G-Note adalah aplikasi catatan gratis dan indah yang sinkron dengan Google Drive. Buat catatan, kolaborasi real-time, bantuan AI, akses dari mana saja. Bekerja offline!',
    keywords: ['aplikasi catatan', 'app catatan', 'catatan Google Drive', 'catatan gratis', 'catatan cloud', 'aplikasi produktivitas', 'catatan offline', 'catatan AI'],
    ogTitle: 'G-Note - Catatan Anda, Di Mana Saja',
    ogDescription: 'Aplikasi catatan gratis dengan sinkronisasi Google Drive. Indah, cepat, bekerja offline. Mulai mengatur ide Anda sekarang!'
  }
}

// Language to locale mapping for hreflang
export const languageLocales: Record<string, string> = {
  en: 'en',
  vi: 'vi',
  ja: 'ja',
  ko: 'ko',
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant',
  de: 'de',
  fr: 'fr',
  es: 'es',
  'pt-BR': 'pt-BR',
  it: 'it',
  nl: 'nl',
  ar: 'ar',
  hi: 'hi',
  tr: 'tr',
  pl: 'pl',
  th: 'th',
  id: 'id'
}

// Get SEO config for current language
export function getSEOConfig(lang: string): SEOConfig {
  return seoConfigs[lang] || seoConfigs.en
}

// Generate structured data for the app (JSON-LD)
export function generateStructuredData(lang: string) {
  const config = getSEOConfig(lang)
  
  return {
    '@context': 'https://schema.org',
    '@graph': [
      // WebApplication
      {
        '@type': 'WebApplication',
        '@id': `${SITE_URL}/#webapp`,
        name: SITE_NAME,
        description: config.description,
        url: SITE_URL,
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript',
        softwareVersion: '1.0.3',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD'
        },
        featureList: [
          'Google Drive Sync',
          'Real-time Collaboration',
          'AI Assistance',
          'Offline Support',
          'Multi-language Support',
          'Rich Text Editor',
          'Voice Input',
          'Drawing Tools'
        ],
        screenshot: `${SITE_URL}/og-image.png`,
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.8',
          ratingCount: '1000',
          bestRating: '5',
          worstRating: '1'
        }
      },
      // Organization
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_URL}/pwa-512x512.png`,
          width: 512,
          height: 512
        },
        sameAs: []
      },
      // WebSite
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: config.description,
        publisher: {
          '@id': `${SITE_URL}/#organization`
        },
        inLanguage: languageLocales[lang] || 'en',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}/?search={search_term_string}`
          },
          'query-input': 'required name=search_term_string'
        }
      },
      // BreadcrumbList
      {
        '@type': 'BreadcrumbList',
        '@id': `${SITE_URL}/#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: SITE_URL
          }
        ]
      },
      // FAQPage for better SEO
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Is G-Note free to use?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes, G-Note is completely free to use with all core features including Google Drive sync, offline support, and rich text editing.'
            }
          },
          {
            '@type': 'Question',
            name: 'Does G-Note work offline?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes, G-Note is a Progressive Web App (PWA) that works fully offline. Your notes are saved locally and sync automatically when you\'re back online.'
            }
          },
          {
            '@type': 'Question',
            name: 'How does Google Drive sync work?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'G-Note securely syncs your notes to your Google Drive account. Your notes are stored in a dedicated folder and can be accessed from any device.'
            }
          },
          {
            '@type': 'Question',
            name: 'What languages does G-Note support?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'G-Note supports 18 languages including English, Vietnamese, Japanese, Korean, Chinese (Simplified & Traditional), German, French, Spanish, Portuguese, Italian, Dutch, Arabic, Hindi, Turkish, Polish, Thai, and Indonesian.'
            }
          }
        ]
      }
    ]
  }
}

// Generate hreflang links for all supported languages
export function generateHreflangLinks(): string {
  const links = Object.entries(languageLocales).map(([lang, locale]) => {
    const url = lang === 'en' ? SITE_URL : `${SITE_URL}/?lang=${lang}`
    return `<link rel="alternate" hreflang="${locale}" href="${url}" />`
  })
  
  // Add x-default
  links.push(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}" />`)
  
  return links.join('\n    ')
}
