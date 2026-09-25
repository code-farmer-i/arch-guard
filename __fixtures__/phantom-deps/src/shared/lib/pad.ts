// 违规：left-pad 没写进 package.json（幽灵依赖）
import leftPad from 'left-pad'

export const pad = (value: string): string => leftPad(value, 3)
