import Navbar from './Navbar';

export default function Layout({ children, className = '' }) {
  return (
    <div className="min-h-screen bg-surface-bg">
      <div className={`pb-28 ${className}`}>
        {children}
      </div>
      <Navbar />
    </div>
  );
}
