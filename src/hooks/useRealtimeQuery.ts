import { useEffect, useState, useCallback } from 'react';
import { onSnapshot, QueryConstraint, query, collection } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Advanced real-time hook with dynamic query constraints
 * Useful for complex queries with filters, ordering, and pagination
 */
export function useRealtimeQuery<T>(
  collectionName: string,
  constraints: QueryConstraint[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Serialize constraints to detect changes
  const constraintsKey = JSON.stringify(
    constraints.map((c) => c.type + JSON.stringify(c))
  );

  useEffect(() => {
    if (!collectionName) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Build query with constraints
    const q = query(collection(db, collectionName), ...constraints);

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
        console.error(`Error in real-time query for ${collectionName}:`, err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, constraintsKey]);

  const refresh = useCallback(() => {
    // The onSnapshot listener automatically refreshes, but this can force re-render
    setLoading(true);
  }, []);

  return { data, loading, error, refresh };
}
