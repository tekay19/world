import { CATEGORIES } from '@/lib/categories';

export default function CategoryStrip({
  category,
  onChange,
}: {
  category: string;
  onChange: (category: string) => void;
}) {
  return (
    <div className="cp-cats">
      {CATEGORIES.map((item) => (
        <button
          key={item.id}
          className={`cp-cat ${item.id === category ? 'active' : ''}`}
          onClick={() => onChange(item.id)}
          title={item.label}
        >
          <span>{item.emoji}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}
