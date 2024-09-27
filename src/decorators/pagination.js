// @flow

import perPage from '../config/options/perPage.js'

import type { FastifyRequest, FastifyReply } from 'fastify'

// let lock = new Date().getTime()
// let url = ''

export default function paginationHandler(req: FastifyRequest, reply: FastifyReply, done) {
    // if (req.url === url && url !== 'http://localhost:3003/' && new Date().getTime() - lock < 100) {
    //     console.log('@@@@@@@@@@@ this is an indication of a bad implementation, I could not spot everytime it happens @@@@@@@@@');
    //     console.log('Check: https://github.com/fastify/help/issues/636')
    //     req.log.info(`@@@@@@@@@@@${req.url}@@@@@@@@@@@@@`)
    // }

    // lock = new Date().getTime()
    // url = req.url

    const page = req.query.p || 1
    req.pagination = { page: Number(page), perPage: perPage() }

    return done()
}
