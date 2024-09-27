// @flow

import Datastore from '@seald-io/nedb'
import { bold, magenta } from 'colorette'
import { config as dotenv } from 'dotenv'
import { createRequire } from 'module'
import path from 'path'
import pupa from 'pupa'
import { fileURLToPath } from 'url'

import type { MongoClient, Collection } from 'mongodb'
import type { FastifyInstance } from 'fastify'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv({ path: path.join(__dirname, `../.${process.env.APP_NAME}.env`) })
process.title = process.env.APP_NAME || 'open-listings'
process.env.NODE_CONFIG_DIR = './src/config'
const nodeConfig = require('config')
console.warn(`Running on Node environment ?: ${process.env.NODE_ENV} == ${config('ENVIRONMENT')}`)

export const NODE_ENV = process.env.NODE_ENV

export function config(key: string, secretValues: Object): string | Object {
    if (process.env[key]) {
        // if(NODE_ENV === 'api') console.log(`Attempting to access key: ${key}. We are having configuration: ${process.env[key]}`)
        if (process.env[key] === 'true' || process.env[key] === 'false') return process.env[key] === 'true'
        return process.env[key]
    }
    if (!nodeConfig.has(key)) {
        console.error(`Attempting to access key: ${key}, but there is no such configuration !`)
        return
    }
    const stringRes = JSON.stringify(nodeConfig.get(key))
    if (!secretValues) secretValues = {}
    Object.assign(secretValues, process.env)
    const objRes = JSON.parse(pupa(stringRes, secretValues))
    // if(NODE_ENV === 'api') console.log(`Attempting to access key: ${key}. We are having configuration: ${JSON.stringify(objRes)}`)
    return objRes
}

export function Logger(fastify: FastifyInstance) {
    this.log = (s: string) => {
        if (fastify) fastify.log.info(s)
        console.log(bold(magenta(s)))
    }
}

export const dataStores = {
    _isMongo: process.env['IS_MONGO_DB'] === 'true',
    mongo: null,
}

/**
 * To simply call `db.collection(name)`: Override nedb API to resemble MongoDB one
 * // Switch between two types when developing
 * // import('mongodb').Collection
 * @returns {import('@seald-io/nedb').default}
 */
export function initCollection(mongo: MongoClient, name: string): Collection<> {
    if (dataStores[name]) return dataStores[name]
    if (dataStores._isMongo) {
        dataStores[name] = mongo.collection(name)
        return dataStores[name]
    }

    dataStores[name] = new Datastore({
        filename: path.join(__dirname, '..', 'nedb', name + '.db'),
        autoload: true,
        timestampData: true,
    })
    return dataStores[name]
}

export function hashCode(s: string): number {
    let h, i
    for (h = 0, i = 0; i < s.length; h &= h) h = 31 * h + s.charCodeAt(i++)
    return h
}

export const ajvLocalize = {
    ar: require('ajv-i18n/localize/ar'),
    en: require('ajv-i18n/localize/en'),
    'en-US': require('ajv-i18n/localize/en'),
    fr: require('ajv-i18n/localize/fr'),
}

export function currentLang(req) {
    return (req.i18n && req.i18n.language) || req.cookies.locale || 'fr'
}