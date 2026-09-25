interface UniversityHeaderProps {
  variant?: 'default' | 'light' | 'compact'
}

const LOGO_URL =
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR1hvO9zejmBLhKdeb1fMKOFJttJjwNaToY6dxk3ZDCM7wbJUr7-48Vk78&s=10'

export default function UniversityHeader({ variant = 'default' }: UniversityHeaderProps) {
  const isLight = variant === 'light'
  const isCompact = variant === 'compact'

  return (
    <div className="flex items-center gap-3">
      <img
        src={LOGO_URL}
        alt="Mekdela Amba University logo"
        className="rounded-xl object-contain flex-shrink-0"
        style={{ height: 45, width: 'auto' }}
      />
      <div>
        <h1 className={`font-heading font-bold leading-tight ${
          isLight ? 'text-white' : 'text-slate-900'
        } ${isCompact ? 'text-base' : 'text-lg'}`}>
          Mekdela Amba University
        </h1>
        <p className={`text-sm ${isLight ? 'text-brand-200' : 'text-slate-500'}`}>
          Mekane Selam Campus
        </p>
      </div>
    </div>
  )
}
