/*
  'index.js' has access to DOM objects and runs on every page.
  This is why it should be safe because
  pages contain different HTML elements

  GLOBAL VARIABLES besides DOM objects are
  coming sequentially from imported scripts
  before 'index.js' is imported. These are variables renamed

  - new Tagify: https://github.com/yairEO/tagify
  - new Notyf: https://github.com/caroso1222/notyf
  - holmes: https://github.com/Haroenv/holmes
  - new autoComplete:  https://github.com/Pixabay/JavaScript-autoComplete
  - new Avatar: https://github.com/MatthewCallis/avatar
  - SVGInjector: https://github.com/iconic/SVGInjector
*/

// Browser logging to let hints for different environments
// on important events and actions.
import log from 'loglevel'
import { setupShared } from '../../shared/shared.js'

if (typeof __section__ !== 'undefined' && __section__ !== 'blogs')
    import(`../../style/style_${__section__}.scss`).then((s) => {
        console.log(`loaded ${__section__} style`)
    })
else
    import('../../style/style.scss').then((s) => {
        console.log('loaded generic style')
    })

import { consts, isDevEnv } from './consts.js'
console.log(process.env.NODE_ENV)
log.setDefaultLevel(consts.logLevel[process.env.NODE_ENV])

window.log = log
if (isDevEnv) {
    console.log(`Successes: ${window.__successes__}`)
    console.log(`Errors: ${window.__errors__}`)
    console.log(`Id: ${window.__id__}`)
    console.log(`Latitude: ${window.__lat__}`)
    console.log(`Longitude: ${window.__lng__}`)
    console.log(`Initials: ${window.__initials__}`)
    console.log(`Section: ${window.__section__}`)
}

console.log(
    ' compiled under environment:',
    process.env.NODE_ENV,
    '\n',
    'compiled for domain:',
    consts.APIHost[process.env.NODE_ENV],
    '\n',
)

setupShared()
