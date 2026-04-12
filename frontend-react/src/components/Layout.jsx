import React from 'react';
import Navbar from './Navbar';

const Layout = ({ children, activePage }) => {
  return (
    <div className="min-h-screen bg-surface-bg">
      <main className="pb-24">
        {children}
      </main>
      <Navbar activePage={activePage} />
    </div>
  );
};

export default Layout;
