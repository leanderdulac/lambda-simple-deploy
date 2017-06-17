#!/usr/bin/env node

const program = require('commander')
const { init } = require('../index.js')

program
  .version('0.1.0')
  .parse(process.argv)

init()
