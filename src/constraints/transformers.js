// @ts-nocheck
import emailToName from 'email-to-name'
import { ObjectId } from 'mongodb'
import { config, dataStores, hashCode } from '../utils.js'
import * as Crypto from '../services/routines/crypto.js'

const Trans = {}

/**
 * (can add seconds each time)
 * Creates an ObjectId from the specified datetime value
 * @param {Date | string | number} date datetime value or timestamp in milliseconds
 * @returns
 */
export const objectIdFromDate = (date, seconds) => {
    const t = new Date(date)
    if (seconds) t.setSeconds(t.getSeconds() + seconds)
    const time = new Date(t).getTime() / 1000
    const id = ObjectId.createFromTime(time)
    return id.toHexString()
}

/**
 * Returns the generation date (accurate up to the second) that this ID was generated.
 * @param objectId objectId
 */
export const dateFromObjectId = (objectId) => {
    return new ObjectId(objectId).getTimestamp().toISOString().substring(0, 10)
}

// eslint-disable-next-line no-unused-vars
Trans['createTime'] = (obj, seconds) => {
    // if (obj['createdAt']) obj['_id'] = objectIdFromDate(new Date(obj['createdAt']))
    // else

    // For MongoDB calculate 'createdAt' from it's '_id' just to enrich the object (to be the same as NeDB)
    if (dataStores._isMongo) obj['createdAt'] = dateFromObjectId(obj['_id'])

    // At creation time, make sure we control _id (using dates)
    if (!dataStores._isMongo) obj['_id'] = objectIdFromDate(new Date(), seconds)
}

Trans['toCssClass'] = (someListing) => {
    someListing.a = someListing.a ? '' : 'nonapproved'
    someListing.d = someListing.d ? 'deactivated' : ''
}

const removeAccents = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

Trans['normalize'] = (someListing, fields) => {
    fields.forEach((field) => {
        if (someListing[field]) someListing[field] = removeAccents(someListing[field])
    })
}

Trans['redact'] = (someListing, fields) => {
    fields.forEach((field) => {
        delete someListing[field]
    })
}

Trans['sanitize'] = (someListing, fields) => {
    fields.forEach((field) => {
        if (someListing[field]) someListing[field] = someListing[field].replace(/<[^>]*>?/gm, ' ').trim()
    })
}

// Trans['get'] = (someListing, fields) => {
//     fields
//         .filter(key => key in someListing) // line can be removed to make it inclusive
//         .reduce((obj2, key) => (obj2[key] = someListing[key], obj2), {});
// }

const key = Crypto.passwordDerivedKey(config('PASSWORD'))
/**
 *
 * @param {Types.Comment} someComment
 * @param {string} username
 */
Trans['comment'] = (someComment, username) => {
    someComment.type = 'comment'
    if (someComment.from === username) {
        someComment['peer'] = emailToName.process(someComment.to)
        someComment['direction'] = 'sender'
    } else {
        someComment['peer'] = emailToName.process(someComment.from)
        someComment['direction'] = 'receiver'
    }
    someComment.from = Crypto.encrypt(key, someComment.from)
    someComment.to = Crypto.encrypt(key, someComment.to)
    someComment.threadHash = hashCode(someComment.thread)
}

Trans['geopoint'] = (someListing) => {
    if (someListing.lng)
        someListing['geolocation'] = {
            coordinates: [parseFloat(someListing.lng), parseFloat(someListing.lat)],
            type: 'Point',
        }
}

function traceMethodCalls(obj) {
    let handler = {
        get(target, propKey) {
            const origMethod = target[propKey]
            return (...args) => {
                try {
                    if (Array.isArray(args[0])) args[0].forEach((arg) => origMethod.call(this, arg, args[1]))
                    else origMethod.call(this, args[0], args[1])
                } catch (error) {
                    console.log(
                        `An error occurred calling "Transformer#${propKey}" method with arguments ${JSON.stringify(
                            args[1],
                        )}`,
                    )
                    console.log(error.message)
                }
            }
        },
    }
    return new Proxy(obj, handler)
}
/**
 * always call functions like this:
 * const ob = {a: true, d: true}
 * Transformer['toCssClass'](ob, 2)
 * or like this
 * Transformer['toCssClass']([ob], 2)
 * arguments must be in this order
 * and correct according to Trans object methods
 */
export default traceMethodCalls(Trans)
