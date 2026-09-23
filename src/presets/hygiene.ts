import type { Preset } from '../engine/types.js'

/**
 * 反退化预设：类型逃生舱、调试残留、未完成标记、吞异常、假异步、硬编码地址……
 * 这些与项目无关，属于范式的「退路不留」公理。
 */
export function hygiene(): Preset {
  return {
    thresholds: { functionLines: 150 },
  }
}
