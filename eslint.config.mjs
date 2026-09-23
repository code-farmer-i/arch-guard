import eslint from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const sharedGlobals = {
  ...globals.node,
}

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/coverage/**',
      '**/dist/**',
      '**/es/**',
      '**/lib/**',
      '**/.pnpm-store/**',
      '**/*.d.ts',
      // 夹具与示例是「被测项目」，里面故意留了违规代码
      '__fixtures__/**',
      'examples/**',
    ],
  },
  {
    extends: [eslint.configs.recommended],
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: sharedGlobals,
    },
  },
  {
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,mts,cts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: sharedGlobals,
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      // 单文件语法卫生（狗粮）：这些原先是门禁的 H 域 / S16 规则，现已委派给 lint，
      // 所以配置在这里 —— 门禁只做 lint 生态做不到的跨文件契约与架构红线。
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-empty': 'error',
      'no-warning-comments': ['error', { terms: ['todo', 'fixme', 'xxx'], location: 'anywhere' }],
      'max-lines': ['error', { max: 500, skipBlankLines: false, skipComments: false }],
      // 本体的 AST 访问器（facts.ts）与编排函数（run.ts）天然偏长，
      // 这里只拦失控增长；真要拆分见 docs/DESIGN.md 的已知缺口。
      'max-lines-per-function': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
    },
  },
  {
    files: ['**/*.{ts,mts,cts}'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    // 所有输出收敛到唯一出口（对应范式里的「真相唯一」）
    files: ['src/engine/output.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  eslintConfigPrettier,
)
