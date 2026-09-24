/**
 * 常见图标包名单（纯数据）。
 *
 * 用途：适配器**没有**登记图标来源时，出现这些包才算「第二套图标来源」（P05）。
 * 库名只许出现在这里与 `presets/<面>/*` —— 引擎、packs 与通用预设里都不许有（P4 自检强制）。
 */
export const knownIconPackages: string[] = [
  '@ant-design/icons',
  '@heroicons/react',
  'react-icons',
  'lucide-react',
  '@mui/icons-material',
  '@tabler/icons-react',
]
