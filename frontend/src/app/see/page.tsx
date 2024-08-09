'use client';

import React, { useEffect, useState } from 'react';
import HeatMap from '@uiw/react-heat-map';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useNotifications } from '@/hooks/useNotifications';

interface Activity {
  id: string;
  title: string;
  measure: string;
}

interface ActivityEntry {
  id: string;
  activity_id: string;
  quantity: number;
  date: string;
}

const SeePage: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const { clearNotifications } = useNotifications();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [activitiesResponse, entriesResponse] = await Promise.all([
          axios.get<Activity[]>('http://localhost:8000/api/activities'),
          axios.get<ActivityEntry[]>('http://localhost:8000/api/activity-entries')
        ]);

        setActivities(activitiesResponse.data);
        setActivityEntries(entriesResponse.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load activities');
      }
    };

    fetchData();
    clearNotifications();
  }, [clearNotifications]);

  const getActivityEntries = (activityId: string) => {
    return activityEntries
      .filter(entry => entry.activity_id === activityId)
      .map(entry => ({ date: entry.date, count: entry.quantity }));
  };

  return (
    <div className="p-4 space-y-8">
      <h1 className="text-2xl font-bold mb-4">Activity Overview</h1>
      {activities.map(activity => (
        <div key={activity.id} className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">{activity.title}</h2>
          <p className="text-sm text-gray-500 mb-4">Measured in: {activity.measure}</p>
          <HeatMap
            value={getActivityEntries(activity.id)}
            startDate={new Date(new Date().setFullYear(new Date().getFullYear() - 1))}
            endDate={new Date()}
            width="100%"
            rectSize={12}
            legendCellSize={0}
            rectProps={{
              rx: 3,
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default SeePage;