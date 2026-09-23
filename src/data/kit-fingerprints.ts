/**
 * 已知组件库指纹（纯数据）。
 * 用途：命中指纹但不在本项目适配表内 → 「框架残留」；换库时的迁移验收条件（见 docs/SPEC.md §7.1）。
 * 这里只放数据，不含任何判定逻辑。
 */
export interface KitFingerprint {
  id: string
  packages: string[]
  selectorPrefixes: string[]
  varPrefixes: string[]
}

export const kitFingerprints: KitFingerprint[] = [
  { id: 'antd', packages: ['antd', '@ant-design/icons', '@ant-design/x'], selectorPrefixes: ['\\.ant-'], varPrefixes: ['^--ant-'] },
  { id: 'element-plus', packages: ['element-plus'], selectorPrefixes: ['\\.el-'], varPrefixes: ['^--el-'] },
  { id: 'mantine', packages: ['@mantine/core'], selectorPrefixes: ['\\.mantine-'], varPrefixes: ['^--mantine-'] },
  { id: 'chakra', packages: ['@chakra-ui/react'], selectorPrefixes: ['\\.chakra-'], varPrefixes: ['^--chakra-'] },
  { id: 'arco', packages: ['@arco-design/web-react', '@arco-design/web-vue'], selectorPrefixes: ['\\.arco-'], varPrefixes: ['^--arco-'] },
  { id: 'semi', packages: ['@douyinfe/semi-ui'], selectorPrefixes: ['\\.semi-'], varPrefixes: ['^--semi-'] },
  { id: 'naive', packages: ['naive-ui'], selectorPrefixes: ['\\.n-'], varPrefixes: ['^--n-'] },
  { id: 'mui', packages: ['@mui/material', '@material-ui/core'], selectorPrefixes: ['\\.Mui[A-Z]', '\\.Mui-'], varPrefixes: ['^--mui-'] },
  { id: 'bootstrap', packages: ['bootstrap', 'react-bootstrap'], selectorPrefixes: ['\\.(btn|card|navbar|container)-'], varPrefixes: ['^--bs-'] },
  { id: 'tailwind', packages: ['tailwindcss'], selectorPrefixes: ['\\.(flex|grid|p-|m-|text-)'], varPrefixes: ['^--tw-'] },
  { id: 'styled-components', packages: ['styled-components', '@emotion/styled'], selectorPrefixes: [], varPrefixes: [] },
  { id: 'vue', packages: ['vue', 'vue-router', 'pinia'], selectorPrefixes: [], varPrefixes: [] },
]

export function fingerprintsOf(adapterPackages: string[]): KitFingerprint[] {
  const owned = new Set(adapterPackages)
  return kitFingerprints.filter((kit) => !kit.packages.some((pkg) => owned.has(pkg)))
}
