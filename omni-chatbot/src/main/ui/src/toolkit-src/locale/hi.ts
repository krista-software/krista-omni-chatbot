export const locale_hi = {
  krista: {
    general: {
      defaultErrorMessage: "कुछ गलत हो गया। कृपया बाद में पुन: प्रयास करें।",
      ok: "ठीक",
      search: "खोज",
      cancel: "रद्द करना",
      clear: "साफ़",
      remove: "निकालना",
      delete: "हटाएं",
      save: "सहेजें",
      noResults: "कोई प्रविष्टियाँ नहीं मिलीं",
      selectAll: "सबका चयन करें",
      unknownField: "अज्ञात फ़ील्ड",
      enterCorrectValues: "सुनिश्चित करें कि आप उचित मान दर्ज करें",
    },
    address: {
      street: "गली",
      street2: "गली # 2",
      city: "शहर",
      state: "राज्य",
      country: "देश",
      postalCode: "डाक कोड",
    },
    table: {
      deletedRows: "हटाई गई पंक्तियाँ",
      selectedRows: "चयनित पंक्तियाँ:",
      rowsPerPage: "प्रति पृष्ठ पंक्तियाँ:",
      noData: "प्रदर्शित करने के लिए कोई पंक्तियाँ उपलब्ध नहीं हैं.",
      confirmDelete: "क्या आप वाकई स्थायी रूप से हटाना चाहते हैं?",
    },
    entity: {
      authRequired:
        "प्रमाणीकरण आवश्यक। जारी रखने के लिए नीचे 'प्रमाणित करें' पर क्लिक करें।",
      searchAgainAfterAuth:
        "प्रमाणीकरण पूर्ण होने के बाद, इस विंडो पर वापस आएं। परिणाम देखने के लिए फिर से खोजें।",
      authenticate: "प्रमाणित करें",
      selectAllHelpText: "इस पृष्ठ पर सभी विकल्पों का चयन करें",
      selected: "चयनित",
    },
    file: {
      atLeastOneUploadOption:
        "फ़ाइल सेटिंग्स में कम से कम एक अपलोड विकल्प चयनित होना चाहिए।",
      unknownFormat:
        "{{filename}} अपलोड नहीं किया जा सका. अज्ञात फ़ाइल स्वरूप.",
      unknownFileFormat: "फ़ाइल अपलोड नहीं हो सकी. अज्ञात फ़ाइल स्वरूप.",
      notSupported:
      "{{filename}} अपलोड नहीं किया जा सका। फ़ाइल प्रारूप समर्थित नहीं है, इसे एक ZIP फ़ाइल में संकुचित करें और पुनः अपलोड करें।",
      typeNotSupported: "{{filename}} अपलोड नहीं किया जा सका। फ़ाइल प्रकार समर्थित नहीं है।",
      minSize:
        "{{filename}} अपलोड नहीं किया जा सका. फ़ाइल का आकार {{size}} से अधिक होना चाहिए.",
      maxSize:
        "{{filename}} अपलोड नहीं किया जा सका। फ़ाइल का आकार {{size}} से कम होना चाहिए",
      uploadInProgress: "फ़ाइल अपलोड प्रगति पर है.",
    },
    location: {
      grantPermission: "स्थान की अनुमति प्रदान करें",
      selectLocation: "स्थान चुनें",
      selectedLocation: "चयनित स्थान",
    },
    date: {
      selectAfter: "{{date}} के बाद की तारीख चुनें",
      selectOnOrAfter: "{{date}} को या उसके बाद की तारीख चुनें",
      select: "चुनना {{date}}",
      selectBefore: "{{date}} से पहले की तारीख चुनें",
      selectOnOrBefore: "{{date}} को या उससे पहले की तारीख चुनें",
      selectBeforeOrAfterDate: "{{date}} से पहले या बाद की तारीख चुनें",
      selectBeforeDateOrAfterDate:
        "{{before}} से पहले या {{after}} के बाद की तारीख चुनें",
      selectBetween: "{{min}} और {{max}} के बीच की तारीख चुनें",
    },
    dateRange: {
      selectBetween: "{{min}} और {{max}} के बीच एक दिनांक सीमा चुनें",
      selectOnOrAfter: "{{min}} को या उसके बाद की तारीख सीमा चुनें",
      selectOnOrBefore: "{{max}} पर या उससे पहले एक तिथि सीमा चुनें",
      selectMaxDays: "अधिकतम {{days}} दिन चुनें",
      selectMaxHours: "अधिकतम {{hours}} घंटे चुनें",
      rulesConflict:
        "चयनित नियम विरोधित हैं, कृपया एक वैध तारीख रेंज को अनुमति देने के लिए समायोजित करें।",
    },
    radio: {
      noSelection: "कोई विकल्प चयनित नहीं.",
      noOptions: "विकल्प उपलब्ध नहीं हैं.",
    },
    validators: {
      startDateLessThanEndDate: "आरंभ तिथि अंतिम तिथि से कम होनी चाहिए.",
      allowedEmailDomains: "अनुमत डोमेन: {{domains}}.",
      maxDateRangeInDays: "सीमा {{days}} दिन से अधिक नहीं होनी चाहिए।",
      maxDateRangeInHours: "सीमा {{hours}} घंटे से अधिक नहीं होनी चाहिए।",
      maxLength: "लंबाई {{length}} से कम या उसके बराबर होनी चाहिए.",
      minLength: "लंबाई {{length}} से अधिक या उसके बराबर होनी चाहिए।",
      maxSelection: "{{count}} से अधिक विकल्पों का चयन नहीं किया जा सकता।",
      minSelection: "कम से कम {{count}} विकल्प चुनें।",
      maxValue: "मान {{max}} से कम या उसके बराबर होना चाहिए।",
      minValue: "मान {{min}} से अधिक या उसके बराबर होना चाहिए।",
      pattern: "मान आवश्यक पैटर्न से मेल नहीं खा रहा है: {{pattern}}",
      invalidPhoneNumber: "अवैध फोन नंबर।",
      required: "यह फ़ील्ड आवश्यक है.",
    },
  },
};
