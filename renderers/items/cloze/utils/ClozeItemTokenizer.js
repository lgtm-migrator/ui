import { createSimpleTokenizer } from 'meteor/leaonline:corelib/utils/tokenizer'
import { ClozeItemRendererUtils } from './ClozeItemRendererUtils'

export const ClozeItemTokenizer = {}

const separator = '$'
const startPattern = '{{'
const closePattern = '}}'
const newLinePattern = '//'
const optionsSeparator = '|'
const newLineReplacer = `${startPattern}${newLinePattern}${closePattern}`
const newLineRegExp = /\n/g
const tokenize = createSimpleTokenizer(startPattern, closePattern)

// =============================================================================
// PUBLIC
// =============================================================================

ClozeItemTokenizer.tokenize = ({ text, flavor }) => {
  const preprocessedValue = text.replace(newLineRegExp, newLineReplacer)
  return tokenize(preprocessedValue).map(toTokens, { flavor })
}

// =============================================================================
// INTERNAL, EXPORTED ONLY FOR TESTING
// =============================================================================

const tokenizeValueEntry = createSimpleTokenizer('[', ']')

const tokenizeBlanks = (flavor, value) => tokenizeValueEntry(value).map((token, index, arr) => {
  if (token.isToken) {
    token.hasPre = index > 0
    token.hasSuf = index < arr.length - 1
    token.flavor = flavor
  }
  return token
})

const tokenizeSelect = (flavor, value) => tokenizeValueEntry(value).map((token, index, arr) => {
  if (token.isToken) {
    token.value = token.value.split(optionsSeparator)
    token.hasPre = index > 0
    token.hasSuf = index < arr.length - 1
    token.flavor = flavor
  }
  return token
})

const toTokens = (entry) => {
  // we simply indicate newlines within
  // our brackets to avoid complex parsing
  if (entry.value.indexOf('//') > -1) {
    entry.isNewLine = true
    return entry
  }

  // for normal text tokens we don't need
  // further processing of content here
  if (entry.value.indexOf(separator) === -1) {
    return entry
  }

  // if this is an interactive token
  // we process ist from the value split
  const split = entry.value.split('$')
  const flavorKey = split[0]
  const flavor = ClozeItemRendererUtils.getFlavor(flavorKey)

  if (!flavor) {
    throw new Error(`Unexpected flavor - ${flavorKey}`)
  }

  entry.flavor = flavor
  entry.value = getTokenValueForFlavor(entry.flavor, split[1])
  entry.tts = split[2]

  // optionally we can parse some configurations
  if (split[3]) {
    const configs = split[3].split('&')
    configs.forEach(configPair => {
      const configSplit = configPair.split('=')
      if (configSplit.length < 2) {
        return console.warn('Invalid config:', configPair)
      }
      entry[configSplit[0]] = configSplit[1]
    })
  }

  // a block entry has no value and is used, for example, to
  // render a d-block tts-button to read the whole text
  entry.isBlock = !entry.value || entry.value.length === 0

  return entry
}

const getTokenValueForFlavor = (flavor, rawValue = '') => {
  if (ClozeItemRendererUtils.isBlank(flavor)) {
    return tokenizeBlanks(flavor, rawValue)
  }

  if (ClozeItemRendererUtils.isSelect(flavor)) {
    return tokenizeSelect(flavor, rawValue)
  }

  throw new Error(`Unexpected flavor ${flavor}`)
}

export { tokenizeBlanks, tokenizeSelect, toTokens }