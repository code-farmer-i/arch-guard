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
      // 与门禁自身红线一致（狗粮）：禁 any、禁非空断言、禁 ts 注释逃生舱
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
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
