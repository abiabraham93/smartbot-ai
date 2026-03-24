/**
 * i18n.js — SmartBot V2 translations (Phase 6)
 * Languages: English, Arabic, Hindi, Tamil
 *
 * Usage:
 *   import { t, detectLanguage, isRTL } from "../i18n";
 *   t("welcome_title", "ar")  → "مرحباً بك في سمارت بوت"
 */

export const translations = {
  en: {
    // Chat welcome screen
    welcome_title:       "Welcome to SmartBot",
    welcome_subtitle:    "Your secure banking AI assistant. Ask me about products, policies, procedures, or any banking query.",
    offline_mode:        "Offline mode — answers from your documents only",
    online_mode:         "Online mode — answers from documents + internet",
    // Suggestion buttons
    suggestion_1:        "What are the loan eligibility criteria?",
    suggestion_2:        "Explain fixed vs floating interest rates",
    suggestion_3:        "How do I open a savings account?",
    suggestion_4:        "What documents are needed for a mortgage?",
    // Follow-up
    suggested_followups: "Suggested follow-ups:",
    // Input
    input_placeholder:   "Ask SmartBot a banking question...",
    input_disclaimer:    "SmartBot can make mistakes. Always verify important banking information with your representative.",
    // Feedback
    was_helpful:         "Was this helpful?",
    thanks_feedback:     "Thanks for your feedback!",
    // Auth
    sign_in:             "Sign in",
    register:            "Register",
    logout:              "Logout",
    // Profile page
    profile_title:       "Edit Profile",
    full_name:           "Full Name",
    email:               "Email",
    password:            "Password",
    new_password:        "New Password",
    confirm_password:    "Confirm Password",
    save_changes:        "Save Changes",
    preferences_title:   "Preferences",
    theme:               "Theme",
    language:            "Language",
    notifications:       "Notifications",
    notifications_desc:  "Receive system updates and alerts",
    memory_depth:        "Conversation memory depth",
    memory_desc:         "How many previous messages the AI remembers",
    save_preferences:    "Save Preferences",
    chat_history:        "Chat History",
    no_sessions:         "No chat sessions yet.",
    // Errors
    error_backend:       "Error: Could not reach SmartBot backend.",
    error_empty:         "Question cannot be empty.",
    error_session:       "Could not create session. Is the backend running?",
    // Misc
    member_since:        "Member since",
    anonymous:           "Anonymous",
    open:                "Open",
    delete:              "Delete",
  },

  ar: {
    welcome_title:       "مرحباً بك في سمارت بوت",
    welcome_subtitle:    "مساعدك المصرفي الذكي الآمن. اسألني عن المنتجات والسياسات والإجراءات أو أي استفسار مصرفي.",
    offline_mode:        "وضع غير متصل — إجابات من مستنداتك فقط",
    online_mode:         "وضع متصل — إجابات من المستندات والإنترنت",
    suggestion_1:        "ما هي معايير الأهلية للحصول على قرض؟",
    suggestion_2:        "اشرح الفرق بين أسعار الفائدة الثابتة والمتغيرة",
    suggestion_3:        "كيف أفتح حساب توفير؟",
    suggestion_4:        "ما هي الوثائق المطلوبة للحصول على رهن عقاري؟",
    suggested_followups: "أسئلة مقترحة:",
    input_placeholder:   "اسأل سمارت بوت سؤالاً مصرفياً...",
    input_disclaimer:    "قد يُخطئ سمارت بوت. تحقق دائماً من المعلومات المصرفية المهمة مع ممثلك.",
    was_helpful:         "هل كان هذا مفيداً؟",
    thanks_feedback:     "شكراً على ملاحظاتك!",
    sign_in:             "تسجيل الدخول",
    register:            "إنشاء حساب",
    logout:              "تسجيل الخروج",
    profile_title:       "تعديل الملف الشخصي",
    full_name:           "الاسم الكامل",
    email:               "البريد الإلكتروني",
    password:            "كلمة المرور",
    new_password:        "كلمة مرور جديدة",
    confirm_password:    "تأكيد كلمة المرور",
    save_changes:        "حفظ التغييرات",
    preferences_title:   "التفضيلات",
    theme:               "المظهر",
    language:            "اللغة",
    notifications:       "الإشعارات",
    notifications_desc:  "استقبال تحديثات النظام والتنبيهات",
    memory_depth:        "عمق ذاكرة المحادثة",
    memory_desc:         "عدد الرسائل السابقة التي يتذكرها الذكاء الاصطناعي",
    save_preferences:    "حفظ التفضيلات",
    chat_history:        "سجل المحادثات",
    no_sessions:         "لا توجد جلسات محادثة بعد.",
    error_backend:       "خطأ: تعذّر الوصول إلى خادم سمارت بوت.",
    error_empty:         "لا يمكن أن يكون السؤال فارغاً.",
    error_session:       "تعذّر إنشاء الجلسة. هل الخادم يعمل؟",
    member_since:        "عضو منذ",
    anonymous:           "مجهول",
    open:                "فتح",
    delete:              "حذف",
  },

  hi: {
    welcome_title:       "स्मार्टबॉट में आपका स्वागत है",
    welcome_subtitle:    "आपका सुरक्षित बैंकिंग AI सहायक। उत्पादों, नीतियों, प्रक्रियाओं या किसी भी बैंकिंग प्रश्न के बारे में पूछें।",
    offline_mode:        "ऑफलाइन मोड — केवल आपके दस्तावेज़ों से उत्तर",
    online_mode:         "ऑनलाइन मोड — दस्तावेज़ और इंटरनेट से उत्तर",
    suggestion_1:        "ऋण पात्रता मानदंड क्या हैं?",
    suggestion_2:        "स्थिर और परिवर्तनशील ब्याज दरों की व्याख्या करें",
    suggestion_3:        "मैं बचत खाता कैसे खोलूं?",
    suggestion_4:        "गृह ऋण के लिए कौन से दस्तावेज़ चाहिए?",
    suggested_followups: "सुझाए गए प्रश्न:",
    input_placeholder:   "स्मार्टबॉट से बैंकिंग प्रश्न पूछें...",
    input_disclaimer:    "स्मार्टबॉट गलतियाँ कर सकता है। महत्वपूर्ण बैंकिंग जानकारी हमेशा अपने प्रतिनिधि से सत्यापित करें।",
    was_helpful:         "क्या यह सहायक था?",
    thanks_feedback:     "आपकी प्रतिक्रिया के लिए धन्यवाद!",
    sign_in:             "साइन इन",
    register:            "पंजीकरण",
    logout:              "लॉग आउट",
    profile_title:       "प्रोफ़ाइल संपादित करें",
    full_name:           "पूरा नाम",
    email:               "ईमेल",
    password:            "पासवर्ड",
    new_password:        "नया पासवर्ड",
    confirm_password:    "पासवर्ड की पुष्टि करें",
    save_changes:        "परिवर्तन सहेजें",
    preferences_title:   "प्राथमिकताएं",
    theme:               "थीम",
    language:            "भाषा",
    notifications:       "सूचनाएं",
    notifications_desc:  "सिस्टम अपडेट और अलर्ट प्राप्त करें",
    memory_depth:        "बातचीत की मेमोरी गहराई",
    memory_desc:         "AI कितने पिछले संदेश याद रखता है",
    save_preferences:    "प्राथमिकताएं सहेजें",
    chat_history:        "चैट इतिहास",
    no_sessions:         "अभी तक कोई चैट सत्र नहीं।",
    error_backend:       "त्रुटि: स्मार्टबॉट बैकएंड तक नहीं पहुंचा जा सका।",
    error_empty:         "प्रश्न खाली नहीं हो सकता।",
    error_session:       "सत्र नहीं बना सका। क्या बैकएंड चल रहा है?",
    member_since:        "सदस्य since",
    anonymous:           "अनाम",
    open:                "खोलें",
    delete:              "हटाएं",
  },

  ta: {
    welcome_title:       "SmartBot-க்கு வரவேற்கிறோம்",
    welcome_subtitle:    "உங்கள் பாதுகாப்பான வங்கி AI உதவியாளர். தயாரிப்புகள், கொள்கைகள், நடைமுறைகள் அல்லது வங்கி கேள்விகளை கேளுங்கள்.",
    offline_mode:        "ஆஃப்லைன் பயன்முறை — உங்கள் ஆவணங்களிலிருந்து மட்டும்",
    online_mode:         "ஆன்லைன் பயன்முறை — ஆவணங்கள் மற்றும் இணையத்திலிருந்து",
    suggestion_1:        "கடன் தகுதி அளவுகோல்கள் என்ன?",
    suggestion_2:        "நிலையான மற்றும் மிதக்கும் வட்டி விகிதங்களை விளக்குங்கள்",
    suggestion_3:        "சேமிப்பு கணக்கை எவ்வாறு திறப்பது?",
    suggestion_4:        "வீட்டு கடனுக்கு என்ன ஆவணங்கள் தேவை?",
    suggested_followups: "பரிந்துரைக்கப்பட்ட கேள்விகள்:",
    input_placeholder:   "SmartBot-ஐ வங்கி கேள்வி கேளுங்கள்...",
    input_disclaimer:    "SmartBot தவறுகள் செய்யலாம். முக்கியமான வங்கி தகவலை உங்கள் பிரதிநிதியுடன் சரிபார்க்கவும்.",
    was_helpful:         "இது உதவியதா?",
    thanks_feedback:     "உங்கள் கருத்துக்கு நன்றி!",
    sign_in:             "உள்நுழை",
    register:            "பதிவு செய்",
    logout:              "வெளியேறு",
    profile_title:       "சுயவிவரத்தை திருத்து",
    full_name:           "முழு பெயர்",
    email:               "மின்னஞ்சல்",
    password:            "கடவுச்சொல்",
    new_password:        "புதிய கடவுச்சொல்",
    confirm_password:    "கடவுச்சொல்லை உறுதிப்படுத்து",
    save_changes:        "மாற்றங்களை சேமி",
    preferences_title:   "விருப்பங்கள்",
    theme:               "தீம்",
    language:            "மொழி",
    notifications:       "அறிவிப்புகள்",
    notifications_desc:  "கணினி புதுப்பிப்புகள் மற்றும் எச்சரிக்கைகளை பெறுங்கள்",
    memory_depth:        "உரையாடல் நினைவக ஆழம்",
    memory_desc:         "AI எத்தனை முந்தைய செய்திகளை நினைவில் வைக்கிறது",
    save_preferences:    "விருப்பங்களை சேமி",
    chat_history:        "அரட்டை வரலாறு",
    no_sessions:         "இன்னும் அரட்டை அமர்வுகள் இல்லை.",
    error_backend:       "பிழை: SmartBot-ஐ அடைய முடியவில்லை.",
    error_empty:         "கேள்வி காலியாக இருக்கக்கூடாது.",
    error_session:       "அமர்வை உருவாக்க முடியவில்லை.",
    member_since:        "உறுப்பினர் since",
    anonymous:           "அநாமதேயர்",
    open:                "திற",
    delete:              "நீக்கு",
  },

  fr: {
    welcome_title:       "Bienvenue sur SmartBot",
    welcome_subtitle:    "Votre assistant bancaire IA sécurisé. Posez des questions sur les produits, politiques, procédures ou toute question bancaire.",
    offline_mode:        "Mode hors ligne — réponses depuis vos documents uniquement",
    online_mode:         "Mode en ligne — réponses depuis les documents et internet",
    suggestion_1:        "Quels sont les critères d'éligibilité aux prêts ?",
    suggestion_2:        "Expliquez les taux d'intérêt fixes et variables",
    suggestion_3:        "Comment ouvrir un compte épargne ?",
    suggestion_4:        "Quels documents pour un prêt immobilier ?",
    suggested_followups: "Questions suggérées :",
    input_placeholder:   "Posez une question bancaire à SmartBot...",
    input_disclaimer:    "SmartBot peut faire des erreurs. Vérifiez toujours les informations importantes avec votre conseiller.",
    was_helpful:         "Était-ce utile ?",
    thanks_feedback:     "Merci pour votre retour !",
    sign_in:             "Se connecter",
    register:            "S'inscrire",
    logout:              "Déconnexion",
    profile_title:       "Modifier le profil",
    full_name:           "Nom complet",
    email:               "Email",
    password:            "Mot de passe",
    new_password:        "Nouveau mot de passe",
    confirm_password:    "Confirmer le mot de passe",
    save_changes:        "Enregistrer",
    preferences_title:   "Préférences",
    theme:               "Thème",
    language:            "Langue",
    notifications:       "Notifications",
    notifications_desc:  "Recevoir les mises à jour et alertes système",
    memory_depth:        "Profondeur de mémoire",
    memory_desc:         "Nombre de messages précédents mémorisés par l'IA",
    save_preferences:    "Enregistrer les préférences",
    chat_history:        "Historique des conversations",
    no_sessions:         "Aucune session de chat pour l'instant.",
    error_backend:       "Erreur : Impossible d'atteindre SmartBot.",
    error_empty:         "La question ne peut pas être vide.",
    error_session:       "Impossible de créer la session.",
    member_since:        "Membre depuis",
    anonymous:           "Anonyme",
    open:                "Ouvrir",
    delete:              "Supprimer",
  }
};

// ─────────────────────────────────────────────
// Translation function
// ─────────────────────────────────────────────
export function t(key, lang = "en") {
  const langData = translations[lang] || translations["en"];
  return langData[key] || translations["en"][key] || key;
}

// ─────────────────────────────────────────────
// RTL languages
// ─────────────────────────────────────────────
export const RTL_LANGUAGES = ["ar"];

export function isRTL(lang) {
  return RTL_LANGUAGES.includes(lang);
}

// ─────────────────────────────────────────────
// Auto-detect language from text
// ─────────────────────────────────────────────
export function detectLanguage(text) {
  if (!text || text.length < 3) return null;

  // Arabic — Unicode range \u0600-\u06FF
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  if (arabicChars / text.length > 0.2) return "ar";

  // Hindi — Devanagari \u0900-\u097F
  const hindiChars = (text.match(/[\u0900-\u097F]/g) || []).length;
  if (hindiChars / text.length > 0.2) return "hi";

  // Tamil — \u0B80-\u0BFF
  const tamilChars = (text.match(/[\u0B80-\u0BFF]/g) || []).length;
  if (tamilChars / text.length > 0.2) return "ta";

  // French — common French words
  const frenchWords = /\b(je|tu|il|elle|nous|vous|ils|elles|le|la|les|un|une|des|et|est|que|qui|dans|sur|avec|pour|par|mais|ou|donc|car|bonjour|merci|oui|non)\b/i;
  if (frenchWords.test(text)) return "fr";

  return "en";
}

// ─────────────────────────────────────────────
// Get current user language
// Priority: auto-detected > profile preference > browser > English
// ─────────────────────────────────────────────
export function getUserLanguage(detectedLang = null) {
  const prefs = JSON.parse(localStorage.getItem("user_prefs") || "{}");

  // If we have a detected language from the current message — ALWAYS use it.
  // The user is actively typing in that language; their intent is clear.
  // Profile preference is irrelevant when the message language is known.
  if (detectedLang) return detectedLang;

  // No message to detect from (e.g. initial page load) —
  // use profile preference as the UI display language.
  if (prefs.language) return prefs.language;

  // Browser language fallback
  const browserLang = navigator.language?.slice(0, 2);
  if (translations[browserLang]) return browserLang;

  return "en";
}

// ─────────────────────────────────────────────
// Language display names
// ─────────────────────────────────────────────
export const LANGUAGE_NAMES = {
  en: "English",
  ar: "العربية",
  hi: "हिन्दी",
  ta: "தமிழ்",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
};