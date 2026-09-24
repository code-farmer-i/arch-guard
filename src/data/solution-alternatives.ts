/**
 * 同类方案表（P12 的判据来源）：一个"面"里**互相替代**的库。
 *
 * 只收**互斥**的：传输层（`axios` / `ky`）与客户端状态（`zustand` / `redux` / `mobx`）不算替代 ——
 * 它们和查询库、和彼此并存是常规写法，列进来只会制造噪音。
 * 原子类（`tailwindcss`）与预处理器（`sass` / `less`）同样不收：它们和 CSS Module 可以共存。
 *
 * 库名是**数据**（P4：库名只许出现在数据表与适配器面），引擎与规则里不出现任何具体库名。
 */
export const SOLUTION_ALTERNATIVES: Record<string, string[]> = {
  router: [
    'react-router',
    'react-router-dom',
    'wouter',
    '@tanstack/react-router',
    '@reach/router',
    'vue-router',
    '@angular/router',
  ],
  'data-layer': [
    'swr',
    '@tanstack/react-query',
    '@tanstack/query-core',
    '@apollo/client',
    'urql',
    '@urql/core',
    'react-relay',
  ],
  styles: ['styled-components', '@emotion/styled', '@emotion/css', '@linaria/core', 'styled-jsx'],
  'ui-kit': [
    'antd',
    '@mui/material',
    '@chakra-ui/react',
    '@mantine/core',
    'element-plus',
    'naive-ui',
    'primevue',
  ],
  i18n: ['react-i18next', 'i18next', 'react-intl', '@formatjs/intl', 'vue-i18n', '@lingui/core'],
}
