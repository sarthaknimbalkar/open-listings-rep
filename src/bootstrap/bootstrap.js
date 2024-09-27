// @flow

import { bold, green } from 'colorette'
import { config as dotenv } from 'dotenv'
import fs from 'fs'
import { JSONSchemaFaker } from 'json-schema-faker'
import { MongoClient } from 'mongodb'
import path from 'path'
import { AsyncTask, SimpleIntervalJob } from 'toad-scheduler'
import { fileURLToPath } from 'url'
import { getStateNames } from './geoJSONEncoder.js'
import transformers from '../constraints/transformers.js'
import scripts from '../services/apis/mongo-jobs.js'
import RedisAPI from '../services/apis/redis.js'
import { refreshTopK } from '../services/miner.js'
import { dataStores, config } from '../utils.js'
import { schema } from './schema.js'

// eslint-disable-next-line no-unused-vars
import { Collections, Sections } from '../types.d.js'

const log = (s) => {
    console.log(bold(green(s)))
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv()

/*********************************************************************************************** */
// FAKE DEVELOPMENT ENVIRONMENTS DATA
const states = {
    ar: getStateNames('ar'),
    en: getStateNames('en'),
    fr: getStateNames('fr'),
}

const readDictionary = (lang) =>
    fs
        .readFileSync(path.resolve(__dirname, `../../data/raw/${lang}.txt`))
        .toString()
        .split('\n')
const french = readDictionary('fr')
const english = readDictionary('en')
const arabic = readDictionary('ar')

const getWords = (dic, n) => {
    const word = () => dic[Math.floor(Math.random() * dic.length)]
    let res = ''
    for (let i = 0; i < n; i++) res += ` ${word()}`
    return res.substring(1)
}
const langs = ['en', 'fr', 'ar']
const langsFaker = {
    ar: { jsf: JSONSchemaFaker, words: (n) => getWords(arabic, n) },
    en: { jsf: JSONSchemaFaker, words: (n) => getWords(english, n) },
    fr: { jsf: JSONSchemaFaker, words: (n) => getWords(french, n) },
}

const sections = Object.values(Sections)
let items = []

// https://github.com/sandstrom/country-bounding-boxes/blob/master/bounding-boxes.json

const minLng = -8.68
const maxLng = 19.06
const minLat = 12.0
const maxLat = 37.12
/** */
function getRandomInRange(from, to, fixed) {
    return (Math.random() * (to - from) + from).toFixed(fixed) * 1
}

function fakeItems(docsCount) {
    for (let i = 0; i < docsCount; i++) {
        const randomLang = langs[Math.floor(Math.random() * langs.length)]
        const item = langsFaker[randomLang].jsf.generate(schema)
        item.tagsLang = item.lang = randomLang
        item.title = langsFaker[randomLang].words(5 + Math.floor(Math.random() * 10)) //.slice(0, 100)
        item.desc = langsFaker[randomLang].words(10 + Math.floor(Math.random() * 30)) //.slice(5000)
        item.cdesc = item.desc
        item.tags = [langsFaker[randomLang].words(1), langsFaker[randomLang].words(1), langsFaker[randomLang].words(1)]

        item.div = states[randomLang][Math.floor(Math.random() * states[randomLang].length)]
        item.section = sections[Math.floor(Math.random() * sections.length)]
        item.offer = Math.random() < 0.5
        item.lat = getRandomInRange(minLat, maxLat, 3)
        item.lng = getRandomInRange(minLng, maxLng, 3)
        item.geolocation = {
            coordinates: [item.lng, item.lat],
            type: 'Point',
        }
        let email
        if (i < 10) email = config('ADMIN_EMAIL')
        if (i < 20 && i >= 10) email = config('ADMIN_EMAIL2')
        item.d = Math.random() < 0.5
        item.a = Math.random() < 0.5
        item.usr = email || item.usr
        items.push(item)
    }
}

/*********************************************************************************************** */
// OPERATION TO SAFELY BOOTSTRAP ENVIRONMENTS
// PRESENCE OF DATABASES, COLLECTIONS, SETTING INDEXES
const ops = {}
ops.checkEnvironmentData = async function checkEnvironmentData(url) {
    if (!dataStores._isMongo) return
    // log({ level: 'info', message: 'Checking environment data' })
    const client = await MongoClient.connect(url)
    // Use the admin database for the operation
    if (!client) throw new Error(`Check if MongoDB server is up`)
    let adminDb = client.db().admin()
    // List all the available databases
    const dbs = await adminDb.listDatabases()
    const databases = dbs.databases.map((n) => n.name)
    const dbName = 'listings_db'
    const checkDBs = databases.indexOf(dbName) >= 0
    if (!checkDBs) {
        throw new Error('Not all databases are present.')
    }
    const db = client.db(dbName)
    const collections = await db.listCollections().toArray()
    const collectionNames = collections.map((n) => n.name)
    log(`discovered collections ${JSON.stringify(collectionNames)}`)
    const checkColls =
        collectionNames.indexOf(Collections.Words) >= 0 &&
        collectionNames.indexOf(Collections.Listing) >= 0 &&
        collectionNames.indexOf(Collections.Users) >= 0 &&
        collectionNames.indexOf(Collections.UsersTemp) >= 0 &&
        collectionNames.indexOf(Collections.Comment) >= 0

    if (!checkColls) {
        throw new Error('Not all collections are present.')
    }
    // client.close()
    // log({ level: 'info', message: 'Environment data seem to be fine' })
}

ops.createIndexes = async function createIndexes() {
    if (dataStores._isMongo) {
        const db = dataStores.mongo
        const listingCollection = db.collection(Collections.Listing)
        await listingCollection.dropIndexes()
        await listingCollection.createIndex({ cdesc: 'text', title: 'text' }, { weights: { cdesc: 1, title: 3 } })
        // doesn't support indexing one key based on value
        // await listingCollection.createIndex({ lang: 1 }, { collation: { locale: 'fr' } })
        // await listingCollection.createIndex({ lang: 'en' }, { collation: { locale: 'en' } })
        // await listingCollection.createIndex({ lang: 'ar' }, { collation: { locale: 'ar' } })
        await listingCollection.createIndex({ tags: 1 })
        await listingCollection.createIndex({ div: 1 })
        await listingCollection.createIndex({ geolocation: '2dsphere' })
        const commentCollection = db.collection(Collections.Comment)
        await commentCollection.createIndex({ from: 1, sent: 1, to: 1 })
        const usersCollection = db.collection(Collections.Users)
        const tmpUsersCollection = db.collection(Collections.UsersTemp)
        await usersCollection.createIndex({ username: 1 }, { unique: true })
        await tmpUsersCollection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 10, unique: true })
        const allCollections = (await db.listCollections().toArray()).map((coll) => coll.name)

        if (allCollections.indexOf(Collections.Events) < 0)
            // 1000000 bytes is 1 MB
            await db.createCollection(Collections.Events, { capped: true, max: 5000, size: 1000000 })
    } else {
        /** @type { Array.<import('@seald-io/nedb')> } */
        let [listingCollection, usersCollection, tmpUsersCollection, commentCollection] = []
        listingCollection = dataStores[Collections.Listing]
        usersCollection = dataStores[Collections.Users]
        tmpUsersCollection = dataStores[Collections.UsersTemp]
        commentCollection = dataStores[Collections.Comment]

        // await listingCollection.ensureIndexAsync({ title: 'text', cdesc: 'text' }, { weights: { title: 3, cdesc: 1 } })
        await listingCollection.ensureIndexAsync({ fieldName: 'tags' })
        await listingCollection.ensureIndexAsync({ fieldName: 'div' })
        // await listingCollection.ensureIndexAsync({ geolocation: '2dsphere' })

        await commentCollection.ensureIndexAsync({ fieldName: 'to' })
        await commentCollection.ensureIndexAsync({ fieldName: 'from' })
        await commentCollection.ensureIndexAsync({ fieldName: 'sent' })

        await usersCollection.ensureIndexAsync({ fieldName: 'username', unique: true })
        await tmpUsersCollection.ensureIndexAsync({ expireAfterSeconds: 60 * 10, fieldName: 'createdAt', unique: true })
    }
    log(`Indexes created successfully`)
}

/*********************************************************************************************** */
// SEED DEVELOPMENT FAKE DATA
const docsCount = 500

let seconds = 0
ops.seedDevelopmentData = async function seedDevelopmentData(colListings) {
    fakeItems(docsCount)
    const options = { ordered: true }
    items.forEach((item) => transformers['createTime'](item, seconds++))
    return colListings.insertAsync ? await colListings.insertAsync(items) : await colListings.insertMany(items, options)
}

/**
 * Only used for testing, to mimick "QInstance.refreshKeywords" in case of NeDB for instance
 */
ops.famousSearches = function famousSearches() {
    const splitBy = (sep) => (str) => str.split(sep).map((x) => x.trim())
    const splitLine = splitBy('-')
    const splitCategories = splitBy('>')
    const load = (lines) =>
        [lines]
            .map((lines) => lines.map(splitLine))
            .map((lines) => lines.map(([, cats]) => splitCategories(cats)))
            .pop()

    const taxonomyPathEn = 'data/taxonomy/taxonomy-with-ids.en-US.txt'
    const fileSyncEn = fs.readFileSync(path.join(__dirname, '..', '..', taxonomyPathEn)).toString()
    const fileContentEn = fileSyncEn.replace(',', '_').split('\n').filter(Boolean)

    const googleTagsEn = [...new Set(load(fileContentEn).filter((arr) => arr.length === 3 && arr[2].length < 30))]
        .map((arr) => arr[1])
        .slice(1, 200)
    googleTagsEn.forEach((search) => {
        refreshTopK(search)
    })
    // for (let item of topk.values()) {
    //     log(
    //         `Item "${item.value}" is in position ${item.rank} with an estimated frequency of ${item.frequency}`
    //     )
    // }
}

// ops.fastifyInjects = async function fastifyInjects(app) {
//     log('Injecting Fastify requests')
//     // Fastify inject doesn't work anymore for some reason !
//     // let response = await app.inject({
//     //     method: 'POST',
//     //     url: '/signup',
//     //     remoteAddress: '0.0.0.0',
//     //     payload: {
//     //     username: config('ADMIN_EMAIL2'),
//     //     password: config('ADMIN_PASS'),
//     //     },
//     // })
//     // logRequest(response, app)
//     // response = await app.inject({
//     //     method: 'POST',
//     //     url: '/signup',
//     //     remoteAddress: '0.0.0.0',
//     //     payload: {
//     //     username: config('ADMIN_EMAIL2'),
//     //     password: config('ADMIN_PASS'),
//     //     },
//     // })
//     // logRequest(response, app)
//     const post = (email, password) =>
//         request(
//             {
//                 method: 'POST',
//                 url: 'http://0.0.0.0:' + app.server.address().port + '/signup',
//                 form: {
//                     username: email,
//                     password: password,
//                     firstName: email,
//                     secondName: email,
//                 },
//             },
//             (err, response) => {
//                 if (err) console.error(err)
//                 log(response.statusCode)
//             },
//         )
//     post(config('ADMIN_EMAIL'), config('ADMIN_PASS'))
//     post(config('ADMIN_EMAIL2'), config('ADMIN_PASS'))
// }

ops.registerPipelines = function registerPipelines(mongoClient, redisClient, scheduler, seconds) {
    // Register a CRON for top search keywords
    if (dataStores._isMongo) {
        const QInstance = new scripts(mongoClient)
        const task = new AsyncTask(
            'Refreshing top words across all listings',
            () => {
                return QInstance.refreshKeywords()
            },
            (err) => console.log(err),
        )
        const job = new SimpleIntervalJob({ seconds }, task)
        scheduler.addSimpleIntervalJob(job)
    } else {
        // When using NeDB instead of MongoDB, just use a quick dump for development
        this.famousSearches()
    }

    // Register a CRON for clearing old sessions from Redis store
    // 5 hours !!!!!
    const redisAPI = new RedisAPI(redisClient)
    const task = new AsyncTask(
        'Clearing old non logged in users sessions',
        () => {
            return redisAPI.clearOldSessions()
        },
        (err) => console.log(err),
    )
    const job = new SimpleIntervalJob({ seconds: 3600 * 5 }, task)
    scheduler.addSimpleIntervalJob(job)
}

export default ops
