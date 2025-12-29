/**
 * SEO Configuration for Free Note Page
 * Optimized for 18 languages with psychological triggers:
 * - Free / No cost
 * - No signup / Instant access
 * - Private / Secure
 * - Simple / Easy to use
 */

export interface FreeNoteSEOConfig {
  title: string
  description: string
  keywords: string[]
  ogTitle: string
  ogDescription: string
  ctaText: string
}

export const freeNoteSeoConfigs: Record<string, FreeNoteSEOConfig> = {
  en: {
    title: 'Free Online Notepad - No Signup Required | G-Note',
    description: 'Start taking notes instantly with our free online notepad. No signup, no download. Rich text editor, auto-save, works offline. Your notes stay private in your browser.',
    keywords: ['free notepad', 'online notepad', 'no signup notepad', 'instant notes', 'browser notepad', 'private notes', 'quick notes', 'text editor online', 'free note taking'],
    ogTitle: 'Free Online Notepad - Start Writing Instantly',
    ogDescription: 'No signup needed. Just open and start writing. Rich text editor with auto-save. Your notes, your privacy.',
    ctaText: 'Start Writing Now'
  },
  vi: {
    title: 'Ghi Chú Online Miễn Phí - Không Cần Đăng Ký | G-Note',
    description: 'Bắt đầu ghi chú ngay lập tức với notepad online miễn phí. Không cần đăng ký, không cần tải xuống. Trình soạn thảo đầy đủ, tự động lưu, hoạt động offline. Ghi chú của bạn được bảo mật trong trình duyệt.',
    keywords: ['ghi chú miễn phí', 'notepad online', 'ghi chú không cần đăng ký', 'ghi chú nhanh', 'notepad trình duyệt', 'ghi chú riêng tư', 'soạn thảo văn bản online'],
    ogTitle: 'Ghi Chú Online Miễn Phí - Viết Ngay Lập Tức',
    ogDescription: 'Không cần đăng ký. Chỉ cần mở và bắt đầu viết. Trình soạn thảo đầy đủ với tự động lưu. Ghi chú của bạn, quyền riêng tư của bạn.',
    ctaText: 'Bắt Đầu Viết Ngay'
  },
  ja: {
    title: '無料オンラインメモ帳 - 登録不要 | G-Note',
    description: '無料のオンラインメモ帳で今すぐメモを取り始めましょう。登録不要、ダウンロード不要。リッチテキストエディタ、自動保存、オフライン対応。メモはブラウザ内でプライベートに保存されます。',
    keywords: ['無料メモ帳', 'オンラインメモ帳', '登録不要メモ', '即座にメモ', 'ブラウザメモ帳', 'プライベートメモ', 'クイックメモ', 'オンラインテキストエディタ'],
    ogTitle: '無料オンラインメモ帳 - 今すぐ書き始める',
    ogDescription: '登録不要。開いてすぐに書き始められます。自動保存付きリッチテキストエディタ。あなたのメモ、あなたのプライバシー。',
    ctaText: '今すぐ書き始める'
  },
  ko: {
    title: '무료 온라인 메모장 - 가입 불필요 | G-Note',
    description: '무료 온라인 메모장으로 즉시 메모를 시작하세요. 가입 불필요, 다운로드 불필요. 리치 텍스트 에디터, 자동 저장, 오프라인 지원. 메모는 브라우저에서 비공개로 유지됩니다.',
    keywords: ['무료 메모장', '온라인 메모장', '가입 불필요 메모', '즉시 메모', '브라우저 메모장', '비공개 메모', '빠른 메모', '온라인 텍스트 에디터'],
    ogTitle: '무료 온라인 메모장 - 즉시 작성 시작',
    ogDescription: '가입 불필요. 열고 바로 작성하세요. 자동 저장 리치 텍스트 에디터. 당신의 메모, 당신의 프라이버시.',
    ctaText: '지금 작성 시작'
  },
  'zh-CN': {
    title: '免费在线记事本 - 无需注册 | G-Note',
    description: '使用我们的免费在线记事本立即开始记笔记。无需注册，无需下载。富文本编辑器，自动保存，离线可用。您的笔记在浏览器中保持私密。',
    keywords: ['免费记事本', '在线记事本', '无需注册记事本', '即时笔记', '浏览器记事本', '私密笔记', '快速笔记', '在线文本编辑器'],
    ogTitle: '免费在线记事本 - 立即开始写作',
    ogDescription: '无需注册。打开即可开始写作。带自动保存的富文本编辑器。您的笔记，您的隐私。',
    ctaText: '立即开始写作'
  },
  'zh-TW': {
    title: '免費線上記事本 - 無需註冊 | G-Note',
    description: '使用我們的免費線上記事本立即開始記筆記。無需註冊，無需下載。富文本編輯器，自動儲存，離線可用。您的筆記在瀏覽器中保持私密。',
    keywords: ['免費記事本', '線上記事本', '無需註冊記事本', '即時筆記', '瀏覽器記事本', '私密筆記', '快速筆記', '線上文字編輯器'],
    ogTitle: '免費線上記事本 - 立即開始寫作',
    ogDescription: '無需註冊。打開即可開始寫作。帶自動儲存的富文本編輯器。您的筆記，您的隱私。',
    ctaText: '立即開始寫作'
  },
  de: {
    title: 'Kostenloses Online-Notizblock - Keine Anmeldung erforderlich | G-Note',
    description: 'Beginnen Sie sofort mit dem Notieren mit unserem kostenlosen Online-Notizblock. Keine Anmeldung, kein Download. Rich-Text-Editor, automatisches Speichern, funktioniert offline. Ihre Notizen bleiben privat in Ihrem Browser.',
    keywords: ['kostenloses Notizblock', 'Online-Notizblock', 'Notizblock ohne Anmeldung', 'sofortige Notizen', 'Browser-Notizblock', 'private Notizen', 'schnelle Notizen', 'Online-Texteditor'],
    ogTitle: 'Kostenloses Online-Notizblock - Sofort schreiben',
    ogDescription: 'Keine Anmeldung erforderlich. Einfach öffnen und schreiben. Rich-Text-Editor mit automatischem Speichern. Ihre Notizen, Ihre Privatsphäre.',
    ctaText: 'Jetzt schreiben'
  },
  fr: {
    title: 'Bloc-notes en ligne gratuit - Sans inscription | G-Note',
    description: 'Commencez à prendre des notes instantanément avec notre bloc-notes en ligne gratuit. Sans inscription, sans téléchargement. Éditeur de texte riche, sauvegarde automatique, fonctionne hors ligne. Vos notes restent privées dans votre navigateur.',
    keywords: ['bloc-notes gratuit', 'bloc-notes en ligne', 'bloc-notes sans inscription', 'notes instantanées', 'bloc-notes navigateur', 'notes privées', 'notes rapides', 'éditeur de texte en ligne'],
    ogTitle: 'Bloc-notes en ligne gratuit - Écrivez instantanément',
    ogDescription: 'Sans inscription. Ouvrez et commencez à écrire. Éditeur de texte riche avec sauvegarde automatique. Vos notes, votre vie privée.',
    ctaText: 'Commencer à écrire'
  },
  es: {
    title: 'Bloc de notas online gratis - Sin registro | G-Note',
    description: 'Comienza a tomar notas al instante con nuestro bloc de notas online gratis. Sin registro, sin descarga. Editor de texto enriquecido, guardado automático, funciona sin conexión. Tus notas permanecen privadas en tu navegador.',
    keywords: ['bloc de notas gratis', 'bloc de notas online', 'bloc de notas sin registro', 'notas instantáneas', 'bloc de notas navegador', 'notas privadas', 'notas rápidas', 'editor de texto online'],
    ogTitle: 'Bloc de notas online gratis - Escribe al instante',
    ogDescription: 'Sin registro. Solo abre y empieza a escribir. Editor de texto enriquecido con guardado automático. Tus notas, tu privacidad.',
    ctaText: 'Empezar a escribir'
  },
  'pt-BR': {
    title: 'Bloco de notas online grátis - Sem cadastro | G-Note',
    description: 'Comece a fazer anotações instantaneamente com nosso bloco de notas online grátis. Sem cadastro, sem download. Editor de texto rico, salvamento automático, funciona offline. Suas notas permanecem privadas no seu navegador.',
    keywords: ['bloco de notas grátis', 'bloco de notas online', 'bloco de notas sem cadastro', 'notas instantâneas', 'bloco de notas navegador', 'notas privadas', 'notas rápidas', 'editor de texto online'],
    ogTitle: 'Bloco de notas online grátis - Escreva instantaneamente',
    ogDescription: 'Sem cadastro. Apenas abra e comece a escrever. Editor de texto rico com salvamento automático. Suas notas, sua privacidade.',
    ctaText: 'Começar a escrever'
  },
  it: {
    title: 'Blocco note online gratuito - Senza registrazione | G-Note',
    description: 'Inizia a prendere appunti istantaneamente con il nostro blocco note online gratuito. Senza registrazione, senza download. Editor di testo ricco, salvataggio automatico, funziona offline. I tuoi appunti rimangono privati nel tuo browser.',
    keywords: ['blocco note gratuito', 'blocco note online', 'blocco note senza registrazione', 'appunti istantanei', 'blocco note browser', 'appunti privati', 'appunti veloci', 'editor di testo online'],
    ogTitle: 'Blocco note online gratuito - Scrivi istantaneamente',
    ogDescription: 'Senza registrazione. Apri e inizia a scrivere. Editor di testo ricco con salvataggio automatico. I tuoi appunti, la tua privacy.',
    ctaText: 'Inizia a scrivere'
  },
  nl: {
    title: 'Gratis online kladblok - Geen registratie nodig | G-Note',
    description: 'Begin direct met notities maken met ons gratis online kladblok. Geen registratie, geen download. Rijke teksteditor, automatisch opslaan, werkt offline. Je notities blijven privé in je browser.',
    keywords: ['gratis kladblok', 'online kladblok', 'kladblok zonder registratie', 'directe notities', 'browser kladblok', 'privé notities', 'snelle notities', 'online teksteditor'],
    ogTitle: 'Gratis online kladblok - Direct schrijven',
    ogDescription: 'Geen registratie nodig. Open en begin te schrijven. Rijke teksteditor met automatisch opslaan. Jouw notities, jouw privacy.',
    ctaText: 'Nu beginnen schrijven'
  },
  ar: {
    title: 'مفكرة مجانية على الإنترنت - بدون تسجيل | G-Note',
    description: 'ابدأ في تدوين الملاحظات فوراً مع مفكرتنا المجانية على الإنترنت. بدون تسجيل، بدون تحميل. محرر نصوص غني، حفظ تلقائي، يعمل بدون اتصال. ملاحظاتك تبقى خاصة في متصفحك.',
    keywords: ['مفكرة مجانية', 'مفكرة على الإنترنت', 'مفكرة بدون تسجيل', 'ملاحظات فورية', 'مفكرة المتصفح', 'ملاحظات خاصة', 'ملاحظات سريعة', 'محرر نصوص على الإنترنت'],
    ogTitle: 'مفكرة مجانية على الإنترنت - ابدأ الكتابة فوراً',
    ogDescription: 'بدون تسجيل. افتح وابدأ الكتابة. محرر نصوص غني مع حفظ تلقائي. ملاحظاتك، خصوصيتك.',
    ctaText: 'ابدأ الكتابة الآن'
  },
  hi: {
    title: 'मुफ्त ऑनलाइन नोटपैड - साइनअप की जरूरत नहीं | G-Note',
    description: 'हमारे मुफ्त ऑनलाइन नोटपैड के साथ तुरंत नोट्स लेना शुरू करें। कोई साइनअप नहीं, कोई डाउनलोड नहीं। रिच टेक्स्ट एडिटर, ऑटो-सेव, ऑफलाइन काम करता है। आपके नोट्स आपके ब्राउज़र में निजी रहते हैं।',
    keywords: ['मुफ्त नोटपैड', 'ऑनलाइन नोटपैड', 'बिना साइनअप नोटपैड', 'तुरंत नोट्स', 'ब्राउज़र नोटपैड', 'निजी नोट्स', 'त्वरित नोट्स', 'ऑनलाइन टेक्स्ट एडिटर'],
    ogTitle: 'मुफ्त ऑनलाइन नोटपैड - तुरंत लिखना शुरू करें',
    ogDescription: 'साइनअप की जरूरत नहीं। बस खोलें और लिखना शुरू करें। ऑटो-सेव के साथ रिच टेक्स्ट एडिटर। आपके नोट्स, आपकी गोपनीयता।',
    ctaText: 'अभी लिखना शुरू करें'
  },
  tr: {
    title: 'Ücretsiz Çevrimiçi Not Defteri - Kayıt Gerektirmez | G-Note',
    description: 'Ücretsiz çevrimiçi not defterimizle hemen not almaya başlayın. Kayıt yok, indirme yok. Zengin metin editörü, otomatik kaydetme, çevrimdışı çalışır. Notlarınız tarayıcınızda gizli kalır.',
    keywords: ['ücretsiz not defteri', 'çevrimiçi not defteri', 'kayıtsız not defteri', 'anında notlar', 'tarayıcı not defteri', 'özel notlar', 'hızlı notlar', 'çevrimiçi metin editörü'],
    ogTitle: 'Ücretsiz Çevrimiçi Not Defteri - Hemen Yazmaya Başlayın',
    ogDescription: 'Kayıt gerektirmez. Açın ve yazmaya başlayın. Otomatik kaydetmeli zengin metin editörü. Notlarınız, gizliliğiniz.',
    ctaText: 'Şimdi Yazmaya Başla'
  },
  pl: {
    title: 'Darmowy notatnik online - Bez rejestracji | G-Note',
    description: 'Zacznij robić notatki natychmiast z naszym darmowym notatnikiem online. Bez rejestracji, bez pobierania. Edytor tekstu sformatowanego, automatyczny zapis, działa offline. Twoje notatki pozostają prywatne w przeglądarce.',
    keywords: ['darmowy notatnik', 'notatnik online', 'notatnik bez rejestracji', 'natychmiastowe notatki', 'notatnik przeglądarkowy', 'prywatne notatki', 'szybkie notatki', 'edytor tekstu online'],
    ogTitle: 'Darmowy notatnik online - Pisz natychmiast',
    ogDescription: 'Bez rejestracji. Po prostu otwórz i zacznij pisać. Edytor tekstu sformatowanego z automatycznym zapisem. Twoje notatki, Twoja prywatność.',
    ctaText: 'Zacznij pisać teraz'
  },
  th: {
    title: 'สมุดบันทึกออนไลน์ฟรี - ไม่ต้องสมัคร | G-Note',
    description: 'เริ่มจดบันทึกทันทีด้วยสมุดบันทึกออนไลน์ฟรีของเรา ไม่ต้องสมัคร ไม่ต้องดาวน์โหลด โปรแกรมแก้ไขข้อความ บันทึกอัตโนมัติ ใช้งานออฟไลน์ได้ บันทึกของคุณยังคงเป็นส่วนตัวในเบราว์เซอร์',
    keywords: ['สมุดบันทึกฟรี', 'สมุดบันทึกออนไลน์', 'สมุดบันทึกไม่ต้องสมัคร', 'บันทึกทันที', 'สมุดบันทึกเบราว์เซอร์', 'บันทึกส่วนตัว', 'บันทึกด่วน', 'โปรแกรมแก้ไขข้อความออนไลน์'],
    ogTitle: 'สมุดบันทึกออนไลน์ฟรี - เริ่มเขียนทันที',
    ogDescription: 'ไม่ต้องสมัคร เปิดและเริ่มเขียนได้เลย โปรแกรมแก้ไขข้อความพร้อมบันทึกอัตโนมัติ บันทึกของคุณ ความเป็นส่วนตัวของคุณ',
    ctaText: 'เริ่มเขียนเลย'
  },
  id: {
    title: 'Notepad Online Gratis - Tanpa Daftar | G-Note',
    description: 'Mulai mencatat sekarang dengan notepad online gratis kami. Tanpa daftar, tanpa unduh. Editor teks kaya, simpan otomatis, bekerja offline. Catatan Anda tetap pribadi di browser Anda.',
    keywords: ['notepad gratis', 'notepad online', 'notepad tanpa daftar', 'catatan instan', 'notepad browser', 'catatan pribadi', 'catatan cepat', 'editor teks online'],
    ogTitle: 'Notepad Online Gratis - Mulai Menulis Sekarang',
    ogDescription: 'Tanpa daftar. Buka dan mulai menulis. Editor teks kaya dengan simpan otomatis. Catatan Anda, privasi Anda.',
    ctaText: 'Mulai Menulis Sekarang'
  }
}

export function getFreeNoteSEOConfig(lang: string): FreeNoteSEOConfig {
  return freeNoteSeoConfigs[lang] || freeNoteSeoConfigs.en
}
