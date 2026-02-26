import { useEffect, useState } from 'react';
import {
  collection,
  query,
  onSnapshot,
  Query,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Real-time hook for Firestore collections with query support
 * Automatically subscribes/unsubscribes and updates when collection changes
 */
export function useRealtimeCollection<T = DocumentData>(
  collectionName: string,
  queryConstraints?: Query
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Create query or use default collection
    const q = queryConstraints || collection(db, collectionName);

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: T[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as T);
        });
        setData(items);
        setLoading(false);
      },
      (err) => {
        console.error(`Error listening to ${collectionName}:`, err);
        setError(err as Error);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [collectionName, queryConstraints]);

  return { data, loading, error };
}
