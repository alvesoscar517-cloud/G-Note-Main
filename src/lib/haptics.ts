/**
 * Haptic Feedback Utility
 * Provides vibration feedback for touch interactions on mobile devices
 */

// Check if Vibration API is supported
const isVibrationSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator

/**
 * Trigger a light haptic feedback (short tap)
 * Used for: button taps, selections, toggles
 */
export function hapticLight(): void {
    if (isVibrationSupported) {
        navigator.vibrate(10)
    }
}

/**
 * Trigger a medium haptic feedback
 * Used for: confirmations, successful actions
 */
export function hapticMedium(): void {
    if (isVibrationSupported) {
        navigator.vibrate(20)
    }
}

/**
 * Trigger a heavy haptic feedback
 * Used for: errors, deletions, important alerts
 */
export function hapticHeavy(): void {
    if (isVibrationSupported) {
        navigator.vibrate(40)
    }
}

/**
 * Trigger a success haptic pattern
 * Used for: completed actions, saved, synced
 */
export function hapticSuccess(): void {
    if (isVibrationSupported) {
        navigator.vibrate([10, 50, 10])
    }
}

/**
 * Trigger an error haptic pattern  
 * Used for: failed actions, validation errors
 */
export function hapticError(): void {
    if (isVibrationSupported) {
        navigator.vibrate([30, 50, 30, 50, 30])
    }
}

/**
 * Trigger a selection change haptic
 * Used for: drag start/end, reordering items
 */
export function hapticSelection(): void {
    if (isVibrationSupported) {
        navigator.vibrate([5, 10, 5])
    }
}

/**
 * Check if haptic feedback is available
 */
export function isHapticsAvailable(): boolean {
    return isVibrationSupported
}
