import React from 'react';
import { Globe, Menu, Search, Monitor, Palette, Sun } from 'lucide-react';
import { Language, User } from '../types';
import { TRANSLATIONS } from '../constants';
import { useAdminTheme } from '../theme';

interface NavbarProps {
  user: User;
  lang: Language;
  setLang: (lang: Language) => void;
  toggleSidebar: () => void;
  onWebsiteToggle?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, lang, setLang, toggleSidebar, onWebsiteToggle }) => {
  const t = TRANSLATIONS[lang];
  const [theme, toggleTheme] = useAdminTheme();
  const isCarbon = theme === 'carbon';

  return (
    <header className="h-16 sm:h-20 bg-white/80 backdrop-blur-md border-b border-saas-border px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sticky top-0 z-40">
      <div className="flex items-center gap-2 sm:gap-6 min-w-0">
        <button 
          onClick={toggleSidebar}
          className="p-2.5 rounded-xl hover:bg-saas-bg text-saas-text-muted transition-colors border border-saas-border shadow-sm lg:hidden shrink-0"
          aria-label="Menu"
        >
          <Menu size={20} />
        </button>
        
        <div className="hidden md:flex items-center gap-3 bg-saas-bg px-4 py-2 rounded-xl border border-saas-border md:w-64 lg:w-80 group focus-within:border-saas-primary-via focus-within:ring-2 focus-within:ring-saas-primary-via/10 transition-all">
          <Search size={16} className="text-saas-text-muted group-focus-within:text-saas-primary-via" />
          <input 
            type="text" 
            placeholder="Rechercher..." 
            className="bg-transparent border-none outline-none text-sm w-full text-saas-text-main placeholder:text-saas-text-muted font-medium"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-6 shrink-0">
        {/* Bascule la palette de tout le back-office (sidebar comprise) vers le
            noir & rouge du site public. Le thème est posé sur <html>, la feuille
            theme-carbon.css fait le reste : aucune page n'a à en tenir compte. */}
        <button
          onClick={toggleTheme}
          aria-pressed={isCarbon}
          className={`flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-widest shadow-sm ${
            isCarbon
              ? 'bg-saas-primary-via/10 border-saas-primary-via text-saas-primary-via'
              : 'bg-white border-saas-border hover:border-saas-primary-via text-saas-text-main'
          }`}
          title={
            isCarbon
              ? (lang === 'fr' ? 'Revenir au thème clair' : 'العودة إلى المظهر الفاتح')
              : (lang === 'fr' ? 'Thème carbone (couleurs du site)' : 'مظهر الكربون (ألوان الموقع)')
          }
        >
          {isCarbon ? <Sun size={16} /> : <Palette size={16} className="text-saas-primary-via" />}
          <span className="hidden sm:inline">
            {isCarbon
              ? { fr: 'Clair', ar: 'فاتح' }[lang]
              : { fr: 'Carbone', ar: 'كربون' }[lang]}
          </span>
        </button>

        <button
          onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
          className="flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-xl bg-white border border-saas-border hover:border-saas-primary-via transition-all text-[10px] font-bold uppercase tracking-widest text-saas-text-main shadow-sm"
        >
          <Globe size={16} className="text-saas-primary-via" />
          <span className="hidden sm:inline">{t.changeLang}</span>
        </button>

        <button 
          onClick={onWebsiteToggle}
          className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-100 border border-blue-300 hover:bg-blue-200 transition-all text-[10px] font-bold uppercase tracking-widest text-blue-700 shadow-sm"
          title={lang === 'fr' ? 'Aperçu du site web' : 'عرض الموقع'}
        >
          <Monitor size={16} />
          {{fr: 'Aperçu', ar: 'عرض'}[lang]}
        </button>

        <div className="hidden sm:block h-8 w-[1px] bg-saas-border" />

        <div className="flex items-center gap-3">
          <div className="text-right hidden lg:block">
            <p className="text-xs font-bold text-saas-text-main uppercase tracking-tighter max-w-[140px] truncate">{user.name}</p>
            <p className="text-[9px] text-saas-primary-via font-bold uppercase tracking-widest">{user.role}</p>
          </div>
          <div className="relative">
            {user.avatar ? (
              <img 
                src={user.avatar} 
                alt={user.name}
                className="w-10 h-10 rounded-full border border-saas-border p-0.5 object-cover shadow-sm"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-full border border-saas-border p-0.5 bg-saas-primary-via flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
          </div>
        </div>
      </div>
    </header>
  );
};
