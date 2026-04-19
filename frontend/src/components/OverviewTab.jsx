import { useEffect, useState } from 'react'
import axios from 'axios'
import { Users, AlertTriangle, TrendingUp, Award, Brain, Activity } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'

export default function OverviewTab({ summary }) {
  const [kpi, setKpi] = useState(null)

  useEffect(() => {
    axios.get('/api/kpi').then(r => setKpi(r.data)).catch(() => {})
  }, [])

  if (!kpi) return <div className="flex justify-center items-center h-64"><div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>

  const riskData = [
    { name: 'Nguy cơ cao', value: kpi.high_risk_count, color: '#ef4444' },
    { name: 'Nguy cơ TB', value: kpi.medium_risk_count, color: '#f59e0b' },
    { name: 'An toàn', value: kpi.low_risk_count, color: '#10b981' },
  ]

  const gradeData = Object.entries(kpi.grade_distribution || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([grade, count]) => ({ grade: grade.toUpperCase(), count }))

  const cards = [
    { label: 'Tổng học sinh', value: kpi.total_students.toLocaleString(), icon: Users, color: 'blue', sub: 'Trong dataset' },
    { label: 'Nguy cơ học yếu', value: `${kpi.at_risk_pct}%`, icon: AlertTriangle, color: 'red', sub: `${kpi.high_risk_count} học sinh cần can thiệp ngay` },
    { label: 'Điểm trung bình', value: kpi.avg_score, icon: TrendingUp, color: 'green', sub: 'Trên thang 0-100' },
    { label: 'Học sinh xuất sắc', value: `${kpi.excellent_pct}%`, icon: Award, color: 'purple', sub: 'Xếp loại A' },
    { label: 'Độ chính xác ML', value: `${kpi.model_accuracy}%`, icon: Brain, color: 'indigo', sub: 'Random Forest Classifier' },
    { label: 'Nguy cơ cao (ML)', value: kpi.high_risk_count.toLocaleString(), icon: Activity, color: 'orange', sub: 'Cần can thiệp ngay lập tức' },
  ]

  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Tổng quan hệ thống</h2>
        <p className="text-gray-500 text-sm">Kết quả phân tích và dự đoán từ mô hình Random Forest</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorMap[color]}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
            <div className="text-sm font-medium text-gray-700 mb-0.5">{label}</div>
            <div className="text-xs text-gray-400">{sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Phân bố mức độ nguy cơ (ML)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={riskData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                {riskData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [v.toLocaleString(), 'Học sinh']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {riskData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                {d.name}: <span className="font-semibold">{d.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Phân bố xếp loại học tập</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={gradeData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [v.toLocaleString(), 'Học sinh']} />
              <Bar dataKey="count" name="Số học sinh" radius={[4, 4, 0, 0]}
                fill="#3b82f6"
                label={{ position: 'top', fontSize: 10, formatter: v => v > 1000 ? `${(v/1000).toFixed(1)}k` : v }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ML Model info */}
      <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-blue-900 mb-1">Mô hình Machine Learning: Random Forest Classifier</h3>
            <p className="text-blue-700 text-sm leading-relaxed">
              Mô hình được train trên các yếu tố hành vi học tập (<strong>study_hours, attendance_percentage, study_method, school_type, parent_education, internet_access, travel_time, age, gender</strong>) —
              không sử dụng điểm số làm đầu vào. Mục tiêu: dự đoán học sinh có rơi vào nhóm E/F hay không.
            </p>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-blue-600 font-medium">✓ 100 cây quyết định</span>
              <span className="text-blue-600 font-medium">✓ Cross-validation 80/20</span>
              <span className="text-blue-600 font-medium">✓ Độ chính xác: {kpi.model_accuracy}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
