import kleur from 'kleur'
import winston from 'winston'

import { env } from '../env.js'

type LogLevel =
  | 'error'
  | 'warn'
  | 'info'
  | 'http'
  | 'verbose'
  | 'debug'
  | 'silly'

const LOG_LEVEL_EMOJIS: Record<LogLevel, string> = {
  error: '🚨',
  warn: '⚠️ ',
  info: 'ℹ️ ',
  http: '🌐',
  verbose: '📝',
  debug: '🐛',
  silly: '🎨',
}

/**
 * Creates a Winston logger instance scoped to the given file.
 *
 * @param fileName - The file path, typically `import.meta.url`
 * @returns A configured Winston logger with rich formatting
 */
export const getLogger = (fileName: string) => {
  const formattedFileName = fileName.includes('/')
    ? fileName.split('/').slice(-2).join('/')
    : fileName

  return winston.createLogger({
    level: env.LOG_LEVEL,
    format: winston.format.combine(
      winston.format.splat(),
      winston.format.timestamp({
        format: () => {
          if (env.NODE_ENV === 'development') {
            return new Date().toLocaleTimeString('en-GB', {})
          }
          return new Date()
            .toLocaleString('en-GB', { timeZone: env.TZ_DISPLAY })
            .replaceAll('/', '.')
        },
      }),
      winston.format.colorize(),
      winston.format.printf((info) => {
        const { timestamp, level, message, ...metadata } = info
        const emoji = LOG_LEVEL_EMOJIS[level.toLowerCase() as LogLevel] || '📋'

        const formatMetadata = (obj: unknown): string => {
          if (obj === null || obj === undefined) {
            return ''
          }
          if (typeof obj !== 'object') {
            return String(obj)
          }

          try {
            return JSON.stringify(obj, null, 2)
          } catch {
            return String(obj)
          }
        }

        const metadataKeys = Object.keys(metadata)
        const hasMetadata = metadataKeys.length > 0

        const separator = kleur.gray('┃')
        const timestampFormatted = kleur.gray(`[${timestamp}]`)
        const fileNameFormatted = kleur.red(`[${formattedFileName}]`)
        const baseMessage = `${emoji} ${timestampFormatted} ${separator} ${fileNameFormatted} ${separator} ${level}: ${message}`

        if (!hasMetadata) {
          return baseMessage
        }

        const metadataLines = metadataKeys.map((key) => {
          const value = metadata[key]
          const formattedValue = formatMetadata(value)

          if (formattedValue.includes('\n')) {
            const indentedValue = formattedValue
              .split('\n')
              .map((line, index) => (index === 0 ? line : `    ${line}`))
              .join('\n')
            return `  ${kleur.cyan(key)}: ${indentedValue}`
          }

          return `  ${kleur.cyan(key)}: ${kleur.yellow(formattedValue)}`
        })

        return `${baseMessage}\n${metadataLines.join('\n')}`
      }),
    ),
    transports: [new winston.transports.Console()],
  })
}
