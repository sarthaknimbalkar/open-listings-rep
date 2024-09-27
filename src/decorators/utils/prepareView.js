// @flow

/**
 * THIS DECORATOR IS TO BE REFACTORED !!! IT SEEMS COMPLEX BECAUSE IT RELIES ON EARLIER VALIDATORS AND THE SPECIFIC ROUTES BEFORE BEING CALLED
 * EACH VALIDATORS AND/OR ROUTE LEAVES DIFFERENT VARIABLES (AJV, ZXCVBN, PIPELINE ETC), THIS IS WHY KEYS IN OBJECTS "CONTEXT" LOOK LIKE A BLACK BOX
 */

import { createRequire } from 'module'
import { config } from '../../utils.js'
import constraints from '../../constraints/constraints.js'

import type { FastifyRequest, FastifyReply } from 'fastify'

const require = createRequire(import.meta.url)
const ajvLocalize = {
    ar: require('ajv-i18n/localize/ar'),
    en: require('ajv-i18n/localize/en'),
    'en-US': require('ajv-i18n/localize/en'),
    fr: require('ajv-i18n/localize/fr'),
}

// const COOKIE_NAME = config('COOKIE_NAME')

/**
 * `prepareView` is a reply decorator ie: It is a customization of `request.view` of Fastify
 *
 * @param {*} context is like [data, route, kind] where data holds
 * a lot of values to be sent to user
 * Note: `this` is a Fastify object in the context of calling this
 * It's a function inside a request handler so this.request is simply the request object
 */
export default function prepareView(context) {
    const request: FastifyRequest = this.request
    if (
        [
            'SERVER_ERROR',
            'VALIDATION_ERROR',
            'NOT_FOUND',
            'INCORRECT_TOKEN',
            'ALREADY_VERIFIED',
            'BAD_EMAIL',
            'EMAIL_TAKEN',
            'UNAUTHORIZED',
        ].indexOf(context[2]) >= 0
    ) {
        this.statusCode = 599
    }
    // (1) GET CURRENT USER IF LOGGED IN
    let user = {}
    if (request.session) user = request.session.get('user') || {}
    Object.assign(context[0], { user })

    // (2) When user is "posting" data, Send back same data again with
    // proper "reduction of passwords or sensitive data"
    // to fill input forms (it helps when there was an error)
    if (request.body && request.method === 'POST') {
        let formData = JSON.parse(JSON.stringify(request.body))
        // Removing password keys
        for (let key in formData) {
            if (Object.prototype.hasOwnProperty.call(formData, key) && key.indexOf('pass') > -1) {
                // redact password fields
                delete formData[key]
            }
        }
        Object.assign(context[0], { formData })
    }

    // (3) localize using i18next for more user friendly messages
    let userFriendlyMsg = {}
    try {
        userFriendlyMsg = localize(context[0], context[1], context[2], request, this)
    } catch (err) {
        request.log.error(`prepareView/localize: ${err.message}`)
    }

    // (4) reconstruct final object holding everything for templates
    const route = context[1]
    const routeConstraints = constraints[config('NODE_ENV')].GET[route]
    const UXConstraints = routeConstraints ? { UXConstraints: routeConstraints } : {}
    const final = { ...userFriendlyMsg, ...UXConstraints }

    if (Array.isArray(final['error']) && final['error'].length) {
        if (route === 'message') {
            final['message'] = final['error'].join('\n')
        }
        this.statusCode = 599
    }

    return this.view(`./pages/${route}`, final)
}

const appName = config('APP_NAME')
/**
 * `localize` uses i18next for more user-friendly messages
 * It maps messages (multilingual) to routes in different contexts
 * @param {*} route abstracts the requested route/resource
 * @param {*} kind abstracts the response route. An Eta (~ Ejs) view or an indication of the kind/context of response
 * @param {*} data is the additional data to take into account
 * @param {FastifyRequest} req request object to derive localized messages from
 * @param {FastifyReply} reply reply object to derive flash messages from
 */
function localize(data, route, kind, req: FastifyRequest, reply: FastifyReply) {
    // (1) commonly we have section and subtitle specified
    // these are used for custom messages like
    // Hey user, welcome to "market" page
    const { section, subtitle } = data
    const sharedData = {
        app_name: appName,
        returnObjects: true,
        section,
        subtitle,
    }
    // TODO: handle errors here !
    // a translation could easily be missing !
    // (3) Some announcements (news) the admin pushes for all pages.
    data['announcements'] = req.t(`announcements`, { app_name: appName, returnObjects: true })
    // (4) Actual translation depending on route and its kind, customized by other values (section, subtitle, etc)
    const userFriendlyMsg: { success: any, error: any, suggestions: any, meta: any, intro: any } = req.t(
        `${route}.${kind}`,
        sharedData,
    )
    if (userFriendlyMsg === `${route}.${kind}`) {
        req.log.error(`prepareView/localize: there is no translation for "${route}.${kind}"`)

        return data
    }

    // req.t returns undefined for empty strings
    // Object.keys(userFriendlyMsg).forEach((key) => {
    //     if (key === 'success' || key === 'error') {
    //         userFriendlyMsg[key] = userFriendlyMsg[key] ? userFriendlyMsg[key] : []
    //     }
    // })

    // The following gets back flashed success or failure messages
    // added in the current request lifecycle (here for ex in `pipeline#listingValidation`)
    // It does not work when session is not yet created! (It works only for logged in users)
    const getOneFlash = (key) => {
        try {
            return reply.flash(key) && reply.flash(key).length ? reply.flash(key)[0] : []
        } catch (error) {
            // in case session does not exist. Find a way to add error without 'flash'
            return []
        }
    }
    try {
        userFriendlyMsg['success'] = userFriendlyMsg['success'] ? [userFriendlyMsg['success']] : getOneFlash('success')
        userFriendlyMsg['error'] = userFriendlyMsg['error'] ? [userFriendlyMsg['error']] : getOneFlash('error')
    } catch (error) {
        req.log.error(`prepareView/localize/flash: ${error.message}`)
    }

    // Internationalize and reformat (flattening) of AJV validation errors to send to client
    let warnings = []
    let suggestions = []
    warnings = formatAjvToLocals(req.validationError, req)

    // Zxcvbn errors (only in signup router)
    if (route === 'signup')
        if (data.suggestions || data.suggestions?.length) {
            suggestions = suggestions.concat(data.suggestions)
        }
    if (data.warning || data.warnings?.length) {
        warnings = warnings.concat(data.warnings)
    }
    // Concatenate all errors:
    // warning: which are errors generated prior to calling prepareView:
    //     a) `pipeline#listingValidation`: data.errors
    //     b) AJV: warnings
    //     c) ZXCVBN: warnings
    //     d) `error` generated in `common.json` namespace
    // back in `userFriendlyMsg.error`
    data.errors = [data.errors].flat().filter(Boolean)

    // userFriendlyMsg.error is not iterable
    if (userFriendlyMsg?.error?.length || data.errors.length || warnings.length) {
        userFriendlyMsg.error = [...warnings, ...data.errors, ...userFriendlyMsg.error].filter(Boolean)
    } else userFriendlyMsg.error = []

    delete data.errors
    // TODO: Add suggestions to toasty on UI
    userFriendlyMsg.suggestions = suggestions.filter(Boolean)
    userFriendlyMsg['meta'] = userFriendlyMsg['intro'] ? userFriendlyMsg['intro'] : ''
    return Object.assign(userFriendlyMsg, data)
}

const translations = {
    div_q: 'Département',
    firstName: 'Prénom',
    secondName: 'Nom',
    bio: 'Biographie',
    username: 'Email',
    password: 'Mot de passe',
    title_desc: 'Titre et description de la recherche',
    desc: "Description: le text de l'annonce",
    title: "Titre de l'annonce",
    message: "Message: le text de l'enveloppe",
}

const translate = (str, missingProperty) => {
    const translation = translations[missingProperty]
    if (!translation) return str

    return str.replace(missingProperty, translation)
}

export function formatAjvToLocals(validationError, request: FastifyRequest) {
    if (validationError?.validation) {
        const lang = ['en', 'en-US', 'fr', 'ar'].indexOf(request['locale']) > -1 ? request['locale'] : 'en'
        ajvLocalize[lang](request.validationError.validation)
        let warnings = request.validationError.validation.map((err) => {
            if (lang === 'fr') {
                return `"${err.instancePath || ''}" ${translate(err.message, err.params?.missingProperty)}`
            }
            return `"${err.instancePath || ''}" ${err.message}`
        })
        return warnings
    } else return []
}
/**
 * Examples
 * {post, get}('listings/^\/(markets|skills|blogs)/') => 'listings.markets'
 * post('listings/textSearch') => 'listings.textSearch' or 'listings.not found' or 'listings.SERVER_ERROR'
 * {post, get}('listings/id/:id/') => 'listing.id' or 'listing.not found' or 'listing.SERVER_ERROR'
 * get('listings/tags') => 'tags.tags'
 */
