import { useCallback, useRef } from 'react'
import type { Editor } from '@tiptap/react'

/**
 * Type for table structure operations that can be batched
 */
export type TableOperation =
  | { type: 'addColumnBefore' }
  | { type: 'addColumnAfter' }
  | { type: 'addRowBefore' }
  | { type: 'addRowAfter' }
  | { type: 'deleteColumn' }
  | { type: 'deleteRow' }
  | { type: 'deleteTable' }
  | { type: 'mergeCells' }
  | { type: 'splitCell' }
  | { type: 'toggleHeaderRow' }
  | { type: 'toggleHeaderColumn' }

/**
 * Options for the batch operations hook
 */
export interface UseTableBatchOperationsOptions {
  /** Debounce delay in milliseconds (default: 100ms) */
  debounceDelay?: number
  /** Whether to enable batching (default: true) */
  enableBatching?: boolean
}

/**
 * Custom hook for batching table structure changes to optimize collaboration performance
 * 
 * This hook provides utilities to batch multiple table operations into a single transaction,
 * reducing network traffic in collaboration mode and ensuring Y.js syncs efficiently.
 * 
 * Features:
 * - Batches multiple operations using Tiptap's chain() API
 * - Debounces rapid structure changes to prevent excessive Y.js syncs
 * - Optimizes collaboration performance by reducing transaction count
 * 
 * @param editor - The Tiptap editor instance
 * @param options - Configuration options for batching behavior
 * @returns Object with batch operation utilities
 * 
 * @example
 * ```tsx
 * const { executeBatch, queueOperation, flushQueue } = useTableBatchOperations(editor, {
 *   debounceDelay: 100,
 *   enableBatching: true
 * })
 * 
 * // Execute multiple operations in a single batch
 * executeBatch([
 *   { type: 'addRowAfter' },
 *   { type: 'addRowAfter' },
 *   { type: 'addColumnAfter' }
 * ])
 * 
 * // Queue operations for debounced execution
 * queueOperation({ type: 'addRowAfter' })
 * queueOperation({ type: 'addColumnAfter' })
 * // Operations will be batched and executed after debounce delay
 * ```
 */
export function useTableBatchOperations(
  editor: Editor | null,
  options: UseTableBatchOperationsOptions = {}
) {
  const { debounceDelay = 100, enableBatching = true } = options

  // Queue for storing pending operations
  const operationQueueRef = useRef<TableOperation[]>([])
  
  // Timer for debouncing
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Execute a single table operation
   * @param operation - The operation to execute
   * @param chain - The editor chain to append to
   * @returns The updated chain
   */
  const executeOperation = useCallback(
    (operation: TableOperation, chain: ReturnType<Editor['chain']>) => {
      switch (operation.type) {
        case 'addColumnBefore':
          return chain.addColumnBefore()
        case 'addColumnAfter':
          return chain.addColumnAfter()
        case 'addRowBefore':
          return chain.addRowBefore()
        case 'addRowAfter':
          return chain.addRowAfter()
        case 'deleteColumn':
          return chain.deleteColumn()
        case 'deleteRow':
          return chain.deleteRow()
        case 'deleteTable':
          return chain.deleteTable()
        case 'mergeCells':
          return chain.mergeCells()
        case 'splitCell':
          return chain.splitCell()
        case 'toggleHeaderRow':
          return chain.toggleHeaderRow()
        case 'toggleHeaderColumn':
          return chain.toggleHeaderColumn()
        default:
          return chain
      }
    },
    []
  )

  /**
   * Execute multiple operations in a single batch
   * This uses Tiptap's chain() API to combine operations into one transaction,
   * which is more efficient for Y.js collaboration sync
   * 
   * @param operations - Array of operations to execute
   */
  const executeBatch = useCallback(
    (operations: TableOperation[]) => {
      if (!editor || operations.length === 0) return

      // If batching is disabled, execute operations individually
      if (!enableBatching) {
        operations.forEach((operation) => {
          const chain = editor.chain().focus()
          executeOperation(operation, chain).run()
        })
        return
      }

      // Batch all operations into a single chain
      let chain = editor.chain().focus()
      
      operations.forEach((operation) => {
        chain = executeOperation(operation, chain)
      })

      // Execute the entire batch as a single transaction
      chain.run()
    },
    [editor, enableBatching, executeOperation]
  )

  /**
   * Flush the operation queue immediately
   * Executes all queued operations and clears the queue
   */
  const flushQueue = useCallback(() => {
    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    // Execute all queued operations
    if (operationQueueRef.current.length > 0) {
      executeBatch(operationQueueRef.current)
      operationQueueRef.current = []
    }
  }, [executeBatch])

  /**
   * Queue an operation for debounced batch execution
   * Operations are accumulated and executed together after the debounce delay
   * 
   * @param operation - The operation to queue
   */
  const queueOperation = useCallback(
    (operation: TableOperation) => {
      // Add operation to queue
      operationQueueRef.current.push(operation)

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // Set new timer to execute batch after delay
      debounceTimerRef.current = setTimeout(() => {
        flushQueue()
      }, debounceDelay)
    },
    [debounceDelay, flushQueue]
  )

  /**
   * Execute a single operation immediately (no batching or debouncing)
   * Useful for operations that should not be delayed
   * 
   * @param operation - The operation to execute
   */
  const executeImmediate = useCallback(
    (operation: TableOperation) => {
      if (!editor) return
      
      const chain = editor.chain().focus()
      executeOperation(operation, chain).run()
    },
    [editor, executeOperation]
  )

  /**
   * Clear the operation queue without executing
   * Useful for canceling pending operations
   */
  const clearQueue = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    operationQueueRef.current = []
  }, [])

  return {
    /** Execute multiple operations in a single batch */
    executeBatch,
    /** Queue an operation for debounced batch execution */
    queueOperation,
    /** Flush the operation queue immediately */
    flushQueue,
    /** Execute a single operation immediately */
    executeImmediate,
    /** Clear the operation queue without executing */
    clearQueue,
    /** Get the current queue length */
    getQueueLength: () => operationQueueRef.current.length
  }
}
