import { useEffect, useState } from 'react'
import axios from 'axios'
import { BarChart3, AlertCircle } from 'lucide-react'

const GROUP_OPTIONS = [
  { value: 'gender', label: 'Giới tính' },
  { value: 'school_type', label: 'Loại trường' },
  { value: 'study_method', label: 'Phương pháp học' },
  { value: 'internet_access', label: 'Truy cập Internet' },
  { value: 'parent_education', label: 'Học vấn phụ huynh' },
]

export default function AnalysisTab() {
  const [groupBy, setGroupBy] = useState('gender')
  const [charts, setCharts] = useState({})
  const [anomalies, setAnomalies] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [cmp, score, method, anom] = await Promise.all([
          axios.get('/api/charts/group-compare', { params: { group_by: groupBy } }),
          axios.get('/api/charts/score-distribution'),
          axios.get('/api/charts/study-method-analysis'),
          axios.get('/api/anomalies'),
        ])
        setCharts({ cmp: cmp.data.image, score: score.data.image, method: method.data.image })
        setAnomalies(anom.data.anomalies)
      } catch (e) {}
      setLoading(false)
    }
    load()
  }, [groupBy])

  const SEVERITY_STYLE = {
    high: 'border-red-200 bg-red-50',
    medium: 'border-yellow-200 bg-yellow-50',
  }
  const SEVERITY_ICON = {
    high: '🔴',
    medium: '🟡',
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Phân tích nhân tố giáo dục</h2>
        <p className="text-gray-500 text-sm">So sánh nguy cơ và điểm số theo các nhóm, phát hiện bất thường</p>
      </div>

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div className="card border-orange-200 bg-orange-50">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <h3 className="font-bold text-orange-900">Phát hiện bất thường tự động ({anomalies.length})</h3>
          </div>
          <div className="space-y-2">
            {anomalies.map((a, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${SEVERITY_STYLE[a.severity] || 'bg-gray-50'}`}>
                <span className="text-lg flex-shrink-0">{SEVERITY_ICON[a.severity]}</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-800 leading-relaxed">{a.description}</p>
                  <span className="text-xs text-gray-500 mt-1">Ảnh hưởng: {a.affected_count?.toLocaleString()} học sinh</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                  a.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                }`}>{a.severity === 'high' ? 'Nghiêm trọng' : 'Trung bình'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group comparison */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-800">So sánh nguy cơ và điểm số theo nhóm</h3>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Nhóm theo:</label>
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-300 outline-none"
            >
              {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center items-center h-40"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        ) : charts.cmp ? (
          <img src={`data:image/png;base64,${charts.cmp}`} alt="So sánh theo nhóm" className="w-full rounded-lg" />
        ) : null}
      </div>

      {/* Score distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {charts.score && (
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3">Phân bố điểm số & xếp loại</h3>
            <img src={`data:image/png;base64,${charts.score}`} alt="Phân bố điểm số" className="w-full rounded-lg" />
          </div>
        )}
        {charts.method && (
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3">Phân tích theo phương pháp học</h3>
            <img src={`data:image/png;base64,${charts.method}`} alt="Phân tích phương pháp học" className="w-full rounded-lg" />
          </div>
        )}
      </div>

      {/* Key insights */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Nhận xét chính về các nhân tố</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: '📚', title: 'Giờ tự học', text: 'Yếu tố số 1 theo mô hình ML. Học sinh học <3h/ngày có nguy cơ rất cao. Cần khuyến khích duy trì ít nhất 4-5h.' },
            { icon: '🏫', title: 'Chuyên cần', text: 'Tỷ lệ điểm danh <65% dự báo rủi ro mạnh. Nhóm >90% chuyên cần hầu như không rơi vào F.' },
            { icon: '🌐', title: 'Internet', text: 'Học sinh không có internet truy cập tài liệu hạn chế. Cần hỗ trợ tài liệu offline hoặc phòng máy tính trường.' },
            { icon: '👨‍👩‍👧', title: 'Học vấn gia đình', text: 'Phụ huynh có học vấn cao tương quan với kết quả tốt hơn. Học sinh gia đình khó khăn cần hỗ trợ thêm từ nhà trường.' },
          ].map(({ icon, title, text }) => (
            <div key={title} className="flex gap-3 p-4 bg-gray-50 rounded-xl">
              <span className="text-2xl flex-shrink-0">{icon}</span>
              <div>
                <div className="font-semibold text-gray-800 text-sm mb-1">{title}</div>
                <p className="text-gray-600 text-xs leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
