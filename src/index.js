// @flow
import path from 'path'
import fs from 'fs'
import Promise from 'bluebird'
import yaml from 'js-yaml'
import globby from 'globby'
import archiver from 'archiver'
import { Lambda, S3 } from 'aws-sdk'
import { __, always, defaultTo, map, mergeDeepWith } from 'ramda'

const readFile = Promise.promisify(fs.readFile)
const parseYaml = yaml.load

const log = str => () => console.log(`[INFO] ${str}`)

const parseConfigurationFile = (options) => {
  const CONFIGURATION_FILE = path.resolve('./lsd.yml')

  return Promise.resolve(CONFIGURATION_FILE)
    .then(readFile)
    .then(parseYaml)
    .then(mergeDeepWith(defaultTo, __, options))
}

const deploy = (config) => {
  const composeFunctionName = functionName =>
    `${config.project.name}-${config.project.stage}-${functionName}`

  const functions = map(composeFunctionName, config.functions)

  const packageSourceFiles = () => {
    const sourceFilePatterns = [
      'dist/**',
    ]

    const files = globby.sync(sourceFilePatterns)
    const zip = archiver.create('zip')

    const artifactFilePath = path.resolve(`./.lsd/${Date.now()}-${config.project.name}.zip`)
    const output = fs.createWriteStream(artifactFilePath)

    const writeFileOnZip = (file) => {
      const fullPath = path.resolve(file)
      const stats = fs.statSync(fullPath)

      if (!stats.isDirectory()) {
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

    return new Promise((resolve, reject) => {
      output.on('close', () => resolve(artifactFilePath))
      zip.on('error', reject)
    })
  }

  const uploadZipToBucket = (artifactFilePath) => {
    const s3 = new S3()
    const fileName = artifactFilePath.split(path.sep).pop()
    const s3Key = `${Date.now()}/${fileName}`

    const params = {
      Bucket: config.project.bucket,
      Key: s3Key,
      Body: fs.createReadStream(artifactFilePath),
      ContentType: 'application/zip',
    }

    return s3.putObject(params).promise()
      .then(always(s3Key))
  }

  const updateFunctionsCode = (s3Key) => {
    const lambda = new Lambda({
      region: config.project.region,
    })

    const updateFunctionCode = (functionName) => {
      const params = {
        FunctionName: functionName,
        Publish: true,
        S3Bucket: config.project.bucket,
        S3Key: s3Key,
      }

      return lambda.updateFunctionCode(params).promise()
    }

    return Promise.map(functions, updateFunctionCode)
  }


  return Promise.resolve(functions)
    .tap(log('Packaging source files'))
    .then(packageSourceFiles)
    .tap(log('Uploading zip file to S3 bucket'))
    .then(uploadZipToBucket)
    .tap(log('Updating functions code'))
    .then(updateFunctionsCode)
    .then(() => [config])
}

export const init = (options: any) => {
  Promise.resolve(options)
    .then(parseConfigurationFile)
    .then(deploy)
    .then(console.log)
}

