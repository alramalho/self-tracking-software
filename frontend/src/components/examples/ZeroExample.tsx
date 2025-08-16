"use client";

import { useZero } from '@rocicorp/zero/react';
import { useQuery } from '@rocicorp/zero/react';
import { useUpdateUser, useCreateActivity } from '@/hooks/useMutators';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

// Example component showing how to use Zero with your schema
export function ZeroExample() {
  const z = useZero();
  const updateUser = useUpdateUser();
  const createActivity = useCreateActivity();
  const [loading, setLoading] = useState(false);
  
  // Query users from your database
  const users = useQuery(z.query.users);
  
  // Query activities for the current user
  const activities = useQuery(z.query.activities);

  const handleUpdateUser = async () => {
    if (!users?.[0]) return;
    
    setLoading(true);
    try {
      await updateUser({
        id: users[0].id,
        name: `Updated ${Date.now()}`
      });
    } catch (error) {
      console.error('Failed to update user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateActivity = async () => {
    if (!users?.[0]) return;
    
    setLoading(true);
    try {
      await createActivity({
        userId: users[0].id,
        title: `New Activity ${Date.now()}`,
        measure: 'times',
        emoji: '🏃',
        colorHex: '#3b82f6'
      });
    } catch (error) {
      console.error('Failed to create activity:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Zero Database Example</h2>
      
      <div className="mb-4 space-x-2">
        <Button onClick={handleUpdateUser} disabled={loading || !users?.[0]}>
          Update User Name
        </Button>
        <Button onClick={handleCreateActivity} disabled={loading || !users?.[0]}>
          Create Activity
        </Button>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Users ({users?.length || 0})</h3>
        <div className="space-y-2">
          {users?.map(user => (
            <div key={user.id} className="p-2 bg-gray-100 rounded">
              <p><strong>Name:</strong> {user.name}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Username:</strong> {user.username}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Activities ({activities?.length || 0})</h3>
        <div className="space-y-2">
          {activities?.map(activity => (
            <div key={activity.id} className="p-2 bg-blue-100 rounded">
              <p><strong>Title:</strong> {activity.title}</p>
              <p><strong>Emoji:</strong> {activity.emoji}</p>
              <p><strong>Measure:</strong> {activity.measure}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}