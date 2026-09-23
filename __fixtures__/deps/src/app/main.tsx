import { parseFlags } from 'some-undeclared-pkg'

export function main(argv: string[]) {
  return parseFlags(argv).concat(process.argv.slice(2))
}
