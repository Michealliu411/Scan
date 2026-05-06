import { ClipboardCheck, Database, Search } from 'lucide-react';
import { Role } from '../auth/auth-types';

export type ModuleKey = 'inspection' | 'query' | 'masterData';

type ModuleDefinition = {
  key: ModuleKey;
  label: string;
  allowedRoles: Role[];
  icon: typeof ClipboardCheck;
};

const modules: ModuleDefinition[] = [
  {
    key: 'inspection',
    label: '检验扫描',
    allowedRoles: ['INSPECTOR', 'ADMIN'],
    icon: ClipboardCheck
  },
  {
    key: 'query',
    label: '查询分析',
    allowedRoles: ['QUERY', 'ADMIN'],
    icon: Search
  },
  {
    key: 'masterData',
    label: '基础数据',
    allowedRoles: ['ADMIN'],
    icon: Database
  }
];

type RoleNavProps = {
  role: Role;
  activeModule: ModuleKey;
  onModuleChange: (module: ModuleKey) => void;
};

export function RoleNav({ role, activeModule, onModuleChange }: RoleNavProps) {
  return (
    <nav className="role-nav" aria-label="主导航">
      {getAllowedModules(role).map((module) => {
        const Icon = module.icon;
        const isActive = module.key === activeModule;

        return (
          <button
            key={module.key}
            type="button"
            className={['role-nav__item', isActive ? 'role-nav__item--active' : ''].filter(Boolean).join(' ')}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onModuleChange(module.key)}
          >
            <Icon size={18} strokeWidth={2} aria-hidden="true" />
            <span>{module.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function getAllowedModules(role: Role): ModuleDefinition[] {
  return modules.filter((module) => module.allowedRoles.includes(role));
}
