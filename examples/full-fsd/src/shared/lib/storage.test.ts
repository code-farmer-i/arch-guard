import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ANALYTICS_EVENTS } from './analytics/events.ts'
import { STORAGE_KEYS } from '../config/storage.ts'

/**
 * 只测**纯值**（唯一出处那两张表）：`analytics/index.ts` 里有 React hook（`useTrackView`），
 * 而示例不装依赖 —— 引它会让 `node --test` 直接挂掉（真实踩过）。
 */
test('storage key 与事件名表都在唯一出处里', () => {
  assert.equal(STORAGE_KEYS.theme, 'app.theme')
  assert.equal(ANALYTICS_EVENTS.crewsView, 'crews_view')
})
