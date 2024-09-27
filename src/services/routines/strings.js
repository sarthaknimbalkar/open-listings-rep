// @flow
import { createRequire } from 'module'
import slug from 'slug'

import { html, nonLatin, reb, rew } from '../../constraints/regex.js'

// Remove non latin
// Credit
// Author: rjanjic
// Source: https://stackoverflow.com/a/22075070
let wordsInText = (text) => text.match(nonLatin)

// Turn a bad title to a good one
// "hello this is a-- nice @ tit buttyyyy it is very longgggggggggg"
// 'hello this is a nice tit hello'
function toTitle(longBadTitle: string, limit = 60) {
    // Remove non latin
    longBadTitle = longBadTitle.charAt(0).toUpperCase() + longBadTitle.slice(1)
    longBadTitle = wordsInText(longBadTitle).join(' ')
    if (longBadTitle < 10) throw Error('very bad title')
    if (longBadTitle.length < limit) return longBadTitle
    let type = ''
    let title = longBadTitle.split(' ').reduce((acc, word) => {
        if (!acc) return word
        if (acc.length >= limit || acc.length > limit - 3) return acc
        if (acc.length + word.length >= limit) {
            if (word.length < 6) return acc + ' ' + word
            return (acc + ' ' + word).slice(0, limit)
        } else {
            return acc + ' ' + word
        }
    }, type)
    return title
}

/**
 * Generate initials from an email string
 * Like "sracer2024@yahoo.com" => "S2"
 */
function initials(email_: string): string {
    let email =
        email_
            .split('@')[0]
            .replace(/[0-9]/g, '')
            .split(/[.\-_]/) || []
    if (email.length === 1) {
        return email[0].slice(0, 2).toUpperCase()
    }
    email = ((email.shift()[0] || '') + (email.pop()[0] || '')).toUpperCase()
    return email
}

// https://www.npmjs.com/package/text-ellipsis
// var short = textEllipsis('a very long text', 10);
// console.log(short);
// // "a very ..."

// var short = textEllipsis('a very long text', 10, { side: 'start' });
// console.log(short);
// // "...ng text"

// var short = textEllipsis('a very long text', 10, { textEllipsis: ' END' });
// console.log(short);
// // "a very END"

function truncate(str, maxLength, { side = 'end', ellipsis = '...' } = {}) {
    if (str.length > maxLength) {
        switch (side) {
            case 'start':
                return ellipsis + str.slice(-(maxLength - ellipsis.length))
            case 'end':
            default:
                return str.slice(0, maxLength - ellipsis.length) + ellipsis
        }
    }
    return str
}

const arabic = {
    ء: 'ء',
    ا: 'ا',
    أ: 'أ',
    إ: 'إ',
    آ: 'آ',
    ؤ: 'ؤ',
    ئ: 'ئ',
    ب: 'ب',
    ت: 'ت',
    ث: 'ث',
    ج: 'ج',
    ح: 'ح',
    خ: 'خ',
    د: 'د',
    ذ: 'ذ',
    ر: 'ر',
    ز: 'ز',
    س: 'س',
    ش: 'ش',
    ص: 'ص',
    ض: 'ض',
    ط: 'ط',
    ظ: 'ظ',
    ع: 'ع',
    غ: 'غ',
    ف: 'ف',
    ق: 'ق',
    ك: 'ك',
    ل: 'ل',
    م: 'م',
    ن: 'ن',
    ه: 'ه',
    و: 'و',
    ي: 'ي',
    ة: 'ة',
    ى: 'ى',
}
slug.extend(arabic)

function slugify(str, opt) {
    return opt ? slug(str, opt) : slug(str)
}

export { initials, toTitle, truncate, slugify }
