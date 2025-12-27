/**
 * Script to add offline i18n keys to all locale files
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, '../src/locales');

// Offline translations for each language
const offlineTranslations = {
  en: {
    offline: {
      offline: "Offline",
      online: "Online",
      nowOffline: "You're offline. Changes will sync when back online.",
      backOnline: "Back online! Syncing changes...",
      syncing: "Syncing...",
      pending: "{{count}} pending",
      syncSuccess: "Synced {{count}} changes",
      syncFailed: "Some changes failed to sync",
      offlineBanner: "You're offline. Your notes are saved locally.",
      networkRequired: "Network Required",
      networkRequiredDescription: "This action requires an internet connection. Please check your connection and try again.",
      featureRequiresNetwork: "\"{{feature}}\" requires an internet connection.",
      workingOffline: "Working offline",
      changesWillSync: "Changes will sync automatically when online",
      retrying: "Retrying sync...",
      syncError: "Sync error",
      tapToRetry: "Tap to retry",
      loginRequiresNetwork: "Login requires an internet connection"
    }
  },
  vi: {
    offline: {
      offline: "Ngoại tuyến",
      online: "Trực tuyến",
      nowOffline: "Bạn đang ngoại tuyến. Thay đổi sẽ đồng bộ khi có mạng.",
      backOnline: "Đã có mạng! Đang đồng bộ...",
      syncing: "Đang đồng bộ...",
      pending: "{{count}} chờ đồng bộ",
      syncSuccess: "Đã đồng bộ {{count}} thay đổi",
      syncFailed: "Một số thay đổi không thể đồng bộ",
      offlineBanner: "Bạn đang ngoại tuyến. Ghi chú được lưu cục bộ.",
      networkRequired: "Cần kết nối mạng",
      networkRequiredDescription: "Thao tác này cần kết nối internet. Vui lòng kiểm tra kết nối và thử lại.",
      featureRequiresNetwork: "\"{{feature}}\" cần kết nối internet.",
      workingOffline: "Đang làm việc ngoại tuyến",
      changesWillSync: "Thay đổi sẽ tự động đồng bộ khi có mạng",
      retrying: "Đang thử lại...",
      syncError: "Lỗi đồng bộ",
      tapToRetry: "Nhấn để thử lại",
      loginRequiresNetwork: "Đăng nhập cần kết nối internet"
    }
  },
  ja: {
    offline: {
      offline: "オフライン",
      online: "オンライン",
      nowOffline: "オフラインです。オンラインになると変更が同期されます。",
      backOnline: "オンラインに戻りました！同期中...",
      syncing: "同期中...",
      pending: "{{count}}件保留中",
      syncSuccess: "{{count}}件の変更を同期しました",
      syncFailed: "一部の変更を同期できませんでした",
      offlineBanner: "オフラインです。メモはローカルに保存されています。",
      networkRequired: "ネットワーク接続が必要",
      networkRequiredDescription: "この操作にはインターネット接続が必要です。接続を確認して再試行してください。",
      featureRequiresNetwork: "「{{feature}}」にはインターネット接続が必要です。",
      workingOffline: "オフラインで作業中",
      changesWillSync: "オンラインになると自動的に同期されます",
      retrying: "再試行中...",
      syncError: "同期エラー",
      tapToRetry: "タップして再試行",
      loginRequiresNetwork: "ログインにはインターネット接続が必要です"
    }
  },
  ko: {
    offline: {
      offline: "오프라인",
      online: "온라인",
      nowOffline: "오프라인 상태입니다. 온라인이 되면 변경 사항이 동기화됩니다.",
      backOnline: "온라인으로 돌아왔습니다! 동기화 중...",
      syncing: "동기화 중...",
      pending: "{{count}}개 대기 중",
      syncSuccess: "{{count}}개 변경 사항 동기화됨",
      syncFailed: "일부 변경 사항을 동기화하지 못했습니다",
      offlineBanner: "오프라인 상태입니다. 메모가 로컬에 저장됩니다.",
      networkRequired: "네트워크 연결 필요",
      networkRequiredDescription: "이 작업에는 인터넷 연결이 필요합니다. 연결을 확인하고 다시 시도하세요.",
      featureRequiresNetwork: "\"{{feature}}\"에는 인터넷 연결이 필요합니다.",
      workingOffline: "오프라인으로 작업 중",
      changesWillSync: "온라인이 되면 자동으로 동기화됩니다",
      retrying: "재시도 중...",
      syncError: "동기화 오류",
      tapToRetry: "탭하여 재시도",
      loginRequiresNetwork: "로그인에는 인터넷 연결이 필요합니다"
    }
  },
  "zh-CN": {
    offline: {
      offline: "离线",
      online: "在线",
      nowOffline: "您已离线。恢复网络后将同步更改。",
      backOnline: "已恢复在线！正在同步...",
      syncing: "同步中...",
      pending: "{{count}}项待同步",
      syncSuccess: "已同步{{count}}项更改",
      syncFailed: "部分更改同步失败",
      offlineBanner: "您已离线。笔记已保存在本地。",
      networkRequired: "需要网络连接",
      networkRequiredDescription: "此操作需要网络连接。请检查您的网络并重试。",
      featureRequiresNetwork: "\"{{feature}}\"需要网络连接。",
      workingOffline: "离线工作中",
      changesWillSync: "恢复在线后将自动同步",
      retrying: "正在重试...",
      syncError: "同步错误",
      tapToRetry: "点击重试",
      loginRequiresNetwork: "登录需要网络连接"
    }
  },
  "zh-TW": {
    offline: {
      offline: "離線",
      online: "在線",
      nowOffline: "您已離線。恢復網路後將同步更改。",
      backOnline: "已恢復在線！正在同步...",
      syncing: "同步中...",
      pending: "{{count}}項待同步",
      syncSuccess: "已同步{{count}}項更改",
      syncFailed: "部分更改同步失敗",
      offlineBanner: "您已離線。筆記已保存在本地。",
      networkRequired: "需要網路連接",
      networkRequiredDescription: "此操作需要網路連接。請檢查您的網路並重試。",
      featureRequiresNetwork: "「{{feature}}」需要網路連接。",
      workingOffline: "離線工作中",
      changesWillSync: "恢復在線後將自動同步",
      retrying: "正在重試...",
      syncError: "同步錯誤",
      tapToRetry: "點擊重試",
      loginRequiresNetwork: "登入需要網路連接"
    }
  },
  de: {
    offline: {
      offline: "Offline",
      online: "Online",
      nowOffline: "Sie sind offline. Änderungen werden synchronisiert, wenn Sie wieder online sind.",
      backOnline: "Wieder online! Synchronisiere...",
      syncing: "Synchronisiere...",
      pending: "{{count}} ausstehend",
      syncSuccess: "{{count}} Änderungen synchronisiert",
      syncFailed: "Einige Änderungen konnten nicht synchronisiert werden",
      offlineBanner: "Sie sind offline. Ihre Notizen werden lokal gespeichert.",
      networkRequired: "Netzwerk erforderlich",
      networkRequiredDescription: "Diese Aktion erfordert eine Internetverbindung. Bitte überprüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
      featureRequiresNetwork: "\"{{feature}}\" erfordert eine Internetverbindung.",
      workingOffline: "Offline arbeiten",
      changesWillSync: "Änderungen werden automatisch synchronisiert, wenn Sie online sind",
      retrying: "Erneut versuchen...",
      syncError: "Synchronisierungsfehler",
      tapToRetry: "Tippen zum Wiederholen",
      loginRequiresNetwork: "Anmeldung erfordert eine Internetverbindung"
    }
  },
  fr: {
    offline: {
      offline: "Hors ligne",
      online: "En ligne",
      nowOffline: "Vous êtes hors ligne. Les modifications seront synchronisées une fois en ligne.",
      backOnline: "De retour en ligne ! Synchronisation...",
      syncing: "Synchronisation...",
      pending: "{{count}} en attente",
      syncSuccess: "{{count}} modifications synchronisées",
      syncFailed: "Certaines modifications n'ont pas pu être synchronisées",
      offlineBanner: "Vous êtes hors ligne. Vos notes sont enregistrées localement.",
      networkRequired: "Connexion requise",
      networkRequiredDescription: "Cette action nécessite une connexion Internet. Veuillez vérifier votre connexion et réessayer.",
      featureRequiresNetwork: "\"{{feature}}\" nécessite une connexion Internet.",
      workingOffline: "Travail hors ligne",
      changesWillSync: "Les modifications seront synchronisées automatiquement une fois en ligne",
      retrying: "Nouvelle tentative...",
      syncError: "Erreur de synchronisation",
      tapToRetry: "Appuyez pour réessayer",
      loginRequiresNetwork: "La connexion nécessite une connexion Internet"
    }
  },
  es: {
    offline: {
      offline: "Sin conexión",
      online: "En línea",
      nowOffline: "Estás sin conexión. Los cambios se sincronizarán cuando vuelvas a estar en línea.",
      backOnline: "¡De vuelta en línea! Sincronizando...",
      syncing: "Sincronizando...",
      pending: "{{count}} pendientes",
      syncSuccess: "{{count}} cambios sincronizados",
      syncFailed: "Algunos cambios no se pudieron sincronizar",
      offlineBanner: "Estás sin conexión. Tus notas se guardan localmente.",
      networkRequired: "Se requiere conexión",
      networkRequiredDescription: "Esta acción requiere conexión a Internet. Por favor, verifica tu conexión e inténtalo de nuevo.",
      featureRequiresNetwork: "\"{{feature}}\" requiere conexión a Internet.",
      workingOffline: "Trabajando sin conexión",
      changesWillSync: "Los cambios se sincronizarán automáticamente cuando estés en línea",
      retrying: "Reintentando...",
      syncError: "Error de sincronización",
      tapToRetry: "Toca para reintentar",
      loginRequiresNetwork: "Iniciar sesión requiere conexión a Internet"
    }
  },
  "pt-BR": {
    offline: {
      offline: "Offline",
      online: "Online",
      nowOffline: "Você está offline. As alterações serão sincronizadas quando voltar a ficar online.",
      backOnline: "De volta online! Sincronizando...",
      syncing: "Sincronizando...",
      pending: "{{count}} pendentes",
      syncSuccess: "{{count}} alterações sincronizadas",
      syncFailed: "Algumas alterações não puderam ser sincronizadas",
      offlineBanner: "Você está offline. Suas notas são salvas localmente.",
      networkRequired: "Conexão necessária",
      networkRequiredDescription: "Esta ação requer conexão com a Internet. Por favor, verifique sua conexão e tente novamente.",
      featureRequiresNetwork: "\"{{feature}}\" requer conexão com a Internet.",
      workingOffline: "Trabalhando offline",
      changesWillSync: "As alterações serão sincronizadas automaticamente quando estiver online",
      retrying: "Tentando novamente...",
      syncError: "Erro de sincronização",
      tapToRetry: "Toque para tentar novamente",
      loginRequiresNetwork: "Login requer conexão com a Internet"
    }
  },
  it: {
    offline: {
      offline: "Offline",
      online: "Online",
      nowOffline: "Sei offline. Le modifiche verranno sincronizzate quando tornerai online.",
      backOnline: "Di nuovo online! Sincronizzazione...",
      syncing: "Sincronizzazione...",
      pending: "{{count}} in sospeso",
      syncSuccess: "{{count}} modifiche sincronizzate",
      syncFailed: "Alcune modifiche non sono state sincronizzate",
      offlineBanner: "Sei offline. Le tue note sono salvate localmente.",
      networkRequired: "Connessione richiesta",
      networkRequiredDescription: "Questa azione richiede una connessione Internet. Controlla la connessione e riprova.",
      featureRequiresNetwork: "\"{{feature}}\" richiede una connessione Internet.",
      workingOffline: "Lavoro offline",
      changesWillSync: "Le modifiche verranno sincronizzate automaticamente quando sarai online",
      retrying: "Nuovo tentativo...",
      syncError: "Errore di sincronizzazione",
      tapToRetry: "Tocca per riprovare",
      loginRequiresNetwork: "L'accesso richiede una connessione Internet"
    }
  },
  nl: {
    offline: {
      offline: "Offline",
      online: "Online",
      nowOffline: "Je bent offline. Wijzigingen worden gesynchroniseerd wanneer je weer online bent.",
      backOnline: "Weer online! Synchroniseren...",
      syncing: "Synchroniseren...",
      pending: "{{count}} in behandeling",
      syncSuccess: "{{count}} wijzigingen gesynchroniseerd",
      syncFailed: "Sommige wijzigingen konden niet worden gesynchroniseerd",
      offlineBanner: "Je bent offline. Je notities worden lokaal opgeslagen.",
      networkRequired: "Netwerk vereist",
      networkRequiredDescription: "Deze actie vereist een internetverbinding. Controleer je verbinding en probeer het opnieuw.",
      featureRequiresNetwork: "\"{{feature}}\" vereist een internetverbinding.",
      workingOffline: "Offline werken",
      changesWillSync: "Wijzigingen worden automatisch gesynchroniseerd wanneer je online bent",
      retrying: "Opnieuw proberen...",
      syncError: "Synchronisatiefout",
      tapToRetry: "Tik om opnieuw te proberen",
      loginRequiresNetwork: "Inloggen vereist een internetverbinding"
    }
  },
  pl: {
    offline: {
      offline: "Offline",
      online: "Online",
      nowOffline: "Jesteś offline. Zmiany zostaną zsynchronizowane po powrocie online.",
      backOnline: "Znowu online! Synchronizacja...",
      syncing: "Synchronizacja...",
      pending: "{{count}} oczekujących",
      syncSuccess: "Zsynchronizowano {{count}} zmian",
      syncFailed: "Niektóre zmiany nie zostały zsynchronizowane",
      offlineBanner: "Jesteś offline. Twoje notatki są zapisywane lokalnie.",
      networkRequired: "Wymagane połączenie",
      networkRequiredDescription: "Ta akcja wymaga połączenia z Internetem. Sprawdź połączenie i spróbuj ponownie.",
      featureRequiresNetwork: "\"{{feature}}\" wymaga połączenia z Internetem.",
      workingOffline: "Praca offline",
      changesWillSync: "Zmiany zostaną automatycznie zsynchronizowane po połączeniu",
      retrying: "Ponowna próba...",
      syncError: "Błąd synchronizacji",
      tapToRetry: "Dotknij, aby ponowić",
      loginRequiresNetwork: "Logowanie wymaga połączenia z Internetem"
    }
  },
  tr: {
    offline: {
      offline: "Çevrimdışı",
      online: "Çevrimiçi",
      nowOffline: "Çevrimdışısınız. Değişiklikler çevrimiçi olduğunuzda senkronize edilecek.",
      backOnline: "Tekrar çevrimiçi! Senkronize ediliyor...",
      syncing: "Senkronize ediliyor...",
      pending: "{{count}} bekliyor",
      syncSuccess: "{{count}} değişiklik senkronize edildi",
      syncFailed: "Bazı değişiklikler senkronize edilemedi",
      offlineBanner: "Çevrimdışısınız. Notlarınız yerel olarak kaydedildi.",
      networkRequired: "Ağ bağlantısı gerekli",
      networkRequiredDescription: "Bu işlem internet bağlantısı gerektirir. Bağlantınızı kontrol edin ve tekrar deneyin.",
      featureRequiresNetwork: "\"{{feature}}\" internet bağlantısı gerektirir.",
      workingOffline: "Çevrimdışı çalışıyor",
      changesWillSync: "Çevrimiçi olduğunuzda değişiklikler otomatik olarak senkronize edilecek",
      retrying: "Yeniden deneniyor...",
      syncError: "Senkronizasyon hatası",
      tapToRetry: "Yeniden denemek için dokunun",
      loginRequiresNetwork: "Giriş yapmak için internet bağlantısı gerekli"
    }
  },
  ar: {
    offline: {
      offline: "غير متصل",
      online: "متصل",
      nowOffline: "أنت غير متصل. ستتم مزامنة التغييرات عند الاتصال بالإنترنت.",
      backOnline: "عدت للاتصال! جارٍ المزامنة...",
      syncing: "جارٍ المزامنة...",
      pending: "{{count}} قيد الانتظار",
      syncSuccess: "تمت مزامنة {{count}} تغييرات",
      syncFailed: "فشلت مزامنة بعض التغييرات",
      offlineBanner: "أنت غير متصل. يتم حفظ ملاحظاتك محليًا.",
      networkRequired: "يتطلب اتصال بالإنترنت",
      networkRequiredDescription: "يتطلب هذا الإجراء اتصالاً بالإنترنت. يرجى التحقق من اتصالك والمحاولة مرة أخرى.",
      featureRequiresNetwork: "\"{{feature}}\" يتطلب اتصالاً بالإنترنت.",
      workingOffline: "العمل دون اتصال",
      changesWillSync: "ستتم مزامنة التغييرات تلقائيًا عند الاتصال",
      retrying: "جارٍ إعادة المحاولة...",
      syncError: "خطأ في المزامنة",
      tapToRetry: "انقر لإعادة المحاولة",
      loginRequiresNetwork: "تسجيل الدخول يتطلب اتصالاً بالإنترنت"
    }
  },
  hi: {
    offline: {
      offline: "ऑफ़लाइन",
      online: "ऑनलाइन",
      nowOffline: "आप ऑफ़लाइन हैं। ऑनलाइन होने पर बदलाव सिंक होंगे।",
      backOnline: "वापस ऑनलाइन! सिंक हो रहा है...",
      syncing: "सिंक हो रहा है...",
      pending: "{{count}} लंबित",
      syncSuccess: "{{count}} बदलाव सिंक हुए",
      syncFailed: "कुछ बदलाव सिंक नहीं हो सके",
      offlineBanner: "आप ऑफ़लाइन हैं। आपके नोट्स स्थानीय रूप से सहेजे गए हैं।",
      networkRequired: "नेटवर्क आवश्यक",
      networkRequiredDescription: "इस क्रिया के लिए इंटरनेट कनेक्शन आवश्यक है। कृपया अपना कनेक्शन जांचें और पुनः प्रयास करें।",
      featureRequiresNetwork: "\"{{feature}}\" के लिए इंटरनेट कनेक्शन आवश्यक है।",
      workingOffline: "ऑफ़लाइन काम कर रहे हैं",
      changesWillSync: "ऑनलाइन होने पर बदलाव स्वचालित रूप से सिंक होंगे",
      retrying: "पुनः प्रयास हो रहा है...",
      syncError: "सिंक त्रुटि",
      tapToRetry: "पुनः प्रयास के लिए टैप करें",
      loginRequiresNetwork: "लॉगिन के लिए इंटरनेट कनेक्शन आवश्यक है"
    }
  },
  th: {
    offline: {
      offline: "ออฟไลน์",
      online: "ออนไลน์",
      nowOffline: "คุณออฟไลน์อยู่ การเปลี่ยนแปลงจะซิงค์เมื่อกลับมาออนไลน์",
      backOnline: "กลับมาออนไลน์แล้ว! กำลังซิงค์...",
      syncing: "กำลังซิงค์...",
      pending: "{{count}} รอดำเนินการ",
      syncSuccess: "ซิงค์ {{count}} การเปลี่ยนแปลงแล้ว",
      syncFailed: "การเปลี่ยนแปลงบางส่วนไม่สามารถซิงค์ได้",
      offlineBanner: "คุณออฟไลน์อยู่ บันทึกของคุณถูกบันทึกไว้ในเครื่อง",
      networkRequired: "ต้องการการเชื่อมต่อ",
      networkRequiredDescription: "การดำเนินการนี้ต้องการการเชื่อมต่ออินเทอร์เน็ต กรุณาตรวจสอบการเชื่อมต่อและลองอีกครั้ง",
      featureRequiresNetwork: "\"{{feature}}\" ต้องการการเชื่อมต่ออินเทอร์เน็ต",
      workingOffline: "ทำงานแบบออฟไลน์",
      changesWillSync: "การเปลี่ยนแปลงจะซิงค์โดยอัตโนมัติเมื่อออนไลน์",
      retrying: "กำลังลองใหม่...",
      syncError: "ข้อผิดพลาดในการซิงค์",
      tapToRetry: "แตะเพื่อลองใหม่",
      loginRequiresNetwork: "การเข้าสู่ระบบต้องการการเชื่อมต่ออินเทอร์เน็ต"
    }
  },
  id: {
    offline: {
      offline: "Offline",
      online: "Online",
      nowOffline: "Anda sedang offline. Perubahan akan disinkronkan saat kembali online.",
      backOnline: "Kembali online! Menyinkronkan...",
      syncing: "Menyinkronkan...",
      pending: "{{count}} tertunda",
      syncSuccess: "{{count}} perubahan disinkronkan",
      syncFailed: "Beberapa perubahan gagal disinkronkan",
      offlineBanner: "Anda sedang offline. Catatan Anda disimpan secara lokal.",
      networkRequired: "Koneksi diperlukan",
      networkRequiredDescription: "Tindakan ini memerlukan koneksi internet. Silakan periksa koneksi Anda dan coba lagi.",
      featureRequiresNetwork: "\"{{feature}}\" memerlukan koneksi internet.",
      workingOffline: "Bekerja offline",
      changesWillSync: "Perubahan akan disinkronkan secara otomatis saat online",
      retrying: "Mencoba lagi...",
      syncError: "Kesalahan sinkronisasi",
      tapToRetry: "Ketuk untuk mencoba lagi",
      loginRequiresNetwork: "Login memerlukan koneksi internet"
    }
  }
};

// Process each locale file
const localeFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

localeFiles.forEach(file => {
  const lang = file.replace('.json', '');
  const filePath = path.join(localesDir, file);
  
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Get translations for this language, fallback to English
    const translations = offlineTranslations[lang] || offlineTranslations.en;
    
    // Add or update offline translations
    content.offline = translations.offline;
    
    // Write back
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8');
    console.log(`${lang}: added/updated offline keys`);
  } catch (err) {
    console.error(`Error processing ${file}:`, err.message);
  }
});

console.log('Done!');
