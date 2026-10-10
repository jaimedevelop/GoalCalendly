import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, Clock, Trophy, CalendarDays, CheckSquare } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { useStore } from '../store';
import type { Goal } from '../types';
import { loadFromFirestore } from '../services/db';
import { buildReport, type ReportFrequency } from '../services/reports';
import { normalizeProgress } from '../services/practiceTime';

export function Reports() {
  const uid = useStore(state => state.user?.uid);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [frequency, setFrequency] = useState<ReportFrequency>('weekly');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    loadFromFirestore(uid).then(data => { if (!cancelled) setGoals(data.map(goal => normalizeProgress(goal))); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid, attempt]);
  const report = useMemo(() => buildReport(goals, frequency, parseISO(date)), [goals, frequency, date]);
  const cards = [
    { label: 'Hours used', value: report.hours.toLocaleString(undefined, { maximumFractionDigits: 2 }), Icon: Clock },
    { label: 'Trophies earned', value: report.trophies, Icon: Trophy },
    { label: 'Practice days', value: report.practiceDays, Icon: CalendarDays },
    { label: 'Goals completed', value: report.completed, Icon: CheckSquare },
  ];
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/goals" className="inline-flex items-center gap-2 text-blue-600 hover:underline mb-6"><ArrowLeft className="w-4 h-4" />Back to goals</Link>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div><h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BarChart3 className="text-yellow-600" />Reports</h2><p className="text-gray-600 mt-1">Your saved activity across active and completed goals.</p></div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium text-gray-700">Period<select value={frequency} onChange={event => setFrequency(event.target.value as ReportFrequency)} className="block mt-1 border border-gray-300 rounded-md bg-white px-3 py-2"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
          <label className="text-sm font-medium text-gray-700">Date<input type="date" value={date} onChange={event => { if (isValid(parseISO(event.target.value))) setDate(event.target.value); }} className="block mt-1 border border-gray-300 rounded-md px-3 py-2" /></label>
          <button onClick={() => setAttempt(value => value + 1)} disabled={loading} className="px-4 py-2 rounded-md bg-yellow-400 hover:bg-yellow-500 text-gray-900 disabled:opacity-50">Refresh</button>
        </div>
      </div>
      {loading ? <p role="status" className="py-12 text-center text-gray-600">Loading saved activity from Firestore...</p> : error ? <div role="alert" className="bg-red-50 text-red-700 p-4 rounded-lg">Reports could not be loaded. <button onClick={() => setAttempt(value => value + 1)} className="underline">Try again</button></div> : <>
        <p className="text-gray-600 mb-4">{format(report.start, 'MMM d, yyyy')}{frequency !== 'daily' && ` – ${format(report.end, 'MMM d, yyyy')}`} · Weeks start Sunday · {report.activeGoals} goals practiced</p>
        {report.incomplete && <p role="note" className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">Some older activity has incomplete dates. This report includes known dates and totals for whole periods within the selected range. Missing dates are not estimated. Choose Weekly or Monthly to see the available period totals.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{cards.map(({ label, value, Icon }) => <div key={label} className="bg-white rounded-lg border border-gray-200 p-5"><Icon className="w-5 h-5 text-yellow-600 mb-3" /><p className="text-3xl font-semibold text-gray-900">{value}</p><p className="text-sm text-gray-600 mt-1">{label}</p></div>)}</div>
        <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <h3 className="text-lg font-semibold p-5 border-b">Activity by goal</h3>
          {!goals.length ? <p className="p-8 text-center text-gray-600">Create a goal and log practice time to start collecting activity for your reports.</p> : <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-gray-50 text-gray-600"><tr>{['Goal', 'Hours used', 'Trophies', 'Practice days', 'Lifetime hours', 'Status'].map(label => <th key={label} scope="col" className="px-5 py-3 whitespace-nowrap">{label}</th>)}</tr></thead><tbody>{report.rows.map(row => <tr key={row.goal.id} className="border-t"><th scope="row" className="px-5 py-4 font-medium text-gray-900">{row.goal.name}{row.incomplete && <span className="block text-xs font-normal text-yellow-700">Limited dated history</span>}</th><td className="px-5 py-4">{row.hours.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td><td className="px-5 py-4">{row.trophies}</td><td className="px-5 py-4">{row.practiceDays}</td><td className="px-5 py-4">{row.goal.totalTimeSpent.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td><td className="px-5 py-4">{row.goal.completed ? 'Completed' : 'Active'}</td></tr>)}</tbody></table></div>}
        </section>
        {!!goals.length && report.activeGoals === 0 && <p className="mt-4 text-center text-gray-600">No practice recorded for this period.</p>}
        <p className="mt-4 text-xs text-gray-500">Reports use saved Firestore records. Stop your timer to include the current session, then refresh. Lifetime hours include all saved activity; trophies are counted once per achieved goal period.</p>
      </>}
    </main>
  );
}
