import React from 'react';
import './MetricsChart.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function MetricsChart({ filesCount = 0, historyCount = 0, modifiedFilesCount = 0 }) {
  // Build a simple 7-day trend using the provided counts as seeds
  const days = ['6j', '5j', '4j', '3j', '2j', '1j', 'Aujourd\'hui'];
  const seed = Math.max(1, Math.floor(historyCount / 7));
  const analysesData = days.map((_, i) => Math.max(0, seed + (i - 3) + (i % 2)));

  const data = {
    labels: days,
    datasets: [
      {
        label: 'Analyses (7j)',
        data: analysesData,
        borderColor: 'rgba(99,102,241,1)',
        backgroundColor: 'rgba(99,102,241,0.12)',
        tension: 0.3,
        pointRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  return (
    <div className="metrics-chart">
      <div className="metrics-chart__summary">
        <div>
          <div className="metrics-chart__num">{historyCount}</div>
          <div className="metrics-chart__label">Analyses</div>
        </div>
        <div>
          <div className="metrics-chart__num">{filesCount}</div>
          <div className="metrics-chart__label">Fichiers</div>
        </div>
        <div>
          <div className="metrics-chart__num">{modifiedFilesCount}</div>
          <div className="metrics-chart__label">Modifiés</div>
        </div>
      </div>

      <div className="metrics-chart__chart">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
