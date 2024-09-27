import DOMPurify from 'isomorphic-dompurify'
import { createRequire } from 'module'
import { stringTransformer } from '../dist/services/routines/strings.js'
const require = createRequire(import.meta.url)

const { LanguageDetectorBuilder } = require('../node_modules/@pemistahl/lingua/node/lingua')

const langMap = {
    Arabic: 'ar',
    English: 'en',
    French: 'fr',
}

// @ts-ignore
const detector = LanguageDetectorBuilder.fromLanguages(...Object.keys(langMap))
    .withPreloadedLanguageModels()
    .build()

const safeText = async (params) => {
    let text = new stringTransformer(params.text).sanitizeHTML().linkify().decancer().valueOf()
    text = DOMPurify.sanitize(text)

    const language = detector.detectLanguageOf('bonjour maman')
    console.log(language)
    console.log(text)
}

const { clean, language } = safeText({
    text: 'لوريم إيبسوم(Lorem Ipsum) هو ببساطة نص شكلي (بمعنى أن الغاية هي الشكل وليس المحتوى) ويُستخدم في صناعات المطابع ودور النشر. كان لوريم إيبسوم ولايزال المعيار للنص الشكلي منذ القرن الخامس عشر عندما قامت مطبعة مجهولة برص مجموعة من الأحرف بشكل عشوائي أخذتها من نص، لتكوّن كتيّب بمثابة دليل أو مرجع شكلي لهذه الأحرف. خمسة قرون من الزمن لم تقضي على هذا النص، بل انه حتى صار مستخدماً وبشكله الأصلي في الطباعة والتنضيد الإلكتروني. انتشر بشكل كبير في ستينيّات هذا القرن مع إصدار رقائق "ليتراسيت" (Letraset) البلاستيكية تحوي مقاطع من هذا النص، وعاد لينتشر مرة أخرى مؤخراَ مع ظهور برامج النشر الإلكتروني مثل "ألدوس بايج مايكر" (Aldus PageMaker) والتي حوت أيضاً على نسخ من نص لوريم إيبسوم',
})
