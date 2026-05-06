import { ReactNode } from 'react';

type AlertVariant = 'info' | 'error' | 'success';

type AlertProps = {
  variant?: AlertVariant;
  children: ReactNode;
};

export function Alert({ variant = 'info', children }: AlertProps) {
  return (
    <div className={`alert alert--${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
