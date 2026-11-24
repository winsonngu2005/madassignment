import { useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { api, USE_MOCK } from '../api';
import Chart from '../components/Chart';
import type { Stats } from '../models';

const CAT_COLORS: Record<string, string> = {
  lighting: '#f59e0b',
  garbage: '#10b981',
  facility: '#3b82f6',
  noise: '#ef4444',
};
const colorOf = (code: string) => CAT_COLORS[code] ?? '#6366f1';

export default function StatisticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load statistics.'));
  }, []);

  const trendOption = useMemo<EChartsOption>(() => {
    if (!stats) return {};
    return {
      grid: { left: 40, right: 16, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        data: stats.trend.map((p) => p.date.slice(5)),
        axisLabel: { rotate: 40 },
      },
      yAxis: { type: 'value', minInterval: 1 },
      tooltip: { trigger: 'axis' },
      series: [
        {
          type: 'line',
          smooth: true,
          symbolSize: 7,
          data: stats.trend.map((p) => p.count),
          areaStyle: { opacity: 0.15 },
          itemStyle: { color: '#2563eb' },
        },
      ],
    };
  }, [stats]);

  const pieOption = useMemo<EChartsOption>(() => {
    if (!stats) return {};
    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['38%', '68%'],
          itemStyle: { borderRadius: 6 },
          label: { formatter: '{b}: {c}' },
          data: stats.categories.map((c) => ({
            name: c.name,
            value: c.count,
            itemStyle: { color: colorOf(c.code) },
          })),
        },
      ],
    };
  }, [stats]);

  const avgOption = useMemo<EChartsOption>(() => {
    if (!stats) return {};
    return {
      grid: { left: 48, right: 20, top: 20, bottom: 34 },
      xAxis: { type: 'category', data: stats.avg_hours.map((c) => c.name), axisLabel: { rotate: 18 } },
      yAxis: { type: 'value', name: 'hours' },
      tooltip: { trigger: 'axis' },
      series: [
        {
          type: 'bar',
          barWidth: '52%',
          data: stats.avg_hours.map((c) => ({
            value: c.avg_hours ?? 0,
            itemStyle: { color: colorOf(c.code) },
          })),
          label: {
            show: true,
            position: 'top',
            formatter: (p) => (p.value ? `${p.value} h` : '—'),
          },
        },
      ],
    };
  }, [stats]);

  if (error) return <div className="err-box">{error}</div>;
  if (!stats) return <div className="spinner">Loading statistics…</div>;

  const s = stats.summary;

  return (
    <>
      <div className="page-head">
        <div className="left">
          <h1>
            Statistics
            <span className="mock-flag">{USE_MOCK ? 'MOCK DATA' : 'LIVE DATA'}</span>
          </h1>
          <p>Derived live from tickets and status logs — figures update after every triage action.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="n">{s.total}</div>
          <div className="l"><i className="fa-solid fa-inbox" aria-hidden="true" /> Total tickets</div>
        </div>
        <div className="kpi kpi--warn">
          <div className="n">{s.pending}</div>
          <div className="l"><i className="fa-solid fa-hourglass-half" aria-hidden="true" /> Pending</div>
        </div>
        <div className="kpi">
          <div className="n">{s.in_progress}</div>
          <div className="l"><i className="fa-solid fa-gears" aria-hidden="true" /> In progress</div>
        </div>
        <div className="kpi kpi--ok">
          <div className="n">{s.completed}</div>
          <div className="l"><i className="fa-solid fa-circle-check" aria-hidden="true" /> Completed</div>
        </div>
        <div className="kpi kpi--danger">
          <div className="n">{s.overdue}</div>
          <div className="l"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> Overdue</div>
        </div>
        <div className="kpi">
          <div className="n">{s.avg_hours_all ?? '—'}</div>
          <div className="l"><i className="fa-solid fa-clock" aria-hidden="true" /> Avg handling time (h)</div>
        </div>
        <div className="kpi">
          <div className="n">{s.avg_stars ?? '—'} {s.avg_stars ? '/ 5' : ''}</div>
          <div className="l"><i className="fa-solid fa-star" aria-hidden="true" /> Avg resident rating</div>
        </div>
      </div>

      <div className="card chart-card">
        <h2>Tickets reported — last 14 days</h2>
        <Chart option={trendOption} />
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card chart-card" style={{ marginTop: 0 }}>
          <h2>Share by category</h2>
          <Chart option={pieOption} height={300} />
        </div>
        <div className="card chart-card" style={{ marginTop: 0 }}>
          <h2>Average handling time by category (accepted → completed)</h2>
          <Chart option={avgOption} height={300} />
        </div>
      </div>
    </>
  );
}
