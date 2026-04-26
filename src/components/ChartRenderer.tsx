'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type ChartData = {
  chartType: 'bar' | 'line'
  title?: string
  xLabel?: string
  yLabel?: string
  data: Array<{ label: string; value: number }>
  dataNote?: string | null
}

type Props = {
  chart: ChartData
  theme?: 'light' | 'dark'
  showTitle?: boolean
}

export default function ChartRenderer({ chart, theme = 'light', showTitle = true }: Props) {
  const isDark = theme === 'dark'
  const axisColor = isDark ? '#aaa' : '#555'
  const gridColor = isDark ? '#222' : '#e6e6e6'
  const seriesColor = isDark ? '#9d95f0' : '#7f77dd'
  const labelColor = isDark ? '#eee' : '#1a1a1a'
  const noteColor = isDark ? '#888' : '#6b6b6b'

  const tooltipStyle = {
    background: isDark ? '#1a1a1a' : '#fff',
    border: `1px solid ${isDark ? '#333' : '#ddd'}`,
    borderRadius: 6,
    fontSize: 12,
    color: labelColor,
  }

  const ChartComponent = chart.chartType === 'line' ? LineChart : BarChart

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {showTitle && chart.title && (
        <div
          style={{
            fontSize: isDark ? 28 : 16,
            fontWeight: 600,
            color: labelColor,
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          {chart.title}
        </div>
      )}
      <div style={{ width: '100%', height: isDark ? 400 : 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={chart.data} margin={{ top: 10, right: 24, bottom: 36, left: 36 }}>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fill: axisColor, fontSize: 12 }}
              label={
                chart.xLabel
                  ? {
                      value: chart.xLabel,
                      position: 'insideBottom',
                      offset: -20,
                      fill: axisColor,
                      fontSize: 12,
                    }
                  : undefined
              }
            />
            <YAxis
              tick={{ fill: axisColor, fontSize: 12 }}
              label={
                chart.yLabel
                  ? {
                      value: chart.yLabel,
                      angle: -90,
                      position: 'insideLeft',
                      offset: 10,
                      fill: axisColor,
                      fontSize: 12,
                      style: { textAnchor: 'middle' },
                    }
                  : undefined
              }
            />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDark ? '#1a1a1a' : '#f5f4ef' }} />
            {chart.chartType === 'line' ? (
              <Line type="monotone" dataKey="value" stroke={seriesColor} strokeWidth={2} dot />
            ) : (
              <Bar dataKey="value" fill={seriesColor} />
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
      {chart.dataNote && (
        <div
          style={{
            marginTop: 12,
            fontSize: isDark ? 14 : 11,
            fontStyle: 'italic',
            color: noteColor,
            textAlign: 'center',
            maxWidth: 800,
          }}
        >
          {chart.dataNote}
        </div>
      )}
    </div>
  )
}
