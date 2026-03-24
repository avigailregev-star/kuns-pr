'use client';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

export default function DaysPicker({ value, onChange }) {
  function toggle(day) {
    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day]);
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {DAYS.map((day) => {
        const selected = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            className={`py-3 px-2 rounded-xl text-sm font-medium border transition-all duration-200 ${
              selected
                ? 'border-red-400/60 bg-red-500/20 text-red-300 shadow-sm shadow-red-500/20'
                : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/8'
            }`}
          >
            <div className="text-center">
              {selected && <span className="block text-xs mb-0.5 opacity-70">✕</span>}
              <span>יום {day}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
