import React from 'react';
import './ActivityFeed.css';

export default function ActivityFeed({ activities = [] }) {
  if (!activities.length) {
    return <div className="activity-feed__empty">Aucune activité récente.</div>;
  }
  return (
    <ul className="activity-feed">
      {activities.map((activity, idx) => (
        <li key={idx} className="activity-feed__item">
          <span className="activity-feed__date">{activity.date}</span>
          <span className="activity-feed__desc">{activity.description}</span>
        </li>
      ))}
    </ul>
  );
}
