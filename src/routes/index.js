// @flow

import { Contexts, Sections } from '../types.d.js'
import { Logger } from '../utils.js'
import getDivisionListings from '../decorators/GET/divisionListings.js'
import getHomepage from '../decorators/GET/homepage.js'
import getKeywordListings from '../decorators/GET/keywordListings.js'
import getTagListings from '../decorators/GET/tagListings.js'
import localHandler from '../decorators/locale.js'
import prepareView from '../decorators/utils/prepareView.js'
import { goGet } from '../decorators/utils/goGet.js'
import queries from '../services/apis/mongo-queries.js'
import { to } from '../services/routines/code.js'

import fs from 'fs'


import type { FastifyInstance } from 'fastify'
import type { Redis } from 'ioredis'
import { fileURLToPath } from 'url'
import path from 'path'

// TODO: rethink validation errors: 'request.validationError'

// The function would need to be declared async for return to work.
// Only routes accept next parameter.

async function routes(fastify: FastifyInstance) {
    const redis: Redis = fastify.redis
    const QInstance = new queries(redis, new Logger(fastify).log)

    // Using reply.prepareView instead of regular `reply.view`
    fastify.decorateReply('prepareView', prepareView)
    fastify.decorate('goGet', goGet)

    fastify.get('/i18n/:locale/', localHandler)

    fastify.get('/update/:id/', async function (req, reply) {
        await redis.hset(`up-ids`, req.params.id, 3)
        return reply
    })

    // ============== Get home page (=index) ==============
    const homepageHandler = getHomepage(fastify)
    fastify.get('/', homepageHandler)
    // ============== ***************** ==============

    fastify.goGet('tags')

    // ============== Get tags listings ==============
    const tagListingsHandler = getTagListings(fastify, 'origin')
    fastify.get('/tag/:tag', tagListingsHandler)
    const parentTagListingsHandler = getTagListings(fastify, 'parent')
    fastify.get('/tag/parent/:tag', parentTagListingsHandler)
    const granpaTagListingsHandler = getTagListings(fastify, 'granpa')
    fastify.get('/tag/granpa/:tag', granpaTagListingsHandler)
    // ============== ***************** ==============

    // ============== Get division listings ==============
    const getDivisionHandler = getDivisionListings(fastify)
    fastify.get('/division/:division', getDivisionHandler)
    // ============== ***************** ==============

    // ============== keyword based search listings ==============
    const getKeywordHandler = getKeywordListings(fastify)
    fastify.get('/keyword/:keyword', getKeywordHandler)
    // ============== ***************** ==============

    /* TODO: throttle this and limit requests to > 3 chars */
    fastify.get('/autocomplete/:keyword', async function (req) {
        const keyword = req.params.keyword.trim()
        const [err, keywords] = await to(QInstance.autocomplete(keyword))
        if (err) {
            req.log.error(`index/autocomplete#autocomplete: ${err.message}`)
            return []
            // reply.prepareView([{}, contexts.message_, contexts.message.SERVER_ERROR])
            // return reply
        }

        return keywords
    })

    /* GET Top listings by tag. */
    fastify.get('/top/tags', async function (req) {
        const [err, topTags] = await to(QInstance.topTags())
        if (err) {
            req.log.error(`index/top#topTags: ${err.message}`)
            return []
        }

        return topTags
    })

    /** @type {Types.RequestExtended} req */
    fastify.get('/top/div', async function (req) {
        const [err, topTags] = await to(QInstance.topBy('div'))
        if (err) {
            req.log.error(`index/top/div#topByDivision: ${err.message}`)
            return []
        }

        return topTags
    })

    // TODO: not being called in UI yet,
    fastify.get('/top/parent/tags', async function (req) {
        const [err, topTags] = await to(QInstance.topBy('parent'))
        if (err) {
            req.log.error(`index/top/parent#topByParentTag: ${err.message}`)
            return []
        }

        return topTags
    })

    fastify.get('/top/granpa/tags', async function (req) {
        const [err, topTags] = await to(QInstance.topBy('granpa'))
        if (err) {
            req.log.error(`index/top/granpa#topByGranpaTag: ${err.message}`)
            return []
        }

        return topTags
    })

    /* GET Top listings by tag. */
    fastify.get(`/explore/all-tags/:section`, async function (req, reply) {
        // TODO: fix it does not work at all
        const section = req.params['section']
        if (!Object.values(Sections).includes(section)) {
            req.log.error(`explore/all-tags: unknown section ${section}`)

            return fastify.notFound(req, reply)
        }

        return reply.view(`./pages/all-tags`, {
            context: Contexts.AllTags,
            section,
            title: req.i18n.t('index.static.explore_tags'),
        })
    })

    /* GET Top listings by tag. */
    fastify.get('/explore/tags', async function (req, reply) {
        return reply.view('./pages/tags', {
            title: req.i18n.t('index.static.explore_tags'),
        })
    })

    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const rootPath = path.join(__dirname, '..', '..')

    const templatesPath = path.join(rootPath, 'templates', 'pages', 'statics')

    const apropos = fs.readFileSync(path.join(templatesPath, 'apropos.html'), 'utf8')
    const cookies = fs.readFileSync(path.join(templatesPath, 'cookies.html'), 'utf8')
    const mentions = fs.readFileSync(path.join(templatesPath, 'mentions-legales.html'), 'utf8')
    fastify.get('/apropos', async function (req, reply) {
        return reply.view('./pages/static', {
            html: apropos,
        })
    })
    fastify.get('/cookies', async function (req, reply) {
        return reply.view('./pages/static', {
            html: cookies,
        })
    })
    fastify.get('/mentions', async function (req, reply) {
        return reply.view('./pages/static', {
            html: mentions,
        })
    })

    const cgu = fs.readFileSync(path.join(templatesPath, 'cgu.html'), 'utf8')
    const notreresponsabilite = fs.readFileSync(path.join(templatesPath, 'notreresponsabilite.html'), 'utf8')
    const votreresponsabilite = fs.readFileSync(path.join(templatesPath, 'votreresponsabilite.html'), 'utf8')
    const achatvente = fs.readFileSync(path.join(templatesPath, 'achatvente.html'), 'utf8')
    fastify.get('/cgu', async function (req, reply) {
        return reply.view('./pages/static', {
            html: cgu,
        })
    })
    fastify.get('/notre_responsabilite', async function (req, reply) {
        return reply.view('./pages/static', {
            html: notreresponsabilite,
        })
    })
    fastify.get('/votre_responsabilite', async function (req, reply) {
        return reply.view('./pages/static', {
            html: votreresponsabilite,
        })
    })
    fastify.get('/achatvente', async function (req, reply) {
        return reply.view('./pages/static', {
            html: achatvente,
        })
    })

    // // Blog pages are pages with little server processing
    // fastify.get('/categories', async function (req, reply) {
    //     return reply.view('./pages/blog', {
    //         sections: [
    //             { html: req.t('doc.markets'), id: Sections.Markets },
    //             { html: req.t('doc.skills'), id: Sections.Skills },
    //             { html: req.t('doc.blogs'), id: Sections.Blogs },
    //         ],
    //         title: req.t('index.static.categories'),
    //     })
    // })

    // fastify.get('/about', async function (req, reply) {
    //     return reply.view('./pages/blog', {
    //         sections: [
    //             { html: req.t('doc.about'), id: 'About' },
    //             { html: req.t('doc.privacy'), id: 'Vie privée' },
    //             { html: req.t('doc.safety'), id: 'Sureté' },
    //         ],
    //         title: req.t('index.static.about'),
    //     })
    // })

    // fastify.get('/help', async function (req, reply) {
    //     return reply.view('./pages/blog', {
    //         sections: [
    //             { html: req.t('doc.help'), id: 'Aide' },
    //         ],
    //         title: req.t('index.static.help'),
    //     })
    // })

    // fastify.get('/cgu', async function (req, reply) {
    //     return reply.view('./pages/blog', {
    //         sections: [
    //             { html: req.t('doc.agreement'), id: 'Conditions Générales d\'Utilisation' },
    //         ],
    //         title: req.t('index.static.agreement'),
    //     })
    // })

    // Some easter-eggs
    // fastify.get('/fennec-fox', function (req, reply) {
    //     const idx = Math.floor(Math.random() * 4) + 1
    //     reply.view('./pages/easter-egg', {
    //         svg: give.SVGs[idx - 1],
    //         style: `easter-egg-${idx}.css`,
    //     })
    // })

    // let converter = new showdown.Converter()
    // let dailyAnnouncements = new EphemeralData(86400000)
    // let github =
    //     'https://raw.githubusercontent.com/bacloud23/open-listings-xx-data/main/data/announcements/fr/announcements.md'
    // fastify.get('/announcements', function (req, reply) {
    //     let listings = []
    //     if (dailyAnnouncements.isSame()) {
    //         listings = dailyAnnouncements.data
    //         return reply.view('./pages/blog', {
    //             title: 'Announcements',
    //             intro: req.t('blog.intro'),
    //             sections: listings,
    //         })
    //     }
    //     dailyAnnouncements.reset()
    //     axios
    //         .get(github)
    //         .then(function (response) {
    //             // handle success
    //             let announcements = response.data.split('<hr>').reverse()
    //             announcements.forEach((announcement) => {
    //                 let title = announcement.match(/#.+/g).filter((title) => title.indexOf('##') < 0)[0]
    //                 title = title.replace(/#/g, '')
    //                 announcement = converter.makeHtml(announcement)
    //                 listings.push({ id: title, html: announcement })
    //             })
    //             dailyAnnouncements.data = listings
    //             return reply.view('./pages/blog', {
    //                 title: 'Announcements',
    //                 intro: req.t('blog.intro'),
    //                 sections: listings,
    //             })
    //         })
    //         .catch(function (error) {
    //             // handle error
    //             console.log(error)
    //         })
    //         .then(function () {
    //             // always executed
    //         })
    // })
}

export default routes
