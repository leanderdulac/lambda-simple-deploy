const path = require('path')
const fs = require('fs')
const Promise = require('bluebird')
const yaml = require('js-yaml')
const globby = require('globby')
const archiver = require('archiver')
const { map } = require('ramda')

const readFile = Promise.promisify(fs.readFile)
const parseYaml = yaml.load

const parseConfigurationFile = () => {
  const CONFIGURATION_FILE = path.resolve('./lcd.yml')

  return Promise.resolve(CONFIGURATION_FILE)
    .then(readFile)
    .then(parseYaml)
}

const deploy = (config) => {
  const composeFunctionName = functionName =>
    `${config.project.name}-${config.project.stage}-${functionName}`

  const packageSourceFiles = () => {
    const sourceFilePatterns = [
      'dist/**',
      'node_modules/**',
    ]

    const files = globby.sync(sourceFilePatterns)

    const zip = archiver.create('zip')

    const destinationFilePath = path.resolve(`./${config.project.name}.zip`)
    const output = fs.createWriteStream(destinationFilePath)

    const writeFileOnZip = (file) => {
      const fullPath = path.resolve(file)
      const stats = fs.statSync(fullPath)

      if (!stats.isDirectory(fullPath)) {
        zip.append(fs.readFileSync(fullPath), {
          name: file,
          mode: stats.mode,
        })
      }
    }

    output.on('open', () => {
      zip.pipe(output)
      map(writeFileOnZip, files)
      zip.finalize()
    })
  }

  const uploadZipToBucket = () => {}

  const updateFunctionsCode = () => {}

  const functions = map(composeFunctionName, config.functions)

  return Promise.resolve(functions)
    .then(packageSourceFiles)
    .then(uploadZipToBucket)
    .then(updateFunctionsCode)
    .then(() => [config])
}

const init = () => {
  Promise.resolve()
    .then(parseConfigurationFile)
    .then(deploy)
    .then(console.log)
}

module.exports = {
  init,
}

