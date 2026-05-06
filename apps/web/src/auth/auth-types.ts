export type Role = 'INSPECTOR' | 'QUERY' | 'ADMIN';

export type AuthUser = {
  id: string;
  username: string;
  role: Role;
  mustChangePassword: boolean;
};

export type ProductionLineOption = {
  id: string;
  code: string;
  name: string;
};

export type AuthSession = {
  user: AuthUser;
  productionLine: ProductionLineOption;
};
