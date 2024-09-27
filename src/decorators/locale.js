// @flow

import type { FastifyRequest, FastifyReply } from 'fastify'

export default async function localHandler(req: FastifyRequest, reply: FastifyReply) {
    // const locale = z.enum(['en', 'ua', 'fr']).parse(req.params.locale)
    const locale = req.params.locale
    reply.cookie('locale', locale, { path: '/' })
    await req.i18n.changeLanguage(locale)
    // TODO: confirm this works on https and http for localhost and domain
    if (req.headers.referer) reply.redirect(req.headers.referer)
    else reply.redirect('/')

    return reply
}
