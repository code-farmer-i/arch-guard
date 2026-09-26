import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ANALYTICS_EVENTS } from './analytics/events.ts'
import { useTrackView } from './analytics/index.ts'
import { STORAGE_KEYS } from '../config/storage.ts'

test('storage key 与事件名表都在唯一出处里', () => {
  assert.equal(STORAGE_KEYS.theme, 'app.theme')
  assert.equal(ANALYTICS_EVENTS.crewsView, 'crews_view')
  assert.equal(typeof useTrackView, 'function')
})
