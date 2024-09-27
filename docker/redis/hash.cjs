#!/usr/bin/env node
'use strict'

// node hash.cjs -p <password>

const yargs = require('yargs')
let bcrypt
try {
    bcrypt = require('bcrypt')
    // console.debug('using native bcrypt implementation');
} catch (e) {
    bcrypt = require('bcryptjs')
    // console.debug('using javascript bcryptjs implementation');
}

let args = yargs
    .alias('h', 'help')
    .alias('h', '?')
    .options('password', {
        alias: 'p',
        describe: 'The plain text password to hash',
        type: 'string',
    })
    .check(function (value) {
        if (typeof value['password'] === 'undefined' || value['password'].trim() === '') {
            console.error('password parameter missing and must not be empty')
            console.error('usage:   bcrypt-password.js -p <mysecretpass>')
            process.exit(-1)
        }
        return true
    })
    .usage('Usage: $0 [options]')
    .wrap(yargs.terminalWidth()).argv

console.log(bcrypt.hashSync(args['password'], 10))
