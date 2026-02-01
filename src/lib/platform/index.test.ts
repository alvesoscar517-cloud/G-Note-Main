/**
 * Tests for Platform Index
 * Verifies that all exports are available from the index file
 */

import { describe, it, expect } from 'vitest'
import * as platform from './index'

describe('Platform Index', () => {
  it('should export all detection utilities', () => {
    expect(platform.isChromeExtension).toBeDefined()
    expect(platform.isWebApp).toBeDefined()
    expect(platform.getPlatform).toBeDefined()
    expect(platform.platformSwitch).toBeDefined()
    expect(platform.platformImport).toBeDefined()
  })

  it('should export all authentication adapters', () => {
    expect(platform.platformLogin).toBeDefined()
    expect(platform.platformLogout).toBeDefined()
    expect(platform.platformRefreshToken).toBeDefined()
  })

  it('should export detection utilities as functions', () => {
    expect(typeof platform.isChromeExtension).toBe('function')
    expect(typeof platform.isWebApp).toBe('function')
    expect(typeof platform.getPlatform).toBe('function')
    expect(typeof platform.platformSwitch).toBe('function')
    expect(typeof platform.platformImport).toBe('function')
  })

  it('should export authentication adapters as functions', () => {
    expect(typeof platform.platformLogin).toBe('function')
    expect(typeof platform.platformLogout).toBe('function')
    expect(typeof platform.platformRefreshToken).toBe('function')
  })
})
