// @flow


import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const { LanguageDetectorBuilder } = require('../../../node_modules/@pemistahl/lingua/node/lingua')

const langMap = {
    Arabic: 'ar',
    English: 'en',
    French: 'fr',
}

const detector = LanguageDetectorBuilder.fromLanguages(...Object.keys(langMap))
    .withPreloadedLanguageModels()
    .build()

export const safeText = async (params) => {
    // remove quilljs default <p>...</p> wrapping p tags (and all other ps / no problem)
    // params.text = params.text.replaceAll(/<\/?p[^>]*>/g, '')

    params.text = params.text.replaceAll(/<p><br><\/p>/g, '<br>')
    params.text = params.text.replaceAll(/<br><br>/g, '<br>')
    const clean = params.text.replace(/<[^>]*>?/gm, ' ').trim()
    const language = detector.detectLanguageOf(clean)

    return {
        clean,
        // language: 'en',
        language: langMap[language] ?? 'und',
        text: params.text,
    }
}
