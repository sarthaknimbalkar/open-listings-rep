// @flow

import { Mutex } from 'async-mutex'
import { ObjectId, ReturnDocument } from 'mongodb'
import perPage from '../../config/options/perPage.js'
import { config, dataStores } from '../../utils.js'
import {
    Blog,
    Comment,
    CommentModel,
    Event,
    Hobby,
    ListingModel,
    Market,
    Skill,
    User,
    UserModel,
    UserProfile,
} from '../../constraints/models.js'
import { default as trans, default as transformers } from '../../constraints/transformers.js'
import * as Strings from '../../services/routines/strings.js'
import { GetListingById, GetListingsSince } from './mongo-protobuff.js'
import { EphemeralData } from '../helpers.js'
import { refreshTopK } from '../miner.js'

import { Collections, Sections } from '../../types.d.js'
import type { Collection, FilterQuery, Projection, CollationOptions } from 'mongodb'
import type { Nedb } from '@seald-io/nedb'
import type { Redis } from 'ioredis'
import type { Mutex as MutexType } from 'async-mutex'

// Only to keep quite VSCode TS
ListingModel.a = true
UserModel.isVerified = true
CommentModel.sent = new Date()

/**
 * This function returns an ObjectId embedded with a given dateTime
 * Accepts number of days since document was created
 *
 * Author: https://stackoverflow.com/a/8753670/1951298
 * @param {Number} days
 * @return {object}
 */
function getObjectId(days) {
    const yesterday = new Date()
    days = days || 14
    yesterday.setDate(yesterday.getDate() - days)
    const hexSeconds = Math.floor(yesterday.getTime() / 1000).toString(16)
    const strValue = hexSeconds + '0000000000000000'
    if (dataStores._isMongo) return new ObjectId(strValue)
    return strValue
}

export default function (redisDB: Redis, log) {
    let locks: Map<string, MutexType> = new Map()

    let collection: Collection | Nedb

    const baseQuery: FilterQuery = { a: true, d: false }
    const baseProjection: Projection = { a: 0.0, d: 0.0, geolocation: 0.0 }
    const baseSort = ['_id'] //'desc'
    const baseCollation: CollationOptions = { locale: 'simple', normalization: true }

    this.getFilters = async function () {
        collection = dataStores[Collections.Filters]
        return await collection.find()
    }

    this.insertFilter = async function (id, filter) {
        collection = dataStores[Collections.Filters]
        await collection.updateOne({ _id: new ObjectId(id) }, { $set: filter }, { upsert: true })
    }

    /**
     * Insert a document into DB
     * @param {ListingModel} elem
     * @return {Promise}
     */
    this.insertListing = async function (elem) {
        // log('#### insertListing')
        let listingDoc
        switch (elem.section) {
            case Sections.Markets:
                listingDoc = new Market(elem)
                break
            case Sections.Skills:
                listingDoc = new Skill(elem)
                break
            case Sections.Blogs:
                listingDoc = new Blog(elem)
                break
            case Sections.Events:
                listingDoc = new Event(elem)
                break
            case Sections.Hobbies:
                listingDoc = new Hobby(elem)
                break
            default:
                throw new Error('Should not happen')
        }

        listingDoc.title = Strings.toTitle(listingDoc.title, 30)
        // https://stackoverflow.com/a/59841285/1951298
        trans['geopoint'](listingDoc)
        transformers['createTime'](listingDoc)

        collection = dataStores[Collections.Listing]
        const id = dataStores._isMongo
            ? (await collection.insertOne(listingDoc)).insertedId
            : (await collection.insertAsync(listingDoc))['_id']
        return id
    }

    /**
     * Insert a document -message into DB
     * @param {CommentModel} elem a JSON representation of a Listing
     * @return {Promise}
     */
    this.insertComment = async function (elem) {
        // log('#### insertComment')
        let commentDoc = new Comment(elem)

        commentDoc.thread = Strings.toTitle(commentDoc.thread, 30)
        transformers['createTime'](commentDoc)

        collection = dataStores[Collections.Comment]
        const id = dataStores._isMongo
            ? (await collection.insertOne(commentDoc)).insertedId
            : (await collection.insertAsync(commentDoc))['_id']

        return id
    }

    // up-ids cached [doc._id] (only updated documents)
    // glid-@@@@@@@@@@@@ cached document
    // gls-#### cached pages

    // Cache mechanism
    // update doc then add it to up-ids[doc._id] with up = 3
    // 1- getListingById
    // if cached check:
    //  is doc up (up-ids[doc._id] ===1) do nothing proceed happily
    //  is doc up (up-ids[doc._id] ===3 or up-ids[doc._id]===2),
    //      then remove cache
    // get new doc from DB, down up-ids
    //      (up-ids[doc._id] ===3 ==> [doc._id] = 1) or (up-ids[doc._id] ===2 ==> [doc._id] = 0)
    //       and add it to glid-@@@@@@@@@@@@
    // 2- getListingsSince
    // if cached check:
    //  is doc up (up-ids[doc._id] ===2) do nothing proceed happily
    //  is doc up (up-ids[doc._id] ===3 or up-ids[doc._id]===1),
    //      then remove cache
    // get new doc from DB, down up-ids
    //      (up-ids[doc._id] ===3 ==> [doc._id] = 2) or (up-ids[doc._id] ===1 ==> [doc._id] = 0)
    //       and add it to gls-####

    // glid:${id}
    // redis> HSET glid id 3
    // (integer) 1
    // redis> HSET myhash id 2
    // (integer) 1
    // redis> HKEYS myhash
    // 1) "id1"
    // 2) "id2"

    /**
     * Get a document from DB
     * If Admin then get unapproved document
     * @param {String} id Id of a Listing
     * @param {Boolean} isAdmin if the caller is admin
     * @param {String} viewer
     * @return {Promise<Object | undefined>}
     */
    this.getListingById = async function (id, isAdmin, viewer) {
        // log('#### getListingById')
        if (!locks.has(id)) locks.set(id, new Mutex())
        const release = await locks.get(id).acquire()
        try {
            const canView = (doc) => isAdmin || doc.usr === viewer || (doc['a'] && !doc['d'])
            const unique = `glid:${id}`
            const useCache = config('IS_REDIS_CACHE') && (await redisDB.exists(unique)) // && false

            const query = {}
            const projection = { geolocation: 0.0 }
            if (useCache) {
                const upLevel = (await redisDB.hget(`up-ids`, id)) || '1'
                if (upLevel === '1') {
                    const buffer = await redisDB.getBuffer(unique)
                    let cachedQResult = new GetListingById().decodeBuffer(buffer)
                    // log(cachedQResult)
                    release()
                    if (canView(cachedQResult)) return cachedQResult
                    else return
                }
                if (upLevel === '2' || upLevel === '3') await redisDB.del(unique)
            }

            collection = dataStores[Collections.Listing]
            query._id = dataStores._isMongo ? new ObjectId(id) : id
            const listingDoc = dataStores._isMongo
                ? await collection.findOne(query, { projection: projection })
                : await collection.findOneAsync(query).projection(projection)

            // document has been removed from DB or doesn't exist at all
            if (!listingDoc) {
                if (config('IS_REDIS_CACHE')) {
                    await redisDB.hdel(`up-ids`, id)
                    if (useCache) await redisDB.del(unique)
                }
                release()
                return
            }
            // transformers['createTime'](listingDoc)
            if (canView(listingDoc)) {
                // @ts-ignore override _id to its string representation
                listingDoc._id = listingDoc._id.toHexString ? listingDoc._id.toHexString() : listingDoc._id
                const buffer = new GetListingById().getBuffer(listingDoc)
                if (config('IS_REDIS_CACHE')) {
                    await redisDB.setBuffer(unique, buffer, 'EX', 3600)
                    const upLevel = (await redisDB.hget(`up-ids`, id)) || '1'
                    // log(`current document level ${upLevel}`)
                    if (upLevel === '2') await redisDB.hdel(`up-ids`, id)
                    if (upLevel === '3') await redisDB.hset(`up-ids`, id, '1')
                }
                release()
                return listingDoc
            } else {
                release()
            }
        } catch (error) {
            release()
            throw error
        }
    }

    /**
     * Delete a document from DB
     * Only if viewer is admin or author
     * @param {String} id Id of a Listing
     * @param {Boolean} isAdmin if the caller is admin
     * @param {String} viewer
     * @return {Promise<Object | undefined>}
     */
    this.deleteListingById = async function (id, isAdmin, viewer) {
        // log('#### deleteListingById')
        if (!locks.has(id)) locks.set(id, new Mutex())
        // @ts-ignore
        const release = await locks.get(id).acquire()
        try {
            const canDelete = (doc) => isAdmin || doc.usr === viewer
            const unique = `glid:${id}`
            const cached = config('IS_REDIS_CACHE') && (await redisDB.exists(unique)) // && false

            const query = {}

            collection = dataStores[Collections.Listing]
            query._id = dataStores._isMongo ? new ObjectId(id) : id
            const listingDoc = dataStores._isMongo
                ? await collection.findOne(query)
                : await collection.findOneAsync(query)

            // document has been removed from DB or doesn't exist at all
            if (!listingDoc) {
                if (config('IS_REDIS_CACHE')) {
                    await redisDB.hdel(`up-ids`, id)
                    if (cached) await redisDB.del(unique)
                }
                release()
                locks.delete(id)

                return false
            }
            if (canDelete(listingDoc)) {
                // @ts-ignore override _id to its string representation
                listingDoc._id = listingDoc._id.toHexString ? listingDoc._id.toHexString() : listingDoc._id
                if (config('IS_REDIS_CACHE')) {
                    await redisDB.hdel(`up-ids`, id)
                    if (cached) await redisDB.del(unique)
                }
                await this.removeDocument(id, Collections.Listing)
                release()
                locks.delete(id)

                return true
            } else {
                release()
                locks.delete(id)

                return false
            }
        } catch (error) {
            release()
            locks.delete(id)

            throw error
        }
    }
    /**
     * Get documents created since number of days
     * @param {*} days number of days since document was created
     * @param {*} section which section
     * @param {Boolean} isAdmin if the caller is admin
     * @param {*} pagination number of pages and listings in each page
     * @return {Promise}
     */
    this.getListingsSince = async function (days, section, isAdmin, pagination) {
        // log('#### getListingsSince')
        days = 1000
        const unique = `${section || 'index'}-${days}-${pagination.perPage}-${pagination.page}`
        const useCache = config('IS_REDIS_CACHE') && (await redisDB.exists(`gls:${unique}`))
        const objectId = getObjectId(days)
        const query = isAdmin ? {} : JSON.parse(JSON.stringify(baseQuery))
        query._id = { $gt: objectId }

        if (section) {
            query.section = section
            pagination.perPage = perPage(section)
        } else {
            // sort = [['section']]
            pagination.perPage = perPage()
        }
        // Because cache mechanism is only one to many
        // only deal with pages with section 'index' (most important)
        if (useCache && section === '') {
            const upIds = await redisDB.hkeys(`up-ids`)
            const glsIds = await redisDB.smembers(`gls-ids:${unique}`)
            // get gls-ids:${unique} and intersect with glid-ids
            let refreshed = false
            for (const element of glsIds) {
                const id = element
                if (upIds.indexOf(id) < 0) continue
                const upLevel = (await redisDB.hget(`up-ids`, id)) || '2'
                if (upLevel === '2') continue
                else {
                    if (upLevel === '3') await redisDB.hset(`up-ids`, id, '2')
                    if (upLevel === '1') await redisDB.hdel(`up-ids`, id)
                    await redisDB.del(`gls-ids:${unique}`)
                    refreshed = true
                }
            }

            if (!refreshed) {
                const buffer = await redisDB.getBuffer(`gls:${unique}`)
                return new GetListingsSince().decodeBuffer(buffer)
            }
        }

        collection = dataStores[Collections.Listing]
        let listingsDocs = dataStores._isMongo
            ? await paginate(collection.find(query).project(baseProjection).sort(baseSort), pagination)
            : await paginate(collection.findAsync(query).projection(baseProjection).sort(baseSort), pagination)

        transformers['createTime'](listingsDocs)
        // Normally this doesn't happen (consistent UI / no bad doers)
        if (listingsDocs.length === 0) {
            if (config('IS_REDIS_CACHE')) {
                await redisDB.del(`gls:${unique}`)
                await redisDB.del(`gls-ids:${unique}`)
            }
            return { count: 0, documents: [] }
        }
        const count = dataStores._isMongo ? await collection.countDocuments(query) : await collection.countAsync(query)
        const substring = 100
        listingsDocs.forEach((listingDoc) => {
            listingDoc.desc = listingDoc.desc.substring(0, substring)
            // doc.title = doc.desc.substring(0, Math.round(substring / 2))
            listingDoc._id = listingDoc._id.toHexString ? listingDoc._id.toHexString() : listingDoc._id
        })

        // Remove email
        transformers['redact'](listingsDocs, ['usr'])
        let newQResult = { count: count, documents: listingsDocs }

        if (section !== '') return newQResult
        if (config('IS_REDIS_CACHE')) {
            const buffer = new GetListingsSince().getBuffer(newQResult)
            redisDB.setBuffer(`gls:${unique}`, buffer, 'EX', 1000)
            await redisDB.sadd(
                `gls-ids:${unique}`,
                listingsDocs.map((doc) => doc._id),
            )
        }
        // listingsDocs.forEach((listingDoc) => redisDB.lpush('gls-ids', doc._id))
        return newQResult
    }

    /**
     * Get documents created by a specific user
     * @param {*} user user email
     * @return {Promise}
     */
    this.getListingsByUser = async function (user) {
        // log('#### getListingsByUser')
        const query = {}
        const projection = { geolocation: 0.0 /*d: 0.0, a: 0.0*/ }
        query.usr = user

        collection = dataStores[Collections.Listing]
        const listingsDocs = dataStores._isMongo
            ? await collection.find(query, projection).sort(baseSort).toArray()
            : await collection.findAsync(query).projection(projection).sort(baseSort)

        transformers['toCssClass'](listingsDocs)
        transformers['createTime'](listingsDocs)
        return listingsDocs
    }

    /**
     * delete a user
     * @param {*} user user email
     * @return {Promise}
     */
    this.deleteUser = async function (username) {
        // log('#### deleteUser')
        const user = await this.getUserByUsername(username)
        await this.removeDocument(user._id, Collections.Users)

        return true
    }

    /**
     * Get notification (messages/...) attached to a specific user
     * @param {string} username user email
     * @return {Promise}
     */
    this.getNotificationsByUser = async function (username) {
        // log('#### getNotificationsByUser')
        const getComments = async (username) => {
            const query = { $or: [{ from: username }, { to: username }] }
            const projection = {}
            const sort = { threadId: 1, sent: -1 }

            collection = dataStores[Collections.Comment]
            const tmp = dataStores._isMongo
                ? await collection.find(query, projection).sort(sort).toArray()
                : await collection.findAsync(query).projection(projection).sort(sort)

            transformers['comment'](tmp, username)
            transformers['createTime'](tmp)
            return tmp
        }

        const getTopicListings = async (username) => {
            const query = {}
            query.username = username

            collection = dataStores[Collections.Users]
            let topics = dataStores._isMongo ? await collection.find(query) : await collection.findAsync(query)
            if (!topics || !topics['topics']) return []
            // Subscribed-to topics for one user are like
            // { topics: [{type: 'user', topic: 'user1@mail.com'}, {type: 'tag', topic: 'tag1'}] }
            const subsToUsers = topics.filter((topic) => topic['t'] === 'u').map((t) => t['topic'])
            const subsToTags = topics.filter((topic) => topic['t'] === 't').map((t) => t['topic'])

            // Now having the subscribed to topics, get listings in question
            const query2 = {}
            query2['usr'] = { $in: subsToUsers }

            collection = dataStores[Collections.Listing]
            const tmp1 = dataStores._isMongo
                ? await collection.find(query2, baseProjection).sort(baseSort).toArray()
                : await collection.findAsync(query2).projection(baseProjection).sort(baseSort)

            const query3 = {}
            query3['tag'] = { $in: subsToTags }
            const tmp2 = dataStores._isMongo
                ? await collection.find(query3, baseProjection).sort(baseSort).toArray()
                : await collection.findAsync(query3).projection(baseProjection).sort(baseSort)
            return tmp1.concat(tmp2)
        }
        return (await getComments(username)).concat(await getTopicListings(username))
    }

    /**
     *
     * @param {string} username current user who is subscribing
     * @param {('u'|'t')} type either subscribing to a 'user' or to a 'tag'
     * @param {*} topic the user or tag in question
     * @returns
     */
    this.subscribe = async function (username, type, topic) {
        // log('#### subscribe')
        const query = {}
        query.username = username

        collection = dataStores[Collections.Users]
        return await collection.updateOne(query, { $push: { topics: { topic, type } } })
    }

    /**
     * Get user by username
     * @param {string} username user email
     * @return {Promise}
     */
    this.getUserByUsername = async function (username) {
        // log('#### getUserByUsername')
        const query = {}
        query.username = username

        collection = dataStores[Collections.Users]
        return dataStores._isMongo ? await collection.findOne(query) : await collection.findOneAsync(query)
    }

    /**
     * Insert a user into DB (used for signup)
     * @param {UserModel} elem a JSON representation of a user
     * @return {Promise}
     */
    this.insertUser = async function (elem) {
        // log('#### insertUser')
        let user = new User(elem)
        transformers['redact'](user, ['password'])

        collection = dataStores[Collections.Users]
        const id = dataStores._isMongo
            ? (await collection.insertOne(user))['insertedId']
            : (await collection.insertAsync(user))['_id']

        return id
    }

    /**
     * Updates a user (used for confirmation)
     * @param {UserModel} elem a JSON representation of a user
     * @return {Promise}
     */
    this.updateUser = async function (elem) {
        // log('#### updateUser')
        new User(elem)

        return dataStores._isMongo
            ? await dataStores[Collections.Users].updateOne({ _id: elem._id }, { $set: elem }, { upsert: false })
            : await dataStores[Collections.Users].updateAsync(
                  { _id: elem._id },
                  { $set: elem },
                  { multi: false, returnUpdatedDocs: true },
              )
    }

    // TODO: verify where to use this on update queries
    const removeEmptyValues = (object) => Object.fromEntries(Object.entries(object).filter(([_, value]) => value))

    /**
     * Updates a user (used for user profile)
     * @param {UserProfileModel} elem a JSON representation of a user
     * @return {Promise}
     */
    this.updateUserProfile = async function (elem, username) {
        log('#### updateUserProfile')
        new UserProfile(elem)

        elem = removeEmptyValues(elem)
        const query = {}
        query.username = username

        collection = dataStores[Collections.Users]
        const listingDoc = dataStores._isMongo ? await collection.findOne(query) : await collection.findOneAsync(query)

        return dataStores._isMongo
            ? await dataStores[Collections.Users].updateOne({ _id: listingDoc._id }, { $set: elem }, { upsert: false })
            : await dataStores[Collections.Users].updateAsync(
                  { _id: listingDoc._id },
                  { $set: elem },
                  { multi: false, returnUpdatedDocs: true },
              )
    }

    /**
     * Insert a temporary user into DB (ttl)
     * @param {*} tempUser a JSON representation of a user
     * @return {Promise}
     */
    this.insertTmpUser = async function (tempUser) {
        // log('#### insertTmpUser')
        // createdAt: ttl index
        tempUser['createdAt'] = new Date()

        collection = dataStores[Collections.UsersTemp]
        const id = dataStores._isMongo
            ? (await collection.insertOne(tempUser))['insertedId']
            : (await collection.insertAsync(tempUser))['_id']
        return id
    }

    /**
     * Get temp user by token
     * @param {*} token
     * @return {Promise}
     */
    this.getTmpUserByToken = async function (token) {
        // log('#### getTmpUserByToken')
        const query = {}
        query.token = token

        collection = dataStores[Collections.UsersTemp]
        return dataStores._isMongo ? await collection.findOne(query) : await collection.findOneAsync(query)
    }

    /**
     * TODO: language & collation
     * Approximate search based on indexed text fields: title, desc, tags
     * It also feeds topK miner
     * @param {string} phrase sentence to search
     * @param {boolean} exact whether search the exact sentence or separate terms
     * @param {string} division which division
     * @param {string} section which section
     * @param {string} lang which language
     * @return {Promise}
     */
    this.textSearch = async function (phrase, exact, division, section, lang, pagination) {
        // log('#### textSearch')
        const daysBefore = 100
        const objectId = getObjectId(daysBefore)
        phrase = exact ? `"${phrase.trim()}"` : phrase.trim()
        let query = JSON.parse(JSON.stringify(baseQuery))
        let collation = lang === 'und' ? baseCollation : { locale: lang }
        query = dataStores._isMongo
            ? { ...query, $text: { $search: phrase } }
            : { desc: new RegExp(phrase), title: new RegExp(phrase) }
        // query._id = { $gt: objectId } //TODO: configuration
        // if (lang !== 'und') query.lang = lang
        if (section) query.section = section
        if (division && division !== 'und') query.div = division

        collection = dataStores[Collections.Listing]
        const docs = dataStores._isMongo
            ? await paginate(
                  collection
                      .find(query, { score: { $meta: 'textScore' } })
                      .collation(collation)
                      .project(baseProjection)
                      .sort({ score: { $meta: 'textScore' } }),
                  pagination,
              )
            : await paginate(
                  collection
                      .findAsync(query)
                      .projection(baseProjection)
                      .sort({ score: { $meta: 'textScore' } }),
                  pagination,
              )

        const count = dataStores._isMongo ? await collection.countDocuments(query) : await collection.countAsync(query)
        const result = { count: count, documents: docs }
        if (count > 3) {
            refreshTopK(phrase)
        }
        let crossLangDocs = []
        if (dataStores._isMongo && count < 6 && phrase.indexOf(' ') < 0) {
            let translations = []
            // log(translations)
            for (const [lang, keywords] of Object.entries(translations)) {
                collation = { locale: lang }
                phrase = keywords.join(' ')
                query.$text = { $search: phrase }
                crossLangDocs = await collection
                    .find(query, { score: { $meta: 'textScore' } })
                    .collation(collation)
                    .project(baseProjection)
                    .sort({ score: { $meta: 'textScore' } })
                    .limit(3) // TODO: configuration
                    .toArray()
                // log(crossLangDocs)
                crossLangDocs.forEach((doc) => {
                    doc['crosslang'] = lang
                })
                crossLangDocs = crossLangDocs.concat(crossLangDocs)
            }
        }
        result['crossLangDocs'] = crossLangDocs
        return result
    }

    /**
     * Search tag based on indexed tags field
     * @param {*} tag which tag
     * @param {*} level
     * @param {*} pagination number of pages and listings in each page
     * @return {Promise}
     */
    this.getListingsByTag = async function (tag, level, pagination) {
        // log('#### getListingsByTag')
        const daysBefore = 100 // TODO: configuration
        const objectId = getObjectId(daysBefore)
        const query = JSON.parse(JSON.stringify(baseQuery))
        // query._id = { $gt: objectId } //TODO: configuration
        switch (level) {
            case 'origin':
                query.tags = tag
                break
            case 'parent':
                query.parent = tag
                break
            case 'granpa':
                query.granpa = tag
                break
            default:
                break
        }

        collection = dataStores[Collections.Listing]
        const docs = await paginate(collection.find(query, baseProjection).sort(baseSort), pagination)
        const count = dataStores._isMongo ? await collection.countDocuments(query) : await collection.countAsync(query)
        return { count: count, documents: docs }
    }

    /**
     * Search tag based on division field
     * @param {*} division which division
     * @param {*} pagination number of pages and listings in each page
     * @return {Promise}
     */
    this.getListingsByDivision = async function (division, pagination) {
        // log('#### getListingsByDivision')
        const daysBefore = 100 //TODO: configuration
        const objectId = getObjectId(daysBefore)
        const query = JSON.parse(JSON.stringify(baseQuery))
        // query._id = { $gt: objectId } //TODO: configuration
        query.div = division

        collection = dataStores[Collections.Listing]
        const docs = await paginate(collection.find(query, baseProjection).sort(baseSort), pagination)
        const count = dataStores._isMongo ? await collection.countDocuments(query) : await collection.countAsync(query)
        return { count: count, documents: docs }
    }

    /**
     * Search based on indexed Geo-spatial field: lat, lng
     * @param {*} latitude
     * @param {*} longitude
     * @param {*} section (should be 'markets' or 'events'.)
     * @return {Promise}
     */
    this.getListingsByGeolocation = async function (latitude, longitude, section, pagination) {
        // log('#### getListingsByGeolocation')
        const daysBefore = 100 //TODO: configuration
        const objectId = getObjectId(daysBefore)
        const query = JSON.parse(JSON.stringify(baseQuery))
        // query._id = { $gt: objectId } //TODO: configuration
        if (section) query.section = section
        query.geolocation = {
            $geoWithin: {
                $centerSphere: [[parseFloat(longitude), parseFloat(latitude)], 10 / 3963.2], // 10 miles = 16.09344 kilometers
            },
        }

        collection = dataStores[Collections.Listing]
        const docs = await paginate(collection.find(query, baseProjection).sort(baseSort), pagination)
        const count = dataStores._isMongo ? await collection.countDocuments(query) : await collection.countAsync(query)
        return { count: count, documents: docs }
    }

    /**
     *
     * @param {*} id id of unique document
     * @param {*} key boolean field to be toggled
     * @param {*} collName
     * @returns updated document
     */
    this.toggleValue = async function (id, key, collName) {
        // log('#### toggleValue')
        if (!locks.has(id)) locks.set(id, new Mutex())
        // @ts-ignore
        const release = await locks.get(id).acquire()
        try {
            const query = {}
            query._id = dataStores._isMongo ? new ObjectId(id) : id

            collection = dataStores[collName]
            const docs = dataStores._isMongo ? await collection.findOne(query) : await collection.findOneAsync(query)
            if (!docs) {
                release()
                return
            }
            const newValues = { $set: {} }
            newValues.$set[key] = !docs[key]

            const res = dataStores._isMongo
                ? await collection.findOneAndUpdate(query, newValues, { returnDocument: ReturnDocument.AFTER })
                : await collection.updateAsync(query, newValues, { multi: false, returnUpdatedDocs: true })

            // TODO: only for toggeling listings ?
            // if (config('IS_REDIS_CACHE')) await redisDB.hset(`up-ids`, id, '3')
            release()
            const listing = dataStores._isMongo ? res : res?.affectedDocuments
            transformers['toCssClass'](listing)
            return listing
        } catch (error) {
            release()
        }
    }

    this.autocomplete = async function (keyword) {
        // log('#### autocomplete')
        const keywordRgx = new RegExp('^' + keyword, 'i')

        collection = dataStores[Collections.Words]
        return await collection.find({ _id: keywordRgx }, { _id: 1 }).toArray()
    }

    // One day
    // let topSearches = new EphemeralData(86400000)
    // this.topSearches = async function () {
    //     if (topSearches.isSame()) {
    //         return topSearches.data
    //     }
    //     topSearches.reset()
    //     collection = dataStores[Collections.Words)
    //     topSearches.data = await collection.find({}, { _id: 1 }).sort(/* somehow */).limit(10).toArray()
    //     return topSearches.data
    // }

    this.getListingsByKeyword = async function (keyword, pagination) {
        // log('#### getListingsByKeyword')
        collection = dataStores[Collections.Words]
        const result = await collection.findOne({ _id: keyword })
        if (result) {
            const objIds = result.docs
            if (objIds.length === 0) {
                return { count: 0, documents: [] }
            }
            const docs = await paginate(
                dataStores[Collections.Listing]
                    .find({ _id: { $in: objIds } })
                    .project(baseProjection)
                    .sort(baseSort),
                pagination,
            )
            const query = {
                _id: { $in: objIds },
            }
            const count = dataStores._isMongo
                ? await collection.countDocuments(query)
                : await collection.countAsync(query)

            return { count: count, documents: docs }
        } else {
            return { count: 0, documents: [] }
        }
    }

    // { _id: { tags: 'qui', section: 'blogs' }, count: 11 }
    // { _id: { tags: 'voluptatem', section: 'skills' }, count: 8 }
    // { _id: { tags: 'rerum', section: 'skills' }, count: 8 }
    const reformat = (aa) => {
        let res = {}
        let sections = [...new Set(aa.map((a) => a._id.section))]
        let section
        while ((section = sections.pop()) !== undefined) {
            res[section] = aa
                .filter((z) => z._id.section === section && z._id.tags)
                .map((l) => {
                    return { count: l.count, tag: l._id.tags }
                })
        }
        return res
    }

    // TODO: three repetitive methods but fine,
    // maybe they evolve differently in future
    // { _id: 'city_1', count: 8 }
    // { _id: 'city_2', count: 7 }
    // { _id: 'city_3', count: 6 }
    // 5 minutes
    let topByDiv = new EphemeralData(300000)
    let topByParentTag = new EphemeralData(300000)
    let topByGranpaTag = new EphemeralData(300000)
    /**
     * Get top listings by division, or by tags
     * parent tag or granpa tag
     * @param {'div' | 'parent' | 'granpa'} context
     * @returns
     */
    this.topBy = async function (context) {
        // log('#### topBy')
        if (!dataStores._isMongo) return []

        /**  @type EphemeralData */
        let variable
        switch (context) {
            case 'div':
                if (topByDiv.isFresh()) return topByDiv.data
                variable = topByDiv
                break
            case 'parent':
                if (topByParentTag.isFresh()) return topByParentTag.data
                variable = topByParentTag
                break
            case 'granpa':
                if (topByGranpaTag.isFresh()) return topByGranpaTag.data
                variable = topByGranpaTag
                break
            default:
                return []
        }

        variable.reset()

        const pipeline = [
            { $group: { _id: `$${context}`, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]

        collection = dataStores[Collections.Listing]
        const tmp = await collection.aggregate(pipeline).toArray()
        variable.data = tmp.map((a) => {
            return { count: a.count, tag: a._id }
        })
        return variable.data
    }
    // 5 minutes
    let topTags = new EphemeralData(300000)
    this.topTags = async function () {
        // log('#### topTags')
        if (!dataStores._isMongo) return {}

        if (topTags.isFresh()) {
            return reformat(topTags.data)
        }
        topTags.reset()

        const pipeline = [
            { $unwind: '$tags' },
            // by section
            {
                $group: {
                    _id: { section: '$section', tags: '$tags' },
                    count: { $sum: 1 },
                },
            },
            // { $group: { "_id": "$tags", "count": { "$sum": 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 },
        ]

        collection = dataStores[Collections.Listing]
        topTags.data = await collection.aggregate(pipeline).toArray()
        return reformat(topTags.data)
    }

    /**
     * Get documents for approval or general review
     * When admin doing approval, we only need not yet approved listings
     * When he/she is not, he/she is still doing moderation on all items
     * @param {Boolean} approving
     * @return {Promise}
     */
    this.getListingsForModeration = async function (approving) {
        // log('#### getListingsForModeration')
        const query = approving ? { a: false } : {}
        const projection = {
            geolocation: 0.0,
            ...(!approving && { a: 0.0, d: 0.0 }),
            div: 0.0,
            lat: 0.0,
            lng: 0.0,
        }
        // TODO: find a solution to limit number of docs not to block UI
        // Note: always limited to admins, because UI library used has export functionality (bad)
        const limit = 10 //approving ? 0 : 200

        collection = dataStores[Collections.Listing]

        const docs = dataStores._isMongo
            ? await collection.find(query, projection).sort(baseSort).limit(limit).toArray()
            : await collection.findAsync(query).projection(projection).sort(baseSort).limit(limit)

        const count = dataStores._isMongo ? await collection.countDocuments(query) : await collection.countAsync(query)
        return { count: count, documents: docs }
    }

    /**
     * Update a document in DB
     * @param {*} elem a JSON representation of a Listing
     * @param {string} collName
     * @param {string} id
     * @return {Promise}
     */
    this.updateListing = async function (elem, collName, id = null) {
        // log('#### updateListing')
        let listingDoc = elem

        const id_ = listingDoc._id || id
        if (!locks.has(id_)) locks.set(id_, new Mutex())
        // @ts-ignore
        const release = await locks.get(id_).acquire()
        const newValues = { $set: listingDoc }
        const query = {}
        query._id = dataStores._isMongo ? new ObjectId(id_) : id_
        try {
            delete listingDoc._id
            collection = await dataStores[collName]
            const res = dataStores._isMongo
                ? await collection.findOneAndUpdate(query, newValues, { returnDocument: ReturnDocument.AFTER })
                : await collection.updateAsync(query, newValues, { multi: false, returnUpdatedDocs: true })

            // TODO: only for toggeling listings ?
            // if (config('IS_REDIS_CACHE')) await redisDB.hset(`up-ids`, id_, '1')
            release()
            locks.delete(id)

            return res
        } catch (error) {
            release()
            locks.delete(id)
        }
    }

    /**
     * Remove a document in DB
     * @param {*} id An ID of a Listing
     * @param {*} collName
     * @return {Promise}
     */
    this.removeDocument = async function (id, collName) {
        // log('#### removeDocument')
        return await dataStores[collName].deleteOne({ _id: new ObjectId(id) })
    }

    // this.existsDocument = async function (id, collName) {
    //     return config('IS_REDIS_CACHE') && await redisDB.exists(`cacheIds:${collName}:${id}`)
    // }

    this.insertAnnouncement = async function (doc) {
        // log('#### insertAnnouncement')
        collection = dataStores[Collections.Announcements]

        const id = dataStores._isMongo
            ? (await collection.insertOne(doc))['insertedId']
            : (await collection.insertAsync(doc))['_id']
        return id
    }
}
/**
 *
 * @param {*} arg0
 * @param {*} pagination
 * @returns
 */
function paginate(arg0, pagination) {
    const query = arg0.skip(pagination.perPage * pagination.page - pagination.perPage).limit(pagination.perPage)
    if (dataStores._isMongo) return query.toArray()
    else return query
}
// TODO: it was working before nesting functions inside the `default function (mongoDB, redisDB)`
// it would be great to have again for development environments

// // function traceMethodCalls(obj) {
// //   let handler = {
// //       get(target, propKey, receiver) {
// //           const origMethod = target[propKey]
// //           return function (...args) {
// //               let result = origMethod.apply(this, args)
// //               logger.log({ level: 'info', message: 'MONGO call ' + propKey })
// //               return result
// //           }
// //       }
// //   }
// //   return new Proxy(obj, handler)
// // }

// module.exports = queries // traceMethodCalls(queries)
