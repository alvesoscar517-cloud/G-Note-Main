import { Table } from '@tiptap/extension-table'
import { mergeAttributes } from '@tiptap/core'

/**
 * Extended Table extension that wraps tables in a scrollable container on mobile
 * This enables horizontal scrolling for tables wider than the viewport
 */
export const MobileScrollableTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
    }
  },

  renderHTML({ HTMLAttributes }) {
    // Create a wrapper div for mobile scrolling
    return [
      'div',
      { 
        class: 'tiptap-table-wrapper',
        'data-type': 'table-wrapper'
      },
      [
        'table',
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
        ['tbody', 0]
      ]
    ]
  },

  parseHTML() {
    return [
      // Parse regular table tags
      {
        tag: 'table',
        priority: 51,
      },
      // Also parse tables inside our wrapper div
      {
        tag: 'div[data-type="table-wrapper"] table',
        priority: 52,
      },
    ]
  },
})
