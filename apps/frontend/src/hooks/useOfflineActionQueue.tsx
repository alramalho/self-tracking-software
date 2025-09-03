// "use client";

// import { useState, useEffect, useCallback, createContext, useContext, ReactNode, useRef } from 'react';
// import { toast } from 'react-hot-toast';
// import { openDB, IDBPDatabase } from 'idb';
// import { WifiOff } from 'lucide-react';

// const DB_NAME = 'offline-actions-db';
// const STORE_NAME = 'actionQueue';
// const VERSION = 1;

// interface OfflineAction {
//   id: string;
//   type: string;
//   payload: any;
//   timestamp: number;
//   metadata: {
//     title?: string;
//     successMessage: string;
//     errorMessage: string;
//   };
//   attempts: number;
// }

// type ActionHandler = (payload: any) => Promise<any>;

// interface OfflineActionQueueContextType {
//   isOnline: boolean;
//   addTask: (type: string, payload: any, metadata: OfflineAction['metadata']) => Promise<void>;
//   registerActionHandler: (type: string, handler: ActionHandler) => void;
// }

// const OfflineActionQueueContext = createContext<OfflineActionQueueContextType | undefined>(undefined);

// let dbPromise: Promise<IDBPDatabase<unknown>> | null = null;

// const getDb = (): Promise<IDBPDatabase<unknown>> => {
//   if (!dbPromise) {
//     dbPromise = openDB(DB_NAME, VERSION, {
//       upgrade(db) {
//         if (!db.objectStoreNames.contains(STORE_NAME)) {
//           db.createObjectStore(STORE_NAME, { keyPath: 'id' });
//         }
//       },
//     });
//   }
//   return dbPromise;
// };

// export const OfflineActionQueueProvider = ({ children }: { children: ReactNode }) => {
//   const [isOnline, setIsOnline] = useState(true);
//   const [actionHandlers, setActionHandlers] = useState<Record<string, ActionHandler>>({});
//   const processingActionIdsRef = useRef<Set<string>>(new Set());

//   const processQueueCb = useCallback(async () => {
//     if (typeof window !== 'undefined' && !navigator.onLine) {
//       console.log("Offline, skipping queue processing.");
//       return;
//     }
//     if (processingActionIdsRef.current.size > 0) {
//         console.log("Queue processing already in progress for some items, deferring new full run until current items complete or next trigger.");
//         return;
//     }
//     console.log("Starting full offline queue processing run...");
//     const db = await getDb();
//     const allActions = await db.getAll(STORE_NAME) as OfflineAction[];

//     if (allActions.length === 0) {
//       console.log("Offline queue is empty.");
//       return;
//     }

//     for (const action of allActions) {
//       if (typeof window !== 'undefined' && !navigator.onLine) {
//         console.log("Went offline during queue processing. Stopping.");
//         break;
//       }

//       if (processingActionIdsRef.current.has(action.id)) {
//         console.log(`Action ${action.id} is already being processed. Skipping.`);
//         continue;
//       }

//       const handler = actionHandlers[action.type];
//       if (handler) {
//         processingActionIdsRef.current.add(action.id);
//         console.log(`Processing action ${action.id} of type ${action.type}`);
//         try {
//           await handler(action.payload);
//           toast.success(action.metadata.successMessage);
//           const deleteTx = db.transaction(STORE_NAME, 'readwrite');
//           await deleteTx.store.delete(action.id);
//           await deleteTx.done;
//           console.log(`Successfully processed and deleted action ${action.id}`);
//         } catch (error) {
//           console.error(`Failed to process action ${action.id} of type ${action.type}:`, error);
//           action.attempts += 1;
//           if (action.attempts >= 3) {
//             toast.error(`Failed to sync: ${action.metadata.errorMessage} after multiple attempts. Removing from queue.`);
//             const deleteFailedTx = db.transaction(STORE_NAME, 'readwrite');
//             await deleteFailedTx.store.delete(action.id);
//             await deleteFailedTx.done;
//             console.log(`Removed action ${action.id} after max attempts.`);
//           } else {
//             const updateAttemptTx = db.transaction(STORE_NAME, 'readwrite');
//             await updateAttemptTx.store.put(action);
//             await updateAttemptTx.done;
//             console.log(`Updated attempts for action ${action.id} to ${action.attempts}.`);
//           }
//         } finally {
//           processingActionIdsRef.current.delete(action.id);
//           console.log(`Finished processing action ${action.id}.`);
//         }
//       } else {
//         console.warn(`No handler for action type ${action.type} during queue processing (action ID: ${action.id}). Skipping.`);
//       }
//     }
//     console.log("Offline queue processing run finished.");
//   }, [actionHandlers]);

//   useEffect(() => {
//     if (typeof window !== 'undefined') {
//       setIsOnline(navigator.onLine);
//     }
//     const handleOnline = () => {
//       setIsOnline(true);
//       toast.success("You are back online! Syncing pending actions...");
//       processQueueCb();
//     };
//     const handleOffline = () => {
//       setIsOnline(false);
//       toast.error("You are offline. Actions will be queued and synced later.");
//     };

//     window.addEventListener('online', handleOnline);
//     window.addEventListener('offline', handleOffline);

//     if (typeof window !== 'undefined' && navigator.onLine) {
//       processQueueCb();
//     }

//     return () => {
//       window.removeEventListener('online', handleOnline);
//       window.removeEventListener('offline', handleOffline);
//     };
//   }, [processQueueCb]);

//   const registerActionHandler = useCallback((type: string, handler: ActionHandler) => {
//     setActionHandlers(prev => ({ ...prev, [type]: handler }));
//   }, []);

//   const addTask = useCallback(async (type: string, payload: any, metadata: OfflineAction['metadata']) => {
//     if (!actionHandlers[type]) {
//         console.error(`No handler registered for action type: ${type}. Action will not be queued.`);
//         toast.error(`Cannot queue action: ${metadata.title || type}. Operation not configured for offline.`);
//         return; 
//     }
//     const db = await getDb();
//     const action: OfflineAction = {
//       id: crypto.randomUUID(),
//       type,
//       payload,
//       timestamp: Date.now(),
//       metadata,
//       attempts: 0,
//     };
//     await db.put(STORE_NAME, action);
//     toast(metadata.title ? `${metadata.title} queued. Will sync when online.` : 'Action queued. Will sync when online.', {
//       icon: <WifiOff className="h-4 w-4" />,
//     });
//   }, [actionHandlers]);

//   useEffect(() => {
//     if (isOnline && Object.keys(actionHandlers).length > 0) {
//       processQueueCb();
//     }
//   }, [isOnline, actionHandlers, processQueueCb]);

//   return (
//     <OfflineActionQueueContext.Provider value={{ isOnline, addTask, registerActionHandler }}>
//       {children}
//     </OfflineActionQueueContext.Provider>
//   );
// };

// export const useOfflineActionQueue = () => {
//   const context = useContext(OfflineActionQueueContext);
//   if (context === undefined) {
//     throw new Error('useOfflineActionQueue must be used within an OfflineActionQueueProvider');
//   }
//   return context;
// }; 