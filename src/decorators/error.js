// @flow

import { createRequire } from 'module'
import { NODE_ENV } from '../utils.js'

import pkg from 'fastify-multer'
const { MulterError } = pkg

import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify'

const require = createRequire(import.meta.url)
const localize = {
    ar: require('ajv-i18n/localize/ar'),
    en: require('ajv-i18n/localize/en'),
    'en-US': require('ajv-i18n/localize/en'),
    fr: require('ajv-i18n/localize/fr'),
}

export default async function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
    if (reply.statusCode === 429) {
        // error.message = 'You hit the rate limit! Slow down please! Please try again later'
        error.message = 'Vous avez atteint la limite de débit!'
        reply.status(429).send(error)

        return reply
    }
    if (error.validation) {
        localize[request.cookies.locale || 'en'](error.validation)
        reply.status(422).send(error.validation)

        return reply
    }

    if (error instanceof MulterError) {
        // error.message = 'An error occurred uploading the image :( Please try again later'
        error.message = 'Une erreur s\'est produite lors du téléchargement de l\'image :( Veuillez réessayer plus tard'
        // request.flash('error', 'An error occured uploading the image :( Please try again later')
        reply.status(418).send(error)

        return reply
    }

    error.message = error.message.slice(0, 3000)
    request.log.error(error)
    // error.message = 'Server is having hard times :( Please try again later.'
    error.message = 'Le serveur rencontre des difficultés :( Veuillez réessayer plus tard.'
    if (NODE_ENV === 'api') throw error

    reply.status(409).send(error)

    return reply
}
