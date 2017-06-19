#!/usr/bin/env node

const program = require('commander')
const { init } = require('../index.js')

program
  .version('0.1.0')
  .option('-r, --region [value]', 'project region')
  .option('-s, --stage [value]', 'project stage')
  .parse(process.argv)

const options = {
  project: {
    region: program.region,
    stage: program.stage,
  },
}

init(options)
