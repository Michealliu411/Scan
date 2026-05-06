import { ScanLine } from 'lucide-react';

export function App() {
  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="foundation-panel">
        <div className="brand-mark" aria-hidden="true">
          <ScanLine size={28} strokeWidth={2.2} />
        </div>
        <div>
          <p className="eyebrow">Scan Statistics</p>
          <h1 id="app-title">车间检验扫描统计系统</h1>
          <p className="status-text">基础框架初始化中</p>
        </div>
      </section>
    </main>
  );
}
