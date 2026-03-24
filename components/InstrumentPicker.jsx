'use client';

const INSTRUMENTS = [
  {
    value: 'piano',
    label: 'פסנתר',
    // Piano keys close-up
    img: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=400&q=80',
  },
  {
    value: 'violin',
    label: 'כינור',
    img: 'https://pic1.calcalist.co.il/picserver3/crop_images/2025/02/05/rJHhJhlKyg/rJHhJhlKyg_0_96_916_516_0_x-large.jpg',
  },
  {
    value: 'guitar',
    label: 'גיטרה',
    // Acoustic guitar body
    img: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400&q=80',
  },
  {
    value: 'flute',
    label: 'חליל',
    img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT4lDWYhbhBg36tURPq4MZYipWmZT-l5lAb-Q&s',
  },
  {
    value: 'drums',
    label: 'תופים',
    // Drum kit
    img: 'https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=400&q=80',
  },
  {
    value: 'voice',
    label: 'שירה',
    // Microphone on stage
    img: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&q=80',
  },
  {
    value: 'cello',
    label: "צ'לו",
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Cello_study.jpg/500px-Cello_study.jpg',
  },
  {
    value: 'trumpet',
    label: 'חצוצרה',
    img: 'https://www.wagner-tuba.com/rhapsody/wp-content/uploads/2023/03/trumpet-pb40.jpg',
  },
  {
    value: 'saxophone',
    label: 'סקסופון',
    // Saxophone
    img: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=400&q=80',
  },
];

export default function InstrumentPicker({ value, onChange }) {
  function toggle(instrument) {
    if (value.includes(instrument)) {
      onChange(value.filter((i) => i !== instrument));
    } else {
      onChange([...value, instrument]);
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {INSTRUMENTS.map((inst) => {
        const selected = value.includes(inst.value);
        return (
          <button
            key={inst.value}
            type="button"
            onClick={() => toggle(inst.value)}
            className={`relative overflow-hidden rounded-xl border-2 transition-all duration-200 group ${
              selected
                ? 'border-purple-400 shadow-lg shadow-purple-500/30 scale-105'
                : 'border-white/10 hover:border-white/30'
            }`}
            style={{ aspectRatio: '1 / 1' }}
          >
            {/* Background image */}
            <img
              src={inst.img}
              alt={inst.label}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                // fallback to solid color if image fails
                e.target.style.display = 'none';
              }}
            />

            {/* Gradient overlay */}
            <div
              className={`absolute inset-0 transition-all duration-200 ${
                selected
                  ? 'bg-gradient-to-t from-purple-900/90 via-purple-800/40 to-black/20'
                  : 'bg-gradient-to-t from-black/85 via-black/30 to-black/10 group-hover:from-black/70'
              }`}
            />

            {/* Selected checkmark */}
            {selected && (
              <div className="absolute top-2 left-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center shadow">
                <span className="text-white text-xs font-bold">✓</span>
              </div>
            )}

            {/* Label */}
            <div className="absolute bottom-0 inset-x-0 pb-2 text-center">
              <span className="text-sm font-semibold text-white drop-shadow-md">{inst.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
