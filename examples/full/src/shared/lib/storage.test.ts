import assert from 'node:assert/strict'
import { test } from 'node:test'
import { STORAGE_KEYS } from './storage'
import { sendEvent } from './analytics'
import { ANALYTICS_EVENTS } from './analytics/events'

test('storage key 与事件名表都在唯一出处里', () => {
  assert.equal(STORAGE_KEYS.theme, 'app.theme')
  assert.equal(ANALYTICS_EVENTS.crewsView, 'crews_view')
  assert.equal(typeof sendEvent, 'function')
})
