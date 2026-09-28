import React from 'react';
import { 
  BookOpen, 
  Terminal, 
  Newspaper, 
  Compass, 
  Flame, 
  Search, 
  FileText, 
  CloudSun,
  Radio,
  Share2
} from 'lucide-react';

interface BookmarksBarProps {
  onSelect: (url: string) => void;
  currentUrl: string;
}

interface PresetItem {
  name: string;
  url: string;
  category: 'news' | 'tech' | 'reference' | 'retro';
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
}

const PRESETS: PresetItem[] = [
  {
    name: 'Wikipedia (BlackBerry Passport)',
    url: 'https://en.wikipedia.org/wiki/BlackBerry_Passport',
    category: 'reference',
    icon: BookOpen,
    tag: 'Deep Article',
  },
  {
    name: 'Hacker News',
    url: 'https://news.ycombinator.com',
    category: 'tech',
    icon: Terminal,
    tag: 'Tech Feed',
  },
  {
    name: 'CNN Lite',
    url: 'https://lite.cnn.com',
    category: 'news',
    icon: Newspaper,
    tag: 'Ultra-light',
  },
  {
    name: 'DuckDuckGo Lite',
    url: 'https://lite.duckduckgo.com/lite/',
    category: 'tech',
    icon: Search,
    tag: 'Search Engine',
  },
  {
    name: 'Old Reddit',
    url: 'https://old.reddit.com/r/blackberry',
    category: 'retro',
    icon: Flame,
    tag: 'Community',
  },
  {
    name: 'NPR Text-Only',
    url: 'https://text.npr.org',
    category: 'news',
    icon: Radio,
    tag: 'Minimal News',
  },
  {
    name: 'Project Gutenberg',
    url: 'https://www.gutenberg.org',
    category: 'reference',
    icon: FileText,
    tag: 'Free E-Books',
  },
  {
    name: 'BBC News',
    url: 'https://www.bbc.com/news',
    category: 'news',
    icon: Newspaper,
    tag: 'Global News',
  },
  {
    name: 'WTTR Weather',
    url: 'https://wttr.in',
    category: 'retro',
    icon: CloudSun,
    tag: 'ASCII Weather',
  },
];

export const BookmarksBar: React.FC<BookmarksBarProps> = ({ onSelect, currentUrl }) => {
  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 font-mono">
          <Compass className="w-3.5 h-3.5 text-sky-400" />
          Legacy-Tested Bookmarks
        </span>
        <span className="text-[11px] text-neutral-500 font-mono">
          Click any preset to proxy instantly
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {PRESETS.map((item) => {
          const Icon = item.icon;
          const isSelected = currentUrl === item.url;
          return (
            <button
              key={item.url}
              onClick={() => onSelect(item.url)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs whitespace-nowrap transition-all duration-150
                ${
                  isSelected
                    ? 'bg-sky-500/10 border-sky-500 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                    : 'bg-neutral-900/80 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-700 hover:text-white'
                }
              `}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-sky-400' : 'text-neutral-400'}`} />
              <span className="font-medium">{item.name}</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-800/80 text-neutral-400 font-mono">
                {item.tag}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
