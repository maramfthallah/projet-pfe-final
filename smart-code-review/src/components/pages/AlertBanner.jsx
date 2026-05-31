import React from 'react';
import './AlertBanner.css';

export default function AlertBanner({ message, severity = 'critical' }) {
  return (
    <div className={`alert-banner alert-banner--${severity}`}>
      <span className="alert-banner__icon">⚠️</span>
      <span className="alert-banner__message">{message}</span>
    </div>
  );
}
