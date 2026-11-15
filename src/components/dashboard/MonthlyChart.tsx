import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { MonthlyDashboard } from '@/lib/types'
import { moisToLabel, formatCurrency } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/i18n'

interface MonthlyChartProps {
  data: MonthlyDashboard[]
}

export default function MonthlyChart({ data }: MonthlyChartProps) {
  const theme = useStore(s => s.theme)
  const { t } = useTranslation()
  const isDark = theme === 'dark'

  const incomeKey = t('dashboard.chartIncome')
  const essentialKey = t('dashboard.chartEssential')
  const leisureKey = t('dashboard.chartLeisure')
  const savingsKey = t('dashboard.chartSavings')

  const chartData = data.slice(0, 6).reverse().map(d => ({
    name: moisToLabel(d.mois).slice(0, 4),
    [incomeKey]: d.total_revenus_reels,
    [essentialKey]: d.reel_essentielle,
    [leisureKey]: d.reel_loisirs,
    [savingsKey]: d.reel_epargne,
  }))

  const colors = {
    [incomeKey]: '#3b82f6',
    [essentialKey]: '#6366f1',
    [leisureKey]: '#f59e0b',
    [savingsKey]: '#10b981',
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
        {t('dashboard.chartTitle')}
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barSize={8} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1f2937' : '#f3f4f6'} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${(v / 1000).toFixed(1)}k`}
          />
          <Tooltip
            formatter={(value: number, name: string) => [formatCurrency(value), name]}
            contentStyle={{
              backgroundColor: isDark ? '#1f2937' : '#fff',
              border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
              borderRadius: '12px',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }} />
          {Object.entries(colors).map(([key, color]) => (
            <Bar key={key} dataKey={key} fill={color} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
